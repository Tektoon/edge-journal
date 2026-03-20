import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

const DEFAULT_INSTRUMENTS = ["EUR/USD","GBP/USD","BTC/USD","ETH/USD","SPX500","NAS100","GOLD","OIL","DAX","Autre"];
const DEFAULT_STRATEGIES  = ["Breakout","Scalping","Swing","Trend Following","Mean Reversion","News Trading","Autre"];
const DEFAULT_SESSIONS    = ["London","New York","Asian","Overlap"];
const SETTINGS_KEY        = "edge_settings";

const fmt = (val) => (val >= 0 ? "+" : "") + Number(val).toFixed(0) + " $";
const today = () => new Date().toISOString().split("T")[0];

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { instruments: DEFAULT_INSTRUMENTS, strategies: DEFAULT_STRATEGIES, sessions: DEFAULT_SESSIONS };
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

/* ── tiny components ── */
function Dots({ value }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {[1,2,3,4,5].map(i=>(
        <div key={i} style={{ width:7, height:7, borderRadius:"50%",
          background:i<=value?(value>=4?"#22d3a0":value>=3?"#f5c842":"#ff4d6d"):"rgba(255,255,255,0.12)" }}/>
      ))}
    </div>
  );
}

function Tag({ label }) {
  const MAP = {
    "A+":{ bg:"rgba(34,211,160,0.15)",c:"#22d3a0",b:"rgba(34,211,160,0.3)" },
    "B":{ bg:"rgba(245,200,66,0.12)",c:"#f5c842",b:"rgba(245,200,66,0.3)" },
    "Erreur":{ bg:"rgba(255,77,109,0.12)",c:"#ff4d6d",b:"rgba(255,77,109,0.3)" },
    "FOMO":{ bg:"rgba(255,77,109,0.1)",c:"#ff8fa0",b:"rgba(255,77,109,0.2)" },
    "Conforme":{ bg:"rgba(100,160,255,0.12)",c:"#7eb4ff",b:"rgba(100,160,255,0.3)" },
  };
  const s = MAP[label]||{ bg:"rgba(255,255,255,0.08)",c:"#aaa",b:"rgba(255,255,255,0.15)" };
  return <span style={{ padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600,background:s.bg,color:s.c,border:`1px solid ${s.b}` }}>{label}</span>;
}

function DirBadge({ dir }) {
  return <div style={{ padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,letterSpacing:"0.05em",flexShrink:0,background:dir==="LONG"?"rgba(34,211,160,0.15)":"rgba(255,77,109,0.15)",color:dir==="LONG"?"#22d3a0":"#ff4d6d" }}>{dir}</div>;
}

function BarCard({ title, entries, pos, neg }) {
  const max = Math.max(...entries.map(([,v])=>Math.abs(v)),1);
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      {entries.map(([name,pnl])=>(
        <div key={name} style={{ marginBottom:12 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
            <span style={{ fontSize:12,color:"#bbb" }}>{name}</span>
            <span style={{ fontSize:12,fontWeight:700,color:pnl>=0?pos:neg }}>{fmt(pnl)}</span>
          </div>
          <div style={{ height:5,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${(Math.abs(pnl)/max)*100}%`,background:pnl>=0?pos:neg,borderRadius:99 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── SETTINGS PANEL ── */
function SettingsPanel({ settings, onChange }) {
  const [newVals, setNewVals] = useState({ instruments:"", strategies:"", sessions:"" });

  const addItem = (key) => {
    const val = newVals[key].trim();
    if (!val || settings[key].includes(val)) return;
    // Insert before last item ("Autre") if it exists, else append
    const list = [...settings[key]];
    const autreIdx = list.indexOf("Autre");
    if (autreIdx !== -1) list.splice(autreIdx, 0, val);
    else list.push(val);
    onChange({ ...settings, [key]: list });
    setNewVals({ ...newVals, [key]: "" });
  };

  const removeItem = (key, item) => {
    if (item === "Autre") return; // protect Autre
    onChange({ ...settings, [key]: settings[key].filter(x => x !== item) });
  };

  const sections = [
    { key:"instruments", label:"Instruments", placeholder:"ex: DAX, CAC40, SILVER…" },
    { key:"strategies",  label:"Stratégies",  placeholder:"ex: ICT, SMC, Grid…" },
    { key:"sessions",    label:"Sessions",    placeholder:"ex: Tokyo, Sydney…" },
  ];

  return (
    <div>
      {sections.map(sec => (
        <div key={sec.key} style={S.card}>
          <div style={S.cardTitle}>{sec.label}</div>
          {/* list */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, margin:"14px 0 16px" }}>
            {settings[sec.key].map(item => (
              <div key={item} style={{ display:"flex", alignItems:"center", gap:5,
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8, padding:"5px 10px" }}>
                <span style={{ fontSize:13, color:"#ddd" }}>{item}</span>
                {item !== "Autre" && (
                  <button onClick={()=>removeItem(sec.key, item)}
                    style={{ background:"none", border:"none", color:"#ff4d6d", cursor:"pointer",
                      fontSize:14, lineHeight:1, padding:0, marginLeft:2 }}>×</button>
                )}
              </div>
            ))}
          </div>
          {/* add */}
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={newVals[sec.key]}
              onChange={e=>setNewVals({...newVals,[sec.key]:e.target.value})}
              onKeyDown={e=>e.key==="Enter"&&addItem(sec.key)}
              style={{ ...S.inp, flex:1 }}
              placeholder={sec.placeholder}/>
            <button onClick={()=>addItem(sec.key)} style={{ ...S.addBtn, padding:"9px 16px" }}>
              Ajouter
            </button>
          </div>
        </div>
      ))}

      <div style={{ ...S.card, borderColor:"rgba(255,77,109,0.2)" }}>
        <div style={S.cardTitle}>Réinitialiser</div>
        <p style={{ fontSize:13, color:"#666", margin:"10px 0 14px" }}>
          Remet les instruments, stratégies et sessions par défaut. Tes trades ne sont pas affectés.
        </p>
        <button onClick={()=>onChange({ instruments:DEFAULT_INSTRUMENTS, strategies:DEFAULT_STRATEGIES, sessions:DEFAULT_SESSIONS })}
          style={S.delBtn}>
          Réinitialiser les paramètres
        </button>
      </div>
    </div>
  );
}

/* ── AUTH ── */
function AuthScreen() {
  const [mode,setMode] = useState("login");
  const [email,setEmail] = useState("");
  const [pass,setPass] = useState("");
  const [loading,setLoading] = useState(false);
  const [msg,setMsg] = useState(null);

  const handle = async () => {
    setLoading(true); setMsg(null);
    try {
      if (mode==="reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMsg({ ok:true, text:"Email envoyé !" });
      } else if (mode==="signup") {
        const { error } = await supabase.auth.signUp({ email, password:pass });
        if (error) throw error;
        setMsg({ ok:true, text:"Compte créé ! Vérifie ton email pour confirmer." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password:pass });
        if (error) throw error;
      }
    } catch(e) { setMsg({ ok:false, text:e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0a0d12",fontFamily:"'DM Mono','Fira Code','Courier New',monospace",padding:16 }}>
      <div style={{ width:"100%",maxWidth:380 }}>
        <div style={{ textAlign:"center",marginBottom:36 }}>
          <div style={{ fontSize:36,color:"#22d3a0" }}>◈</div>
          <div style={{ fontWeight:900,fontSize:22,color:"#e8e8e8",letterSpacing:"0.1em",marginTop:8 }}>EDGE</div>
          <div style={{ fontSize:10,color:"#444",letterSpacing:"0.2em",marginTop:4 }}>TRADING JOURNAL</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize:14,fontWeight:700,color:"#e8e8e8",marginBottom:20,textAlign:"center" }}>
            {mode==="login"?"Connexion":mode==="signup"?"Créer un compte":"Mot de passe oublié"}
          </div>
          <label style={S.lbl}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            style={{ ...S.inp,marginBottom:12 }} placeholder="toi@email.com"
            onKeyDown={e=>e.key==="Enter"&&handle()}/>
          {mode!=="reset" && <>
            <label style={S.lbl}>Mot de passe</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              style={{ ...S.inp,marginBottom:16 }} placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&handle()}/>
          </>}
          {msg && (
            <div style={{ padding:"10px 12px",borderRadius:8,marginBottom:14,fontSize:12,
              background:msg.ok?"rgba(34,211,160,0.1)":"rgba(255,77,109,0.1)",
              color:msg.ok?"#22d3a0":"#ff4d6d",
              border:`1px solid ${msg.ok?"rgba(34,211,160,0.3)":"rgba(255,77,109,0.3)"}` }}>
              {msg.text}
            </div>
          )}
          <button onClick={handle} disabled={loading}
            style={{ ...S.addBtn,width:"100%",justifyContent:"center",opacity:loading?0.6:1 }}>
            {loading?"…":mode==="login"?"Se connecter":mode==="signup"?"Créer le compte":"Envoyer le lien"}
          </button>
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginTop:16,textAlign:"center" }}>
            {mode!=="signup"&&<button onClick={()=>{setMode("signup");setMsg(null);}} style={S.linkBtn}>Pas de compte ? Créer un compte</button>}
            {mode!=="login"&&<button onClick={()=>{setMode("login");setMsg(null);}} style={S.linkBtn}>Déjà un compte ? Se connecter</button>}
            {mode==="login"&&<button onClick={()=>{setMode("reset");setMsg(null);}} style={{ ...S.linkBtn,color:"#555" }}>Mot de passe oublié</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [session,setSession]   = useState(undefined);
  const [trades,setTrades]     = useState([]);
  const [loading,setLoading]   = useState(true);
  const [syncing,setSyncing]   = useState(false);
  const [view,setView]         = useState("dashboard");
  const [showForm,setShowForm] = useState(false);
  const [expanded,setExpanded] = useState(null);
  const [menuOpen,setMenuOpen] = useState(false);
  const [filter,setFilter]     = useState({ instrument:"",direction:"",strategy:"" });
  const [settings,setSettings] = useState(loadSettings);
  const [form,setForm]         = useState(null);

  // init form after settings loaded
  useEffect(()=>{
    setForm({
      date:today(), instrument:settings.instruments[0]||"", direction:"LONG",
      entry:"", exit:"", size:"", pnl:"", strategy:settings.strategies[0]||"",
      session:settings.sessions[0]||"", emotions:3, notes:"", tags:""
    });
  },[]);

  const updateSettings = (next) => { setSettings(next); saveSettings(next); };

  useEffect(()=>{
    supabase.auth.getSession().then(({ data })=>setSession(data.session));
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  const loadTrades = useCallback(async()=>{
    if (!session) return;
    setLoading(true);
    const { data,error } = await supabase.from("trades").select("*").order("date",{ ascending:false });
    if (!error) setTrades(data||[]);
    setLoading(false);
  },[session]);

  useEffect(()=>{ loadTrades(); },[loadTrades]);

  useEffect(()=>{
    if (!session) return;
    const ch = supabase.channel("trades-rt")
      .on("postgres_changes",{ event:"*",schema:"public",table:"trades" },()=>loadTrades())
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[session,loadTrades]);

  async function addTrade() {
    if (!form) return;
    setSyncing(true);
    await supabase.from("trades").insert({
      user_id:session.user.id, date:form.date, instrument:form.instrument,
      direction:form.direction, entry:parseFloat(form.entry)||0,
      exit:parseFloat(form.exit)||0, size:parseFloat(form.size)||0,
      pnl:parseFloat(form.pnl)||0, strategy:form.strategy, session:form.session,
      emotions:parseInt(form.emotions)||3, notes:form.notes,
      tags:form.tags?form.tags.split(",").map(s=>s.trim()).filter(Boolean):[],
    });
    setSyncing(false); setShowForm(false);
    setForm({ date:today(), instrument:settings.instruments[0]||"", direction:"LONG",
      entry:"", exit:"", size:"", pnl:"", strategy:settings.strategies[0]||"",
      session:settings.sessions[0]||"", emotions:3, notes:"", tags:"" });
    loadTrades();
  }

  async function deleteTrade(id) {
    setSyncing(true);
    await supabase.from("trades").delete().eq("id",id);
    setSyncing(false); setExpanded(null); loadTrades();
  }

  const logout = ()=>supabase.auth.signOut();
  const go = (v)=>{ setView(v); setMenuOpen(false); };

  const stats = useMemo(()=>{
    const wins=trades.filter(t=>t.pnl>0), losses=trades.filter(t=>t.pnl<0);
    const total=trades.reduce((s,t)=>s+t.pnl,0);
    const wr=trades.length?((wins.length/trades.length)*100).toFixed(1):"0.0";
    const avgW=wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
    const avgL=losses.length?Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length):1;
    return { total,wins:wins.length,losses:losses.length,wr,rr:(avgW/avgL).toFixed(2),count:trades.length };
  },[trades]);

  const filtered = trades.filter(t=>
    (!filter.instrument||t.instrument===filter.instrument)&&
    (!filter.direction||t.direction===filter.direction)&&
    (!filter.strategy||t.strategy===filter.strategy)
  );

  const curve = useMemo(()=>{
    const sorted=[...trades].sort((a,b)=>a.date.localeCompare(b.date));
    let cum=0; return sorted.map(t=>{ cum+=t.pnl; return { date:t.date?.slice(5)||"",cum }; });
  },[trades]);
  const cMax=Math.max(...curve.map(p=>p.cum),1);
  const cMin=Math.min(...curve.map(p=>p.cum),0);
  const cRange=cMax-cMin||1;

  const byKey = k=>{ const m={}; trades.forEach(t=>{ m[t[k]]=(m[t[k]]||0)+t.pnl; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };

  const NAV=[
    { id:"dashboard", icon:"▦", label:"Dashboard"  },
    { id:"journal",   icon:"≡", label:"Journal"    },
    { id:"stats",     icon:"◑", label:"Analytics"  },
    { id:"settings",  icon:"⚙", label:"Paramètres" },
  ];

  if (session===undefined) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0a0d12",fontFamily:"'DM Mono',monospace",color:"#22d3a0",fontSize:13,letterSpacing:"0.1em" }}>CHARGEMENT…</div>;
  if (!session) return <AuthScreen/>;
  if (!form) return null;

  return (
    <div style={S.root}>
      {/* mobile topbar */}
      <div style={{ ...S.topbar,display:"flex" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ color:"#22d3a0",fontSize:20 }}>◈</span>
          <div>
            <div style={{ fontWeight:900,fontSize:14,color:"#e8e8e8",letterSpacing:"0.1em" }}>EDGE</div>
            <div style={{ fontSize:9,color:"#444",letterSpacing:"0.15em" }}>Trading Journal</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {syncing&&<span style={{ fontSize:10,color:"#22d3a0" }}>↑↓</span>}
          <button onClick={()=>setMenuOpen(o=>!o)} style={S.burgerBtn}>☰</button>
        </div>
      </div>

      {menuOpen&&(
        <div style={{ ...S.dropdown,display:"flex" }}>
          {NAV.map(n=><button key={n.id} onClick={()=>go(n.id)} style={{ ...S.navBtn,...(view===n.id?S.navActive:{}) }}><span style={{ fontSize:14 }}>{n.icon}</span>{n.label}</button>)}
          <button onClick={logout} style={{ ...S.navBtn,color:"#ff4d6d",marginTop:4 }}><span style={{ fontSize:14 }}>→</span>Déconnexion</button>
        </div>
      )}

      {/* sidebar desktop */}
      <aside style={S.sidebar}>
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"0 18px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:14 }}>
          <span style={{ color:"#22d3a0",fontSize:22 }}>◈</span>
          <div>
            <div style={{ fontWeight:900,fontSize:15,color:"#e8e8e8",letterSpacing:"0.1em" }}>EDGE</div>
            <div style={{ fontSize:9,color:"#444",letterSpacing:"0.15em",marginTop:2 }}>Trading Journal</div>
          </div>
        </div>
        <nav style={{ display:"flex",flexDirection:"column",gap:3,padding:"0 10px" }}>
          {NAV.map(n=><button key={n.id} onClick={()=>setView(n.id)} style={{ ...S.navBtn,...(view===n.id?S.navActive:{}) }}><span style={{ fontSize:14 }}>{n.icon}</span>{n.label}</button>)}
        </nav>
        <div style={S.sideStats}>
          {syncing&&<div style={{ fontSize:10,color:"#22d3a0",letterSpacing:"0.1em",marginBottom:6 }}>● SYNC…</div>}
          {[["P&L Total",fmt(stats.total),stats.total>=0?"#22d3a0":"#ff4d6d"],["Win Rate",`${stats.wr}%`,"#bbb"],["Trades",stats.count,"#bbb"]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ fontSize:10,color:"#444" }}>{l}</span>
              <span style={{ fontSize:13,fontWeight:700,color:c }}>{v}</span>
            </div>
          ))}
          <button onClick={logout} style={{ ...S.linkBtn,marginTop:6,color:"#555",textAlign:"left" }}>→ Déconnexion</button>
        </div>
      </aside>

      {/* main */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={{ fontWeight:900,fontSize:22,color:"#e8e8e8",letterSpacing:"-0.5px" }}>
              {NAV.find(n=>n.id===view)?.label||"Dashboard"}
            </div>
            <div style={{ fontSize:11,color:"#444",marginTop:3 }}>
              {new Date().toLocaleDateString("fr-FR",{ weekday:"long",day:"numeric",month:"long",year:"numeric" })}
            </div>
          </div>
          {view!=="settings"&&(
            <button onClick={()=>setShowForm(true)} style={S.addBtn}>
              <span style={{ fontSize:18,lineHeight:1 }}>+</span><span> Nouveau Trade</span>
            </button>
          )}
        </div>

        {loading&&view!=="settings" ? (
          <div style={{ color:"#555",fontSize:13,padding:40,textAlign:"center" }}>Chargement…</div>
        ) : (<>

          {/* DASHBOARD */}
          {view==="dashboard"&&(<>
            <div style={S.kpiGrid}>
              {[
                { label:"P&L Total",value:fmt(stats.total),sub:`${stats.count} trades`,accent:stats.total>=0?"#22d3a0":"#ff4d6d" },
                { label:"Win Rate",value:`${stats.wr}%`,sub:`${stats.wins}W / ${stats.losses}L`,accent:"#7eb4ff" },
                { label:"Risk/Reward",value:`1 : ${stats.rr}`,sub:"Ratio moyen",accent:"#f5c842" },
                { label:"Meilleur",value:trades.length?fmt(Math.max(...trades.map(t=>t.pnl))):"—",sub:"Meilleur trade",accent:"#22d3a0" },
              ].map((k,i)=>(
                <div key={i} style={S.kpiCard}>
                  <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:k.accent }}/>
                  <div style={{ fontSize:9,color:"#444",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8 }}>{k.label}</div>
                  <div style={{ fontSize:20,fontWeight:900,color:k.accent,letterSpacing:"-0.5px" }}>{k.value}</div>
                  <div style={{ fontSize:10,color:"#444",marginTop:5 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {curve.length>1&&(
              <div style={S.card}>
                <div style={S.cardTitle}>Courbe d'Équité</div>
                <svg width="100%" height="130" style={{ display:"block",marginTop:14,overflow:"visible" }}>
                  <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3a0" stopOpacity="0.3"/><stop offset="100%" stopColor="#22d3a0" stopOpacity="0"/></linearGradient></defs>
                  {(()=>{
                    const pts=curve.map((p,i)=>({ x:`${(i/(curve.length-1))*100}%`,y:`${100-((p.cum-cMin)/cRange)*85-5}%` }));
                    const line=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
                    const area=`${line} L${pts[pts.length-1].x},100% L${pts[0].x},100% Z`;
                    return (<><path d={area} fill="url(#gr)"/><path d={line} fill="none" stroke="#22d3a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#0d1117" stroke="#22d3a0" strokeWidth="2"/>)}</>);
                  })()}
                </svg>
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}>
                  {curve.map((p,i)=><div key={i} style={{ fontSize:9,color:"#555" }}>{p.date}</div>)}
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardTitle}>Trades Récents</div>
              {trades.length===0&&<div style={{ color:"#444",fontSize:13,padding:"12px 0" }}>Aucun trade pour l'instant.</div>}
              {trades.slice(0,3).map(t=>(
                <div key={t.id} style={S.row} onClick={()=>{ setView("journal");setExpanded(t.id); }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <DirBadge dir={t.direction}/>
                    <div>
                      <div style={{ fontWeight:700,fontSize:14,color:"#e8e8e8" }}>{t.instrument}</div>
                      <div style={{ fontSize:11,color:"#555",marginTop:2 }}>{t.date} · {t.strategy}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700,color:t.pnl>=0?"#22d3a0":"#ff4d6d" }}>{fmt(t.pnl)}</div>
                    <Dots value={t.emotions}/>
                  </div>
                </div>
              ))}
            </div>
          </>)}

          {/* JOURNAL */}
          {view==="journal"&&(<>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:18 }}>
              {[
                { key:"instrument",opts:settings.instruments.filter(x=>x!=="Autre"),label:"Instrument" },
                { key:"direction",opts:["LONG","SHORT"],label:"Direction" },
                { key:"strategy",opts:settings.strategies.filter(x=>x!=="Autre"),label:"Stratégie" },
              ].map(f=>(
                <select key={f.key} value={filter[f.key]} onChange={e=>setFilter({...filter,[f.key]:e.target.value})} style={S.pill}>
                  <option value="">{f.label}</option>
                  {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              ))}
            </div>
            {filtered.length===0&&<div style={{ textAlign:"center",color:"#444",padding:60,fontSize:14 }}>Aucun trade. Clique sur <strong style={{ color:"#22d3a0" }}>+ Nouveau Trade</strong> !</div>}
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {filtered.map(t=>(
                <div key={t.id} style={{ ...S.card,cursor:"pointer",borderColor:expanded===t.id?"rgba(34,211,160,0.4)":"rgba(255,255,255,0.06)" }}
                  onClick={()=>setExpanded(expanded===t.id?null:t.id)}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0 }}>
                      <DirBadge dir={t.direction}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:700,fontSize:14,color:"#e8e8e8" }}>{t.instrument}</div>
                        <div style={{ fontSize:11,color:"#555",marginTop:2 }}>{t.date} · {t.session}</div>
                      </div>
                      <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>{(t.tags||[]).slice(0,2).map((tag,i)=><Tag key={i} label={tag}/>)}</div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ fontWeight:700,fontSize:16,color:t.pnl>=0?"#22d3a0":"#ff4d6d" }}>{fmt(t.pnl)}</div>
                      <Dots value={t.emotions}/>
                    </div>
                  </div>
                  {expanded===t.id&&(
                    <div style={{ marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12 }}>
                        {[["Entrée",t.entry],["Sortie",t.exit],["Taille",t.size]].map(([l,v])=>(
                          <div key={l} style={{ background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"9px 12px" }}>
                            <div style={{ fontSize:9,color:"#444",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4 }}>{l}</div>
                            <div style={{ fontSize:15,fontWeight:700,color:"#ddd" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:9,color:"#444",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4 }}>Stratégie</div>
                        <div style={{ color:"#bbb",fontSize:13 }}>{t.strategy}</div>
                      </div>
                      {t.notes&&<div style={{ fontSize:13,color:"#888",fontStyle:"italic",lineHeight:1.6,marginBottom:12 }}>"{t.notes}"</div>}
                      {(t.tags||[]).length>0&&<div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:14 }}>{t.tags.map((tag,i)=><Tag key={i} label={tag}/>)}</div>}
                      <button onClick={e=>{e.stopPropagation();deleteTrade(t.id);}} style={S.delBtn}>Supprimer</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>)}

          {/* ANALYTICS */}
          {view==="stats"&&(
            trades.length===0
              ? <div style={{ textAlign:"center",color:"#444",padding:60,fontSize:14 }}>Ajoute des trades pour voir tes statistiques.</div>
              : <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                  <BarCard title="P&L par Instrument" entries={byKey("instrument")} pos="#22d3a0" neg="#ff4d6d"/>
                  <BarCard title="P&L par Stratégie"  entries={byKey("strategy")}   pos="#7eb4ff" neg="#ff4d6d"/>
                  <div style={S.card}>
                    <div style={S.cardTitle}>Discipline Émotionnelle</div>
                    {(()=>{
                      const avg=(trades.reduce((s,t)=>s+t.emotions,0)/trades.length).toFixed(1);
                      const dist=[1,2,3,4,5].map(v=>({ v,n:trades.filter(t=>t.emotions===v).length }));
                      const mx=Math.max(...dist.map(d=>d.n),1);
                      return (<>
                        <div style={{ textAlign:"center",marginBottom:14 }}>
                          <div style={{ fontSize:38,fontWeight:900,color:"#f5c842" }}>{avg}</div>
                          <div style={{ fontSize:11,color:"#555" }}>Score moyen / 5</div>
                        </div>
                        <div style={{ display:"flex",gap:8,alignItems:"flex-end",height:52 }}>
                          {dist.map(d=>(
                            <div key={d.v} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                              <div style={{ width:"100%",borderRadius:"4px 4px 0 0",opacity:0.85,background:d.v>=4?"#22d3a0":d.v>=3?"#f5c842":"#ff4d6d",height:`${(d.n/mx)*42+4}px` }}/>
                              <span style={{ fontSize:10,color:"#555" }}>{d.v}</span>
                            </div>
                          ))}
                        </div>
                      </>);
                    })()}
                  </div>
                  <div style={S.card}>
                    <div style={S.cardTitle}>Sessions</div>
                    {(()=>{
                      const m={};
                      trades.forEach(t=>{ if(!m[t.session])m[t.session]={pnl:0,n:0}; m[t.session].pnl+=t.pnl; m[t.session].n++; });
                      return Object.entries(m).map(([s,d])=>(
                        <div key={s} style={S.row}>
                          <div><div style={{ fontWeight:600,color:"#ddd",fontSize:13 }}>{s}</div><div style={{ fontSize:11,color:"#555" }}>{d.n} trade{d.n>1?"s":""}</div></div>
                          <div style={{ fontWeight:700,color:d.pnl>=0?"#22d3a0":"#ff4d6d" }}>{fmt(d.pnl)}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
          )}

          {/* SETTINGS */}
          {view==="settings"&&(
            <SettingsPanel settings={settings} onChange={updateSettings}/>
          )}

        </>)}
      </main>

      {/* form modal */}
      {showForm&&(
        <div style={S.overlay} onClick={()=>setShowForm(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
              <div style={{ fontWeight:800,fontSize:18,color:"#e8e8e8",letterSpacing:"-0.5px" }}>Nouveau Trade</div>
              <button onClick={()=>setShowForm(false)} style={{ background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {[{ k:"date",l:"Date",t:"date" },{ k:"size",l:"Taille (lots)",t:"number" },{ k:"entry",l:"Entrée",t:"number" },{ k:"exit",l:"Sortie",t:"number" },{ k:"pnl",l:"P&L ($)",t:"number" }].map(f=>(
                <div key={f.k}><label style={S.lbl}>{f.l}</label><input type={f.t} step="any" value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} style={S.inp}/></div>
              ))}
              <div>
                <label style={S.lbl}>Instrument</label>
                <select value={form.instrument} onChange={e=>setForm({...form,instrument:e.target.value})} style={S.inp}>
                  {settings.instruments.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Direction</label>
                <select value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})} style={S.inp}>
                  {["LONG","SHORT"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Stratégie</label>
                <select value={form.strategy} onChange={e=>setForm({...form,strategy:e.target.value})} style={S.inp}>
                  {settings.strategies.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Session</label>
                <select value={form.session} onChange={e=>setForm({...form,session:e.target.value})} style={S.inp}>
                  {settings.sessions.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <label style={S.lbl}>Discipline émotionnelle</label>
              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                {[1,2,3,4,5].map(v=>(
                  <button key={v} onClick={()=>setForm({...form,emotions:v})} style={{ flex:1,padding:"10px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14,
                    border:`1px solid ${v<=form.emotions?"transparent":"rgba(255,255,255,0.08)"}`,
                    background:v<=form.emotions?(form.emotions>=4?"rgba(34,211,160,0.2)":form.emotions>=3?"rgba(245,200,66,0.2)":"rgba(255,77,109,0.2)"):"rgba(255,255,255,0.04)",
                    color:v<=form.emotions?(form.emotions>=4?"#22d3a0":form.emotions>=3?"#f5c842":"#ff4d6d"):"#444" }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:10 }}><label style={S.lbl}>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{ ...S.inp,height:66,resize:"vertical" }} placeholder="Analyse du trade…"/></div>
            <div style={{ marginTop:10 }}><label style={S.lbl}>Tags (séparés par virgule)</label><input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} style={S.inp} placeholder="A+, Erreur, FOMO…"/></div>
            <button onClick={addTrade} style={{ ...S.addBtn,width:"100%",marginTop:18,justifyContent:"center" }}>Enregistrer le Trade</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:{ display:"flex",minHeight:"100vh",background:"#0a0d12",fontFamily:"'DM Mono','Fira Code','Courier New',monospace",color:"#c8c8c8" },
  topbar:{ display:"none",position:"fixed",top:0,left:0,right:0,zIndex:60,background:"#0d1117",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"12px 16px",alignItems:"center",justifyContent:"space-between" },
  burgerBtn:{ background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#bbb",padding:"6px 10px",cursor:"pointer",fontSize:16,fontFamily:"inherit" },
  dropdown:{ position:"fixed",top:58,left:0,right:0,zIndex:59,background:"#0d1117",borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"8px 12px",flexDirection:"column",gap:4 },
  sidebar:{ width:210,background:"#0d1117",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",padding:"28px 0",position:"sticky",top:0,height:"100vh",flexShrink:0 },
  navBtn:{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500,textAlign:"left",width:"100%" },
  navActive:{ background:"rgba(34,211,160,0.1)",color:"#22d3a0" },
  sideStats:{ marginTop:"auto",padding:"18px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",gap:10 },
  main:{ flex:1,padding:"32px 22px",maxWidth:860,overflowY:"auto" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,gap:12 },
  addBtn:{ display:"flex",alignItems:"center",gap:6,background:"#22d3a0",color:"#0a0d12",border:"none",borderRadius:8,padding:"10px 16px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",flexShrink:0 },
  kpiGrid:{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16 },
  kpiCard:{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:16,position:"relative",overflow:"hidden" },
  card:{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:18,marginBottom:14 },
  cardTitle:{ fontSize:9,color:"#444",letterSpacing:"0.12em",textTransform:"uppercase" },
  row:{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer" },
  pill:{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 10px",color:"#bbb",fontSize:12,fontFamily:"inherit",cursor:"pointer",outline:"none" },
  overlay:{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 },
  modal:{ background:"#0d1117",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:24,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto" },
  lbl:{ fontSize:9,color:"#444",letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:5 },
  inp:{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"9px 10px",color:"#e8e8e8",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none" },
  delBtn:{ background:"rgba(255,77,109,0.1)",border:"1px solid rgba(255,77,109,0.2)",color:"#ff4d6d",borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit" },
  linkBtn:{ background:"none",border:"none",color:"#22d3a0",fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:0 },
};

const css=document.createElement("style");
css.textContent=`@media(max-width:640px){aside{display:none!important}main{padding:80px 14px 24px!important}}*{box-sizing:border-box}body{margin:0;background:#0a0d12}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px}select option{background:#1a1f2e}input,select,textarea{color-scheme:dark}`;
document.head.appendChild(css);
