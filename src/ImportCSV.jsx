import { useState, useRef } from "react";
import { supabase } from "./supabase.js";

/* ─────────────────────────────────────────
   PARSERS
───────────────────────────────────────── */

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    if (c === "\t" && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function detectBroker(headers) {
  const h = headers.join(",").toLowerCase();
  if (h.includes("ticket") || h.includes("open time") || h.includes("close time")) return "mt";
  if (h.includes("trade #") || h.includes("entry long") || h.includes("entry short") || h.includes("contracts")) return "tv";
  if (h.includes("deal") || h.includes("symbol") && h.includes("profit") && h.includes("swap")) return "mt5";
  return "unknown";
}

/* MT4 / MT5 — une ligne = un trade fermé */
function parseMT(rows, headers) {
  const idx = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const iTicket   = idx("ticket");
  const iOpenTime = idx("open time") !== -1 ? idx("open time") : idx("open");
  const iType     = idx("type");
  const iSize     = idx("size") !== -1 ? idx("size") : idx("volume");
  const iSymbol   = idx("symbol");
  const iPrice    = headers.findIndex((h, i) => h.toLowerCase().includes("price") && i < 7);
  const iCloseTime= idx("close time") !== -1 ? idx("close time") : idx("close");
  const iClosePrice = headers.findLastIndex(h => h.toLowerCase().includes("price"));
  const iProfit   = headers.lastIndexOf(headers.find(h => h.toLowerCase() === "profit") || "profit");
  const iProfitFallback = headers.findLastIndex(h => h.toLowerCase().includes("profit"));
  const profitIdx = iProfit !== -1 ? iProfit : iProfitFallback;
  const iSwap     = idx("swap");
  const iComm     = idx("commission") !== -1 ? idx("commission") : idx("comm");

  const trades = [];
  for (const row of rows) {
    if (row.length < 5) continue;
    const type = (row[iType] || "").toLowerCase();
    if (!["buy", "sell", "buy limit", "sell limit", "buy stop", "sell stop"].some(t => type.includes(t))) continue;

    // Date : "2024.01.15 09:30" → "2024-01-15"
    const rawDate = row[iOpenTime] || row[iCloseTime] || "";
    const dateStr = rawDate.replace(/\./g, "-").slice(0, 10);
    if (!dateStr || dateStr.length < 10) continue;

    const pnlRaw   = parseFloat(row[profitIdx]) || 0;
    const swap     = iSwap !== -1 ? parseFloat(row[iSwap]) || 0 : 0;
    const comm     = iComm !== -1 ? parseFloat(row[iComm]) || 0 : 0;
    const pnl      = pnlRaw + swap + comm;

    trades.push({
      date:       dateStr,
      instrument: (row[iSymbol] || "Autre").toUpperCase(),
      direction:  type.includes("sell") ? "SHORT" : "LONG",
      entry:      parseFloat(row[iPrice]) || 0,
      exit:       iClosePrice !== -1 ? parseFloat(row[iClosePrice]) || 0 : 0,
      size:       parseFloat(row[iSize]) || 0,
      pnl,
      strategy:   "Import MT",
      session:    guessSession(rawDate),
      emotions:   3,
      notes:      `Import MT4/MT5 — ticket #${row[iTicket] || "?"}`,
      tags:       ["Import"],
    });
  }
  return trades;
}

/* TradingView — les trades sont en paires Entry/Exit */
function parseTV(rows, headers) {
  const idx = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const iNum    = idx("trade #") !== -1 ? idx("trade #") : 0;
  const iDate   = idx("date") !== -1 ? idx("date") : idx("time");
  const iType   = idx("type");
  const iContr  = idx("contracts") !== -1 ? idx("contracts") : idx("qty");
  const iPrice  = idx("price");
  const iProfit = idx("profit") !== -1 ? idx("profit") : idx("pnl");

  // Grouper par numéro de trade
  const map = {};
  for (const row of rows) {
    if (row.length < 4) continue;
    const num  = row[iNum];
    const type = (row[iType] || "").toLowerCase();
    if (!num) continue;
    if (!map[num]) map[num] = {};
    if (type.includes("entry")) map[num].entry = row;
    else if (type.includes("exit")) map[num].exit = row;
  }

  const trades = [];
  for (const [num, pair] of Object.entries(map)) {
    if (!pair.entry || !pair.exit) continue;
    const entryRow = pair.entry;
    const exitRow  = pair.exit;

    const rawDate  = entryRow[iDate] || "";
    const dateStr  = rawDate.slice(0, 10).replace(/\//g, "-");
    if (!dateStr || dateStr.length < 10) continue;

    const type     = (entryRow[iType] || "").toLowerCase();
    const profitRaw = (exitRow[iProfit] || "0").replace(/[%$,]/g, "");
    const pnl      = parseFloat(profitRaw) || 0;

    trades.push({
      date:       dateStr,
      instrument: "Autre",     // TradingView n'inclut pas le symbole dans l'export standard
      direction:  type.includes("short") ? "SHORT" : "LONG",
      entry:      parseFloat(entryRow[iPrice]) || 0,
      exit:       parseFloat(exitRow[iPrice])  || 0,
      size:       parseFloat(entryRow[iContr]) || 0,
      pnl,
      strategy:   "Import TV",
      session:    guessSession(rawDate),
      emotions:   3,
      notes:      `Import TradingView — trade #${num}`,
      tags:       ["Import"],
    });
  }
  return trades;
}

function guessSession(dateStr) {
  const hour = parseInt((dateStr || "").slice(11, 13), 10);
  if (isNaN(hour)) return "London";
  if (hour >= 2  && hour < 9)  return "Asian";
  if (hour >= 9  && hour < 13) return "London";
  if (hour >= 13 && hour < 17) return "Overlap";
  return "New York";
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
  if (lines.length < 2) return { error: "Fichier vide ou trop court." };

  const headers = parseCSVLine(lines[0]);
  const broker  = detectBroker(headers);

  if (broker === "unknown") {
    return { error: "Format non reconnu. Assure-toi d'exporter depuis MT4/MT5 ou TradingView." };
  }

  const rows = lines.slice(1).map(parseCSVLine).filter(r => r.length > 2);

  let trades = [];
  if (broker === "mt" || broker === "mt5") trades = parseMT(rows, headers);
  else if (broker === "tv")                trades = parseTV(rows, headers);

  if (trades.length === 0) {
    return { error: "Aucun trade détecté. Vérifie que le fichier contient bien des trades fermés." };
  }

  return { trades, broker };
}

/* ─────────────────────────────────────────
   COMPOSANT
───────────────────────────────────────── */

export default function ImportCSV({ session, onImported }) {
  const [step, setStep]       = useState("idle");   // idle | preview | importing | done | error
  const [trades, setTrades]   = useState([]);
  const [broker, setBroker]   = useState("");
  const [errMsg, setErrMsg]   = useState("");
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped]   = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { trades: parsed, broker: b, error } = parseCSV(e.target.result);
      if (error) { setErrMsg(error); setStep("error"); return; }
      setTrades(parsed);
      setBroker(b);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function confirmImport() {
    setStep("importing");
    setProgress(0);
    let ok = 0, skip = 0;
    const BATCH = 20;

    for (let i = 0; i < trades.length; i += BATCH) {
      const batch = trades.slice(i, i + BATCH).map(t => ({ ...t, user_id: session.user.id }));
      const { error } = await supabase.from("trades").insert(batch);
      if (error) skip += batch.length;
      else ok += batch.length;
      setProgress(Math.round(((i + BATCH) / trades.length) * 100));
    }

    setImported(ok); setSkipped(skip);
    setStep("done");
    onImported?.();
  }

  function reset() {
    setStep("idle"); setTrades([]); setBroker(""); setErrMsg("");
    setProgress(0); setImported(0); setSkipped(0);
  }

  const brokerLabel = broker === "mt" || broker === "mt5" ? "MetaTrader 4/5" : broker === "tv" ? "TradingView" : broker;

  return (
    <div>
      {/* ── Instructions ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Comment exporter depuis MetaTrader ?</div>
        <ol style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12, color: "#888", lineHeight: 2 }}>
          <li>Ouvre l'<strong style={{ color: "#ddd" }}>Historique du compte</strong> (onglet Terminal)</li>
          <li>Clic droit → <strong style={{ color: "#ddd" }}>Enregistrer en tant que rapport détaillé</strong></li>
          <li>Choisis le format <strong style={{ color: "#22d3a0" }}>CSV</strong> et enregistre</li>
        </ol>
        <div style={S.cardTitle2}>Comment exporter depuis TradingView ?</div>
        <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#888", lineHeight: 2 }}>
          <li>Ouvre ton <strong style={{ color: "#ddd" }}>Strategy Tester</strong></li>
          <li>Onglet <strong style={{ color: "#ddd" }}>Liste des trades</strong></li>
          <li>Clique sur l'icône <strong style={{ color: "#22d3a0" }}>↓ Exporter</strong> en haut à droite</li>
        </ol>
      </div>

      {/* ── Zone de drop ── */}
      {(step === "idle" || step === "error") && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            ...S.dropzone,
            borderColor: dragOver ? "#22d3a0" : step === "error" ? "rgba(255,77,109,0.4)" : "rgba(255,255,255,0.1)",
            background: dragOver ? "rgba(34,211,160,0.05)" : "rgba(255,255,255,0.02)",
          }}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#bbb", marginBottom: 6 }}>
            {dragOver ? "Dépose ici !" : "Glisse ton fichier CSV ici"}
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>ou clique pour choisir un fichier</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>MT4 · MT5 · TradingView</div>

          {step === "error" && (
            <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", borderRadius: 8, color: "#ff4d6d", fontSize: 12 }}>
              ⚠ {errMsg}
            </div>
          )}
        </div>
      )}

      {/* ── Prévisualisation ── */}
      {step === "preview" && (
        <div>
          <div style={{ ...S.card, borderColor: "rgba(34,211,160,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 12, color: "#22d3a0", fontWeight: 700 }}>✓ {brokerLabel} détecté</span>
                <span style={{ fontSize: 12, color: "#555", marginLeft: 12 }}>{trades.length} trades trouvés</span>
              </div>
              <button onClick={reset} style={S.ghostBtn}>✕ Annuler</button>
            </div>

            {/* Stats rapides */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total trades", value: trades.length, color: "#7eb4ff" },
                { label: "P&L estimé",   value: (trades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : "") + trades.reduce((s, t) => s + t.pnl, 0).toFixed(0) + " $", color: trades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "#22d3a0" : "#ff4d6d" },
                { label: "Longs / Shorts", value: `${trades.filter(t => t.direction === "LONG").length} / ${trades.filter(t => t.direction === "SHORT").length}`, color: "#f5c842" },
              ].map((k, i) => (
                <div key={i} style={S.miniKpi}>
                  <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Aperçu des 5 premiers trades */}
            <div style={S.cardTitle}>Aperçu (5 premiers trades)</div>
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ color: "#444" }}>
                    {["Date", "Instrument", "Dir.", "Entrée", "Sortie", "Taille", "P&L"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 5).map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={S.td}>{t.date}</td>
                      <td style={S.td}><strong style={{ color: "#ddd" }}>{t.instrument}</strong></td>
                      <td style={S.td}><span style={{ color: t.direction === "LONG" ? "#22d3a0" : "#ff4d6d", fontWeight: 700, fontSize: 10 }}>{t.direction}</span></td>
                      <td style={S.td}>{t.entry || "—"}</td>
                      <td style={S.td}>{t.exit || "—"}</td>
                      <td style={S.td}>{t.size}</td>
                      <td style={S.td}><span style={{ fontWeight: 700, color: t.pnl >= 0 ? "#22d3a0" : "#ff4d6d" }}>{(t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(0)} $</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trades.length > 5 && (
                <div style={{ textAlign: "center", fontSize: 11, color: "#444", padding: "8px 0" }}>… et {trades.length - 5} autres trades</div>
              )}
            </div>
          </div>

          <button onClick={confirmImport} style={{ ...S.importBtn, width: "100%" }}>
            ↑ Importer {trades.length} trades dans EDGE
          </button>
        </div>
      )}

      {/* ── Import en cours ── */}
      {step === "importing" && (
        <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 13, color: "#22d3a0", marginBottom: 20, letterSpacing: "0.1em" }}>IMPORT EN COURS…</div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", background: "#22d3a0", borderRadius: 99, width: `${Math.min(progress, 100)}%`, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>{Math.min(progress, 100)}%</div>
        </div>
      )}

      {/* ── Résultat ── */}
      {step === "done" && (
        <div style={{ ...S.card, borderColor: "rgba(34,211,160,0.25)", textAlign: "center", padding: "36px 24px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#22d3a0", marginBottom: 6 }}>Import terminé !</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
            <span style={{ color: "#22d3a0", fontWeight: 700 }}>{imported}</span> trades importés
            {skipped > 0 && <span style={{ color: "#ff4d6d", marginLeft: 8 }}> · {skipped} ignorés</span>}
          </div>
          <button onClick={reset} style={S.ghostBtn}>Importer un autre fichier</button>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12, padding: 18, marginBottom: 14,
  },
  cardTitle: { fontSize: 9, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 },
  cardTitle2: { fontSize: 9, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 16, marginBottom: 4 },
  dropzone: {
    border: "2px dashed", borderRadius: 14, padding: "48px 20px",
    textAlign: "center", cursor: "pointer", transition: "all 0.2s", marginBottom: 14,
  },
  miniKpi: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 8, padding: "10px 12px",
  },
  td: { padding: "7px 8px", color: "#bbb", verticalAlign: "middle" },
  importBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "#22d3a0", color: "#0a0d12", border: "none", borderRadius: 8,
    padding: "12px 20px", fontWeight: 800, fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", letterSpacing: "0.05em",
  },
  ghostBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#bbb", padding: "8px 14px", fontSize: 12,
    cursor: "pointer", fontFamily: "inherit",
  },
};
