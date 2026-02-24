"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BG_DARK, BG_CARD, BG_SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ERROR, SUCCESS, WARNING, INFO,
  inputStyle, btnGreen, btnMuted, globalResetCSS,
} from "@/lib/admin-theme";

interface AuditEntry {
  id: string;
  source: "voice" | "activity";
  type: string;
  description: string;
  wasUndone?: boolean;
  adminId?: string;
  playerName?: string;
  teamName?: string;
  gameweekId?: number;
  createdAt: string;
}

const SOURCE_COLORS: Record<string, string> = {
  voice: "#8B5CF6",
  activity: INFO,
};

const TYPE_COLORS: Record<string, string> = {
  goal: SUCCESS,
  assist: ACCENT,
  yellow_card: WARNING,
  red_card: ERROR,
  clean_sheet: INFO,
  bonus: "#F59E0B",
  voice_command: "#8B5CF6",
};

export default function AuditLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    loadEntries();
  }, [typeFilter, page]);

  async function loadEntries() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        q: search,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(0);
    loadEntries();
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <style>{globalResetCSS(BG_DARK)}</style>
      <div style={{ minHeight: "100vh", background: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Outfit', system-ui, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={{ ...btnMuted, marginBottom: 16 }}>← Back to Dashboard</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Audit Log</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>
            Combined voice commands and activity feed entries.
          </p>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{ ...inputStyle, maxWidth: 280 }}
            />
            <button onClick={handleSearch} style={{ ...btnGreen, padding: "7px 14px" }}>Search</button>

            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              style={{ ...inputStyle, maxWidth: 160, cursor: "pointer" }}
            >
              <option value="all">All Sources</option>
              <option value="voice">Voice Commands</option>
              <option value="activity">Activity Feed</option>
            </select>
          </div>

          {/* Stats bar */}
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>
            {total} entries found
            {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>No audit entries found.</div>
          ) : (
            <div style={{ borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {entries.map((entry, i) => (
                <div key={entry.id} style={{
                  padding: "12px 14px",
                  background: i % 2 === 0 ? BG_CARD : BG_DARK,
                  borderBottom: `1px solid ${BORDER}22`,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}>
                  {/* Source badge */}
                  <div style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: `${SOURCE_COLORS[entry.source] || TEXT_MUTED}22`,
                    color: SOURCE_COLORS[entry.source] || TEXT_MUTED,
                    flexShrink: 0,
                    minWidth: 60,
                    textAlign: "center",
                  }}>
                    {entry.source}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>
                      {entry.description}
                      {entry.wasUndone && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: WARNING, fontWeight: 600 }}>UNDONE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, display: "flex", gap: 10 }}>
                      <span style={{
                        padding: "1px 6px", borderRadius: 3, fontSize: 10,
                        background: `${TYPE_COLORS[entry.type] || TEXT_MUTED}18`,
                        color: TYPE_COLORS[entry.type] || TEXT_MUTED,
                      }}>
                        {entry.type}
                      </span>
                      {entry.gameweekId && <span>GW {entry.gameweekId}</span>}
                      {entry.playerName && <span>{entry.playerName}</span>}
                      {entry.teamName && <span>{entry.teamName}</span>}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div style={{ fontSize: 11, color: TEXT_MUTED, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {formatDate(entry.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ ...btnMuted, opacity: page === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ padding: "7px 14px", fontSize: 12, color: TEXT_MUTED }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{ ...btnMuted, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
