import { useMemo } from "react";

const fmt  = (v, d=0) => (v >= 0 ? "+" : "") + Number(v).toFixed(d) + " $";
const pct  = (v) => Number(v).toFixed(1) + "%";

function compute(trades) {
  if (!trades.length) return null;

  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const total  = trades.reduce((s, t) => s + t.pnl, 0);
  const wr     = wins.length / trades.length;

  const avgWin  = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)   / wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s,t)=>s+t.pnl,0) / losses.length : 0; // négatif

  // Profit Factor = gross profit / |gross loss|
  const grossProfit = wins.reduce((s,t)=>s+t.pnl,0);
  const grossLoss   = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 999 : 0;

  // Expectancy = (WR × avgWin) + ((1-WR) × avgLoss)
  const expectancy = (wr * avgWin) + ((1 - wr) * avgLoss);

  // Max Drawdown : equity curve peak-to-trough
  const sorted = [...trades].sort((a,b) => a.date.localeCompare(b.date));
  let peak = 0, cum = 0, maxDD = 0, maxDDPct = 0;
  for (const t of sorted) {
    cum += t.pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0, cw = 0, cl = 0;
  for (const t of sorted) {
    if (t.pnl > 0) { cw++; cl=0; maxConsecWins   = Math.max(maxConsecWins,   cw); }
    else            { cl++; cw=0; maxConsecLosses = Math.max(maxConsecLosses, cl); }
  }

  // Avg holding (trades per day buckets)
  const byDate = {};
  sorted.forEach(t => { byDate[t.date] = (byDate[t.date]||0)+1; });
  const tradingDays = Object.keys(byDate).length;
  const avgPerDay   = tradingDays ? (trades.length / tradingDays).toFixed(1) : 0;

  // Best/worst day
  const dayPnl = {};
  sorted.forEach(t => { dayPnl[t.date] = (dayPnl[t.date]||0) + t.pnl; });
  const dayVals = Object.values(dayPnl);
  const bestDay  = dayVals.length ? Math.max(...dayVals) : 0;
  const worstDay = dayVals.length ? Math.min(...dayVals) : 0;

  // Courbe d'équité pour mini chart
  let runCum = 0;
  const curve = sorted.map(t => { runCum += t.pnl; return runCum; });

  return {
    total, wr: wr*100, wins: wins.length, losses: losses.length,
    avgWin, avgLoss, profitFactor, expectancy,
    maxDD, maxDDPct, maxConsecWins, maxConsecLosses,
    tradingDays, avgPerDay, bestDay, worstDay, curve,
    grossProfit, grossLoss,
  };
}

function StatCard({ label, value, sub, accent="#22d3a0", wide=false }) {
  return (
    <div style={{
      background:"#0d1117", border:"1px solid rgba(255,255,255,0.06)",
      borderRadius:12, padding:"16px 18px", position:"relative", overflow:"hidden",
      gridColumn: wide ? "span 2" : "span 1",
    }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent},transparent)` }}/>
      <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:10 }}>{label}</div>
      <div style={{ fontSize:24,fontWeight:900,color:accent,letterSpacing:"-1px",lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10,color:"#3a4a5a",marginTop:7,letterSpacing:"0.04em" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pctW = max > 0 ? Math.min((Math.abs(value)/max)*100,100) : 0;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
        <span style={{ fontSize:11,color:"#888" }}>{label}</span>
        <span style={{ fontSize:11,fontWeight:700,color }}>{value>=0?"+":""}{Number(value).toFixed(0)} $</span>
      </div>
      <div style={{ height:4,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pctW}%`,background:color,borderRadius:99,transition:"width 0.6s ease" }}/>
      </div>
    </div>
  );
}

export default function AdvancedStats({ trades }) {
  const s = useMemo(() => compute(trades), [trades]);

  if (!s) return (
    <div style={{ textAlign:"center",color:"#444",padding:60,fontSize:14 }}>
      Ajoute des trades pour voir tes statistiques avancées.
    </div>
  );

  const pfColor = s.profitFactor >= 2 ? "#22d3a0" : s.profitFactor >= 1 ? "#f5c842" : "#ff4d6d";
  const ddColor = s.maxDDPct < 10 ? "#22d3a0" : s.maxDDPct < 25 ? "#f5c842" : "#ff4d6d";

  // Mini equity chart
  const cMin = Math.min(...s.curve, 0);
  const cMax = Math.max(...s.curve, 1);
  const cRange = cMax - cMin || 1;
  const W = 100, H = 40;
  const pts = s.curve.map((v,i) => {
    const x = s.curve.length > 1 ? (i/(s.curve.length-1))*W : W/2;
    const y = H - ((v - cMin)/cRange)*(H-6) - 3;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${H} ${polyline} ${W},${H}`;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

      {/* Ligne 1 : métriques clés */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12 }}>
        <StatCard
          label="Profit Factor"
          value={s.profitFactor > 99 ? "∞" : s.profitFactor.toFixed(2)}
          sub={`Brut: ${s.grossProfit.toFixed(0)} $ gagné · ${s.grossLoss.toFixed(0)} $ perdu`}
          accent={pfColor}
        />
        <StatCard
          label="Expectancy"
          value={(s.expectancy >= 0 ? "+" : "") + s.expectancy.toFixed(2) + " $"}
          sub="Gain moyen attendu par trade"
          accent={s.expectancy >= 0 ? "#22d3a0" : "#ff4d6d"}
        />
        <StatCard
          label="Max Drawdown"
          value={"-" + s.maxDD.toFixed(0) + " $"}
          sub={`${s.maxDDPct.toFixed(1)}% du pic — ${s.maxDDPct < 10 ? "✓ Excellent" : s.maxDDPct < 25 ? "⚠ Modéré" : "✗ Élevé"}`}
          accent={ddColor}
        />
        <StatCard
          label="Win Rate"
          value={pct(s.wr)}
          sub={`${s.wins} gagnants · ${s.losses} perdants`}
          accent="#7eb4ff"
        />
      </div>

      {/* Ligne 2 : avg win/loss + courbe mini */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <div style={{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:14 }}>Gains vs Pertes moyens</div>
          <MiniBar label="Gain moyen"   value={s.avgWin}  max={Math.max(Math.abs(s.avgWin),Math.abs(s.avgLoss))} color="#22d3a0"/>
          <MiniBar label="Perte moyenne" value={s.avgLoss} max={Math.max(Math.abs(s.avgWin),Math.abs(s.avgLoss))} color="#ff4d6d"/>
          <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between" }}>
            <span style={{ fontSize:10,color:"#555" }}>Ratio R/R implicite</span>
            <span style={{ fontSize:12,fontWeight:700,color:"#f5c842" }}>
              1 : {s.avgLoss !== 0 ? (s.avgWin/Math.abs(s.avgLoss)).toFixed(2) : "∞"}
            </span>
          </div>
        </div>

        <div style={{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:10 }}>Courbe d'équité</div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="56" style={{ display:"block",overflow:"visible" }}>
            <defs>
              <linearGradient id="asg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3a0" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#22d3a0" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#asg)"/>
            <polyline points={polyline} fill="none" stroke="#22d3a0" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize:10,color:"#555" }}>P&L total</span>
            <span style={{ fontSize:12,fontWeight:700,color:s.total>=0?"#22d3a0":"#ff4d6d" }}>{fmt(s.total)}</span>
          </div>
        </div>
      </div>

      {/* Ligne 3 : streaks + activité */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        {[
          { label:"Série gagnante max", value:s.maxConsecWins,  suffix:" trades", accent:"#22d3a0" },
          { label:"Série perdante max", value:s.maxConsecLosses, suffix:" trades", accent:"#ff4d6d" },
          { label:"Jours tradés",       value:s.tradingDays,    suffix:" jours",  accent:"#7eb4ff" },
          { label:"Trades / jour",      value:s.avgPerDay,      suffix:" moy.",   accent:"#f5c842" },
        ].map((k,i)=>(
          <div key={i} style={{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden" }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${k.accent},transparent)` }}/>
            <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:700,marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:22,fontWeight:900,color:k.accent,letterSpacing:"-0.5px" }}>{k.value}<span style={{ fontSize:11,fontWeight:500,color:"#3a4a5a" }}>{k.suffix}</span></div>
          </div>
        ))}
      </div>

      {/* Ligne 4 : meilleur / pire jour */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <div style={{ background:"linear-gradient(135deg,#0d1117,rgba(34,211,160,0.04))",border:"1px solid rgba(34,211,160,0.12)",borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:8 }}>Meilleur jour</div>
          <div style={{ fontSize:26,fontWeight:900,color:"#22d3a0",letterSpacing:"-1px" }}>{fmt(s.bestDay)}</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#0d1117,rgba(255,77,109,0.04))",border:"1px solid rgba(255,77,109,0.12)",borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:8 }}>Pire jour</div>
          <div style={{ fontSize:26,fontWeight:900,color:"#ff4d6d",letterSpacing:"-1px" }}>{fmt(s.worstDay)}</div>
        </div>
      </div>

      {/* Ligne 5 : P&L par instrument + stratégie */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        {[
          { title:"P&L par Instrument", key:"instrument", color:"#22d3a0" },
          { title:"P&L par Stratégie",  key:"strategy",   color:"#7eb4ff" },
        ].map(({ title, key, color })=>{
          const map = {};
          trades.forEach(t=>{ map[t[key]]=(map[t[key]]||0)+t.pnl; });
          const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
          const maxAbs  = Math.max(...entries.map(([,v])=>Math.abs(v)),1);
          return (
            <div key={key} style={{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px" }}>
              <div style={{ fontSize:9,color:"#3a4050",letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:700,marginBottom:14 }}>{title}</div>
              {entries.map(([name,pnl])=>(
                <div key={name} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:11,color:"#888" }}>{name}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:pnl>=0?color:"#ff4d6d" }}>{pnl>=0?"+":""}{pnl.toFixed(0)} $</span>
                  </div>
                  <div style={{ height:4,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${(Math.abs(pnl)/maxAbs)*100}%`,background:pnl>=0?color:"#ff4d6d",borderRadius:99 }}/>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

    </div>
  );
}
