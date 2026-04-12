import { useMemo, useState } from "react";

const fmt  = (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(0) + " $";
const DAYS  = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function intensity(pnl, maxAbs) {
  if (maxAbs === 0) return 0;
  return Math.min(1, Math.abs(pnl) / maxAbs);
}

function dayColor(pnl, maxAbs) {
  if (pnl === undefined) return { bg: "transparent", border: "transparent", text: "#333" };
  const t = intensity(pnl, maxAbs);
  if (pnl > 0) {
    const g = Math.round(80 + t * 131);
    const alpha = 0.1 + t * 0.55;
    return {
      bg: `rgba(34,${g},${Math.round(160 - t * 60)},${alpha})`,
      border: `rgba(34,211,160,${0.2 + t * 0.6})`,
      text: t > 0.4 ? "#0a0d12" : "#22d3a0",
    };
  }
  const alpha = 0.1 + t * 0.55;
  return {
    bg: `rgba(255,${Math.round(77 - t * 30)},${Math.round(109 - t * 50)},${alpha})`,
    border: `rgba(255,77,109,${0.2 + t * 0.6})`,
    text: t > 0.4 ? "#0a0d12" : "#ff4d6d",
  };
}

/* ── Petit tooltip ── */
function Tooltip({ day, trades }) {
  if (!trades || trades.length === 0) return null;
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  return (
    <div style={{
      position: "absolute", zIndex: 200, bottom: "calc(100% + 8px)", left: "50%",
      transform: "translateX(-50%)", background: "#161b26",
      border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
      padding: "10px 14px", minWidth: 160, pointerEvents: "none",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em" }}>
        {day}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: pnl >= 0 ? "#22d3a0" : "#ff4d6d", marginBottom: 4 }}>
        {fmt(pnl)}
      </div>
      <div style={{ fontSize: 11, color: "#666" }}>
        {trades.length} trade{trades.length > 1 ? "s" : ""} · {wins}W/{trades.length - wins}L
      </div>
      {trades.slice(0, 3).map((t, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 11, color: "#888" }}>{t.instrument}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.pnl >= 0 ? "#22d3a0" : "#ff4d6d" }}>{fmt(t.pnl)}</span>
        </div>
      ))}
      {trades.length > 3 && (
        <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>+{trades.length - 3} autres</div>
      )}
    </div>
  );
}

/* ── Cellule de jour ── */
function DayCell({ dateStr, dayNum, trades, maxAbs, isToday, isOtherMonth }) {
  const [hover, setHover] = useState(false);
  const pnl = trades && trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) : undefined;
  const col = dayColor(pnl, maxAbs);

  if (!dayNum) return <div style={{ minHeight: 68 }} />;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 68, borderRadius: 10, padding: "8px 10px",
        background: pnl !== undefined ? col.bg : (isOtherMonth ? "transparent" : "rgba(255,255,255,0.015)"),
        border: `1px solid ${pnl !== undefined ? col.border : (isToday ? "rgba(34,211,160,0.4)" : "rgba(255,255,255,0.05)")}`,
        cursor: pnl !== undefined ? "pointer" : "default",
        transition: "all 0.15s ease",
        position: "relative",
        transform: hover && pnl !== undefined ? "scale(1.03)" : "scale(1)",
        boxShadow: hover && pnl !== undefined ? "0 4px 20px rgba(0,0,0,0.4)" : "none",
        opacity: isOtherMonth ? 0.35 : 1,
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: isToday ? 900 : 500,
        color: isToday ? "#22d3a0" : (pnl !== undefined ? col.text : "#444"),
        marginBottom: 6,
      }}>
        {isToday ? <span style={{ background: "#22d3a0", color: "#0a0d12", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>{dayNum}</span> : dayNum}
      </div>

      {pnl !== undefined && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: col.text, letterSpacing: "-0.3px" }}>
            {fmt(pnl)}
          </div>
          <div style={{ fontSize: 9, color: col.text, opacity: 0.7, marginTop: 2 }}>
            {trades.length} trade{trades.length > 1 ? "s" : ""}
          </div>
        </>
      )}

      {hover && pnl !== undefined && (
        <Tooltip day={dateStr} trades={trades} />
      )}
    </div>
  );
}

/* ── Composant principal ── */
export default function CalendarView({ trades }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  /* Regrouper les trades par date */
  const byDate = useMemo(() => {
    const m = {};
    trades.forEach(t => {
      const d = t.date?.slice(0, 10);
      if (!d) return;
      if (!m[d]) m[d] = [];
      m[d].push(t);
    });
    return m;
  }, [trades]);

  /* Stats du mois */
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthTrades = trades.filter(t => t.date?.startsWith(prefix));
    const pnl   = monthTrades.reduce((s, t) => s + t.pnl, 0);
    const wins  = monthTrades.filter(t => t.pnl > 0);
    const losses = monthTrades.filter(t => t.pnl < 0);
    const days  = Object.keys(byDate).filter(d => d.startsWith(prefix));
    const winDays = days.filter(d => byDate[d].reduce((s, t) => s + t.pnl, 0) > 0).length;
    return { pnl, count: monthTrades.length, wins: wins.length, losses: losses.length, days: days.length, winDays };
  }, [trades, byDate, year, month]);

  /* Max absolu du mois pour normaliser les couleurs */
  const maxAbs = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const vals = Object.entries(byDate)
      .filter(([d]) => d.startsWith(prefix))
      .map(([, ts]) => Math.abs(ts.reduce((s, t) => s + t.pnl, 0)));
    return Math.max(...vals, 1);
  }, [byDate, year, month]);

  /* Construire la grille (Lun→Dim) */
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    // 0=Sun…6=Sat → convertir en Lun=0…Dim=6
    const startDow = (first.getDay() + 6) % 7;
    const cells = [];
    // jours du mois précédent (grisés)
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      cells.push({ dayNum: d.getDate(), dateStr: d.toISOString().slice(0, 10), otherMonth: true });
    }
    // jours du mois
    for (let d = 1; d <= last.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ dayNum: d, dateStr, otherMonth: false });
    }
    // compléter la dernière semaine
    const rem = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= rem; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ dayNum: d.getDate(), dateStr: d.toISOString().slice(0, 10), otherMonth: true });
    }
    return cells;
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const todayStr  = today.toISOString().slice(0, 10);

  return (
    <div>
      {/* Header navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={prevMonth} style={S.navBtn}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#e8e8e8", letterSpacing: "-0.5px" }}>
            {MONTHS[month]} {year}
          </div>
        </div>
        <button onClick={nextMonth} style={S.navBtn}>›</button>
      </div>

      {/* KPIs du mois */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "P&L du mois",   value: fmt(monthStats.pnl),  accent: monthStats.pnl >= 0 ? "#22d3a0" : "#ff4d6d" },
          { label: "Trades",        value: monthStats.count,      accent: "#7eb4ff" },
          { label: "Jours tradés",  value: monthStats.days,       accent: "#f5c842" },
          { label: "Jours gagnants",value: `${monthStats.winDays}/${monthStats.days}`, accent: "#22d3a0" },
        ].map((k, i) => (
          <div key={i} style={S.kpi}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: k.accent }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, fontSize: 10, color: "#444" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[0.2, 0.5, 0.85].map((a, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: `rgba(34,211,160,${a})`, border: `1px solid rgba(34,211,160,${a + 0.2})` }} />
          ))}
          <span>Profit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[0.2, 0.5, 0.85].map((a, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: `rgba(255,77,109,${a})`, border: `1px solid rgba(255,77,109,${a + 0.2})` }} />
          ))}
          <span>Perte</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }} />
          <span>Pas de trade</span>
        </div>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#444", fontWeight: 700, letterSpacing: "0.08em", paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        {grid.map((cell, i) => (
          <DayCell
            key={i}
            dayNum={cell.dayNum}
            dateStr={cell.dateStr}
            trades={byDate[cell.dateStr] || []}
            maxAbs={maxAbs}
            isToday={cell.dateStr === todayStr}
            isOtherMonth={cell.otherMonth}
          />
        ))}
      </div>

      {/* Résumé W/L en bas */}
      {monthStats.count > 0 && (
        <div style={{ marginTop: 20, padding: "14px 18px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          {[
            { label: "Gagnants", value: monthStats.wins, color: "#22d3a0" },
            { label: "Perdants", value: monthStats.losses, color: "#ff4d6d" },
            { label: "Win Rate", value: monthStats.count ? `${((monthStats.wins / monthStats.count) * 100).toFixed(0)}%` : "—", color: "#7eb4ff" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 3, letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  navBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, color: "#bbb", cursor: "pointer", fontSize: 20, width: 36, height: 36,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
    transition: "all 0.15s",
  },
  kpi: {
    background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10, padding: "12px 14px",
  },
};
