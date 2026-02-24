"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING,
  inputStyle, btnGreen, btnMuted, btnDanger, globalResetCSS,
} from "@/lib/admin-theme";

interface Team { id: number; name: string; short_name: string }

interface ParsedPlayer {
  name: string;
  web_name: string;
  position: string;
  team_short: string;
  price: number;
  is_lady: boolean;
  team_id: number | null;
  error: string | null;
}

const EXPECTED_COLS = ["name", "web_name", "position", "team_short", "price", "is_lady"];
const VALID_POS = ["GK", "DEF", "MID", "FWD"];

export default function ImportPlayersPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [parsed, setParsed] = useState<ParsedPlayer[]>([]);
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/teams").then((r) => r.json()).then((d) => setTeams(d.teams || []));
  }, []);

  function parseCSV(text: string) {
    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { setParsed([]); return; }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const teamMap = new Map<string, number>();
    for (const t of teams) {
      teamMap.set(t.short_name.toLowerCase(), t.id);
      teamMap.set(t.name.toLowerCase(), t.id);
    }

    const rows: ParsedPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => { obj[h] = cols[idx] || ""; });

      const pos = (obj["position"] || "").toUpperCase();
      const teamShort = obj["team_short"] || "";
      const teamId = teamMap.get(teamShort.toLowerCase()) ?? null;

      let error: string | null = null;
      if (!obj["name"]) error = "Missing name";
      else if (!obj["web_name"]) error = "Missing web_name";
      else if (!VALID_POS.includes(pos)) error = `Invalid position: ${pos}`;
      else if (!teamId) error = `Unknown team: ${teamShort}`;

      rows.push({
        name: obj["name"] || "",
        web_name: obj["web_name"] || "",
        position: pos,
        team_short: teamShort,
        price: parseFloat(obj["price"]) || 5.0,
        is_lady: obj["is_lady"] === "true" || obj["is_lady"] === "1",
        team_id: teamId,
        error,
      });
    }
    setParsed(rows);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
      parseCSV(text);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handlePaste(text: string) {
    setRawText(text);
    parseCSV(text);
    setResult(null);
  }

  async function doImport() {
    const valid = parsed.filter((p) => !p.error);
    if (valid.length === 0) return;

    setImporting(true);
    setResult(null);
    try {
      const body = valid.map((p) => ({
        name: p.name,
        web_name: p.web_name,
        position: p.position,
        team_id: p.team_id,
        now_cost: p.price,
        is_lady: p.is_lady,
      }));

      const res = await fetch("/api/admin/players/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: body }),
      });
      const data = await res.json();

      setResult({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        errors: data.validationErrors || [],
      });
    } catch (e: any) {
      setResult({ imported: 0, skipped: 0, errors: [e.message] });
    } finally {
      setImporting(false);
    }
  }

  const validCount = parsed.filter((p) => !p.error).length;
  const errorCount = parsed.filter((p) => p.error).length;

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Import Players (CSV)</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            Upload a CSV file or paste CSV data to bulk-import players.
          </p>

          {/* Expected format */}
          <div style={{ padding: 12, borderRadius: 8, background: BG_CARD, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", marginBottom: 6 }}>Expected CSV Format</div>
            <code style={{ fontSize: 12, color: ACCENT, fontFamily: "'JetBrains Mono', monospace" }}>
              name,web_name,position,team_short,price,is_lady
            </code>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
              Positions: GK, DEF, MID, FWD · team_short must match an existing team short name · price in millions · is_lady: true/false or 1/0
            </div>
          </div>

          {/* Upload area */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={btnGreen}>Upload CSV File</button>
            <span style={{ color: TEXT_MUTED, fontSize: 13, alignSelf: "center" }}>or paste below</span>
          </div>

          <textarea
            placeholder="Paste CSV here..."
            value={rawText}
            onChange={(e) => handlePaste(e.target.value)}
            rows={6}
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, resize: "vertical", marginBottom: 16 }}
          />

          {/* Preview Table */}
          {parsed.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: SUCCESS }}>{validCount} valid</span>
                  {errorCount > 0 && <span style={{ color: ERROR, marginLeft: 12 }}>{errorCount} errors</span>}
                  <span style={{ color: TEXT_MUTED, marginLeft: 12 }}>of {parsed.length} rows</span>
                </div>
                <button
                  onClick={doImport}
                  disabled={importing || validCount === 0}
                  style={{ ...btnGreen, opacity: importing || validCount === 0 ? 0.5 : 1 }}
                >
                  {importing ? "Importing..." : `Import ${validCount} Player${validCount !== 1 ? "s" : ""}`}
                </button>
              </div>

              <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: BG_SURFACE, color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>#</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Web Name</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Pos</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Team</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>Price</th>
                        <th style={{ padding: "8px", textAlign: "center" }}>Lady</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((p, i) => (
                        <tr key={i} style={{ background: p.error ? `${ERROR}0A` : i % 2 === 0 ? BG_CARD : BG_DARK, borderBottom: `1px solid ${BORDER}22` }}>
                          <td style={{ padding: "6px 8px", color: TEXT_MUTED }}>{i + 1}</td>
                          <td style={{ padding: "6px 8px" }}>{p.name || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{p.web_name || "—"}</td>
                          <td style={{ padding: "6px 8px", color: p.position && VALID_POS.includes(p.position) ? ACCENT : ERROR }}>{p.position || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{p.team_short || "—"}{p.team_id ? "" : <span style={{ color: ERROR }}> ✕</span>}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{p.price.toFixed(1)}m</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>{p.is_lady ? "Yes" : "—"}</td>
                          <td style={{ padding: "6px 8px", fontSize: 11 }}>
                            {p.error ? <span style={{ color: ERROR }}>{p.error}</span> : <span style={{ color: SUCCESS }}>OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div style={{
              padding: 14,
              borderRadius: 8,
              background: result.imported > 0 ? `${SUCCESS}15` : `${ERROR}15`,
              border: `1px solid ${result.imported > 0 ? SUCCESS : ERROR}44`,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: result.imported > 0 ? SUCCESS : ERROR, marginBottom: 4 }}>
                {result.imported > 0 ? `Successfully imported ${result.imported} player${result.imported !== 1 ? "s" : ""}` : "Import failed"}
              </div>
              {result.skipped > 0 && (
                <div style={{ fontSize: 12, color: WARNING }}>{result.skipped} row(s) skipped due to validation errors</div>
              )}
              {result.errors.length > 0 && (
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
                  {result.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
                  {result.errors.length > 10 && <div>...and {result.errors.length - 10} more</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
