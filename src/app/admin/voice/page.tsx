'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

// ── Theme (matches app dark mode: --background, --card, --primary, etc.) ──
const ACCENT = "#C8102E";
const ACCENT_LIGHT = "#D4545D";
const BG_DARK = "#17191E";
const BG_CARD = "#1C1E23";
const BG_SURFACE = "#252729";
const BORDER = "#343740";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_SECONDARY = "#A0A0A0";
const TEXT_MUTED = "#808080";
const ERROR = "#C8102E";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  appearance:  { icon: "👤", label: "APP", color: TEXT_SECONDARY },
  goal:        { icon: "⚽", label: "GLS", color: ACCENT_LIGHT },
  assist:      { icon: "🅰️", label: "AST", color: "#60A5FA" },
  clean_sheet: { icon: "🛡️", label: "CS",  color: "#34D399" },
  own_goal:    { icon: "🔴", label: "OG",  color: ERROR },
  pen_miss:    { icon: "❌", label: "PM",  color: ERROR },
  pen_save:    { icon: "🧤", label: "PS",  color: SUCCESS },
  save_3:      { icon: "🧤", label: "S3",  color: "#818CF8" },
  yellow:      { icon: "🟨", label: "YC",  color: WARNING },
  red:         { icon: "🟥", label: "RC",  color: ERROR },
};

const ACTION_LIMITS: Record<string, number> = {
  appearance: 1, goal: 10, assist: 10, clean_sheet: 1,
  own_goal: 5, pen_miss: 5, pen_save: 5, save_3: 10,
  yellow: 1, red: 1,
};

const POS_COLORS: Record<string, string> = {
  GKP: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444",
};

type Match = {
  id: number;
  gameweek_id: number;
  home_team: string;
  away_team: string;
  home_short?: string;
  away_short?: string;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
};

type ViewState = "capture" | "confirm" | "history" | "scoring" | "manual";

function validate(entries: any[], matchId: number | null) {
  const warnings: { message: string }[] = [];
  const errors: { message: string }[] = [];
  if (!matchId) errors.push({ message: "No match selected." });
  if (entries.length === 0) errors.push({ message: "No entries to commit." });
  for (const entry of entries) {
    const name = entry.player?.web_name || entry.spoken_name;
    for (const a of entry.actions) {
      const max = ACTION_LIMITS[a.action];
      if (max && a.quantity > max) errors.push({ message: `${name}: ${a.action} ×${a.quantity} exceeds max (${max})` });
    }
    const hasY = entry.actions.some((a: any) => a.action === "yellow");
    const hasR = entry.actions.some((a: any) => a.action === "red");
    if (hasY && hasR) warnings.push({ message: `${name}: both yellow and red — second yellow?` });
  }
  return { valid: errors.length === 0, warnings, errors };
}

const formatTime = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function VoiceAdminPage() {
  const [view, setView] = useState<ViewState>("capture");
  const [matches, setMatches] = useState<Match[]>([]);
  const { data: session } = useSession();
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchError, setMatchError] = useState("");

  // Read URL hash to auto-select tab (e.g. /admin/voice#scoring)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as ViewState;
    if (["capture", "history", "scoring", "manual"].includes(hash)) {
      setView(hash);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voice-admin/matches");
        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches || []);
          const first = (data.matches || []).find((m: Match) => !m.is_final);
          if (first) setSelectedMatchId(first.id);
        } else {
          setMatchError("Failed to load matches");
        }
      } catch {
        setMatchError("Could not connect — is dev server running?");
      }
      setLoadingMatches(false);
    })();
  }, []);

  const handleResult = useCallback((result: any) => {
    setPipelineResult(result);
    if (result.resolved?.length > 0 || result.unresolved?.length > 0) setView("confirm");
  }, []);

  const handleConfirm = useCallback((commitResult: any) => {
    setHistory(prev => [{ timestamp: new Date().toISOString(), transcript: pipelineResult?.transcript, matchId: selectedMatchId, result: commitResult }, ...prev]);
  }, [pipelineResult, selectedMatchId]);

  const handleCancel = useCallback(() => { setPipelineResult(null); setView("capture"); }, []);

  const matchLabel = (m: Match) => {
    const score = m.is_played ? ` (${m.home_goals ?? 0}-${m.away_goals ?? 0})` : "";
    return `${m.home_short || m.home_team} vs ${m.away_short || m.away_team}${score}`;
  };

  const matchesByGw = useMemo(() => {
    const grouped: Record<number, Match[]> = {};
    for (const m of matches) {
      if (!grouped[m.gameweek_id]) grouped[m.gameweek_id] = [];
      grouped[m.gameweek_id].push(m);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([gw, ms]) => ({ gw: Number(gw), matches: ms }));
  }, [matches]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.8); opacity: 0; } }
        @media (max-width: 700px) {
          .voice-admin-nav { padding: 12px 16px !important; }
          .voice-admin-user-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
      `}</style>

      {/* Nav */}
      <nav
        className="voice-admin-nav"
        style={{
          padding: "12px 24px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          backgroundColor: BG_CARD,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT}, #8B0000)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎙️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Voice Admin</h1>
            <p style={{ margin: 0, fontSize: 10, color: TEXT_MUTED, letterSpacing: 1, textTransform: "uppercase" }}>Budo League</p>
          </div>
        </div>
        {session?.user?.name && (
          <span className="voice-admin-user-name" style={{ fontSize: 12, color: TEXT_MUTED, marginLeft: "auto" }}>{session.user.name}</span>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: "100%" }}>
          {(["manual", "capture", "history", "scoring"] as ViewState[]).map(tab => (
            <button key={tab} onClick={() => { if (view !== "confirm") setView(tab); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${view === tab ? ACCENT + "40" : BORDER}`, backgroundColor: view === tab ? `${ACCENT}15` : "transparent", color: view === tab ? ACCENT : TEXT_MUTED, fontSize: 12, fontWeight: 600, cursor: view === "confirm" ? "not-allowed" : "pointer", fontFamily: "inherit", textTransform: "capitalize", opacity: view === "confirm" ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {tab === "manual" ? "📝 Manual" : tab === "capture" ? "🎤 Capture" : tab === "history" ? "📋 History" : "🧮 Scoring"}
            </button>
          ))}
          {view === "confirm" && <span style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${WARNING}40`, backgroundColor: `${WARNING}15`, color: WARNING, fontSize: 12, fontWeight: 600 }}>✓ Confirming</span>}
        </div>
      </nav>

      {/* Match selector */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE, maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
  <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>Match</label>
  {selectedMatchId && (
    <a
      href={`/api/voice-admin/export-csv?matchId=${selectedMatchId}`}
      download
      style={{
        padding: "6px 12px", borderRadius: 6, border: `1px solid ${BORDER}`,
        backgroundColor: BG_CARD, color: TEXT_SECONDARY, fontSize: 11,
        fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      📥 CSV
    </a>
  )}
          
          {loadingMatches ? <span style={{ fontSize: 13, color: TEXT_MUTED }}>Loading...</span>
            : matchError ? <span style={{ fontSize: 13, color: ERROR }}>{matchError}</span>
            : (
              <select value={selectedMatchId ?? ""} onChange={e => setSelectedMatchId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ flex: "1 1 260px", minWidth: 0, padding: "8px 12px", backgroundColor: BG_DARK, color: TEXT_PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer", WebkitAppearance: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A0A0A0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
                <option value="" style={{ backgroundColor: BG_DARK, color: TEXT_PRIMARY }}>Select a match...</option>
                {matchesByGw.map(({ gw, matches: gwMatches }) => (
                  <optgroup key={gw} label={`Gameweek ${gw}`} style={{ backgroundColor: BG_CARD, color: TEXT_SECONDARY, fontWeight: 700 }}>
                    {gwMatches.map(m => <option key={m.id} value={m.id} style={{ backgroundColor: BG_DARK, color: TEXT_PRIMARY, fontWeight: 400 }}>{matchLabel(m)}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
        </div>
      </div>

      <main>
        {view === "manual" && <ManualView matchId={selectedMatchId} />}
        {view === "capture" && <CaptureView matchId={selectedMatchId} onResult={handleResult} showLogout={!!session?.user} />}
        {view === "confirm" && pipelineResult && <ConfirmView pipelineResult={pipelineResult} matchId={selectedMatchId} onConfirm={handleConfirm} onCancel={handleCancel} />}
        {view === "history" && <HistoryView history={history} />}
        {view === "scoring" && <ScoringView matchesByGw={matchesByGw} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CAPTURE VIEW
// ═══════════════════════════════════════════════════════════
function CaptureView({ matchId, onResult, showLogout }: { matchId: number | null; onResult: (r: any) => void; showLogout?: boolean }) {
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [micPulse, setMicPulse] = useState(false);

  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(50);
    setMicPulse(true);
    setTimeout(() => setMicPulse(false), 200);
  }, []);

  const friendlyError = (err: string): string => {
    if (err.includes("NotAllowedError") || err.includes("denied")) return "Microphone access was denied. Check your browser settings and allow mic access for this site.";
    if (err.includes("NotFoundError")) return "No microphone found. Make sure a mic is connected.";
    if (err.includes("Network") || err.includes("fetch")) return "Can't reach the server. Check your connection and try again.";
    if (err.includes("Too short")) return "Recording was too short. Hold the mic button for at least 1 second.";
    if (err.includes("429") || err.includes("quota")) return "API rate limit hit. Wait a moment and try again.";
    if (err.includes("401") || err.includes("Unauthorized")) return "API key is invalid or expired. Check your .env.local file.";
    if (err.includes("Whisper")) return "Speech-to-text failed. Try speaking louder or closer to the mic.";
    return err;
  };

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (!matchId) { setErrorMsg("Select a match above before sending commands."); return; }
    setStatus("interpreting"); setErrorMsg("");
    try {
      const res = await fetch("/api/voice-admin/process-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, matchId: String(matchId) }) });
      const result = await res.json();
      setLog(prev => [{ transcript: text, timestamp: formatTime(), result: res.ok ? result : undefined, error: !res.ok ? (result.error || `HTTP ${res.status}`) : undefined }, ...prev].slice(0, 50));
      if (res.ok && (result.resolved?.length > 0 || result.unresolved?.length > 0)) {
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        onResult(result);
      } else if (res.ok && result.resolved?.length === 0) {
        setErrorMsg("No players recognized. Try using exact player names like \"Lado\" or \"Mpirwe\".");
      }
      setStatus("done");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setLog(prev => [{ transcript: text, timestamp: formatTime(), error: "Network error" }, ...prev]);
      setStatus("error"); setErrorMsg(friendlyError("Network error"));
    }
  }, [matchId, onResult]);

  const startRecording = useCallback(async () => {
    if (!matchId) { setErrorMsg("Select a match above before recording."); return; }
    try {
      setErrorMsg(""); audioChunksRef.current = [];
      triggerHaptic();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onerror = (e: any) => { setStatus("error"); setErrorMsg(friendlyError(e.error?.message || "Recording failed. Try again.")); };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setStatus("recording"); setRecordStartTime(Date.now());
    } catch (err: any) {
      setStatus("error"); setErrorMsg(friendlyError(err?.name || err?.message || String(err)));
    }
  }, [matchId, triggerHaptic]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    triggerHaptic();
    mediaRecorderRef.current.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" });
      if (blob.size < 1000) { setStatus("idle"); setErrorMsg(friendlyError("Too short")); setRecordStartTime(null); return; }
      setStatus("transcribing"); setRecordStartTime(null);
      try {
        const fd = new FormData(); fd.append("audio", blob, "recording.webm"); fd.append("matchId", String(matchId));
        const res = await fetch("/api/voice-admin/process", { method: "POST", body: fd });
        setStatus("interpreting");
        const result = await res.json();
        setLog(prev => [{ transcript: result.transcript || "(no transcript)", timestamp: formatTime(), result: res.ok ? result : undefined, error: !res.ok ? friendlyError(result.error || `HTTP ${res.status}`) : undefined }, ...prev].slice(0, 50));
        if (res.ok && (result.resolved?.length > 0 || result.unresolved?.length > 0)) {
          if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
          onResult(result);
        } else if (res.ok && result.resolved?.length === 0) {
          setErrorMsg("No players recognized. Try speaking more clearly or use the text input.");
        }
        setStatus("done"); setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        const msg = err?.message || "Network error";
        setLog(prev => [{ transcript: "(error)", timestamp: formatTime(), error: msg }, ...prev]);
        setStatus("error"); setErrorMsg(friendlyError(msg));
      }
    };
    mediaRecorderRef.current.stop();
  }, [matchId, onResult, triggerHaptic]);

  const toggleRecording = () => {
    if (status === "recording") stopRecording();
    else if (["idle", "done", "error"].includes(status)) startRecording();
  };

  const isRecording = status === "recording";
  const isProcessing = status === "transcribing" || status === "interpreting";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px" }}>
      {/* Mic area — compact */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0 16px" }}>
        <div style={{ position: "relative" }}>
          {isRecording && (
            <>
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${ERROR}40`, animation: "pulse-ring 2s ease-out infinite" }} />
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${ERROR}30`, animation: "pulse-ring 2s ease-out infinite 0.5s" }} />
            </>
          )}
          <button onClick={toggleRecording} disabled={isProcessing}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              border: `3px solid ${isRecording ? ERROR : micPulse ? ACCENT : BORDER}`,
              backgroundColor: isRecording ? `${ERROR}20` : BG_SURFACE,
              cursor: isProcessing ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: isRecording ? `0 0 30px ${ERROR}30` : micPulse ? `0 0 20px ${ACCENT}30` : "0 4px 16px rgba(0,0,0,0.3)",
              opacity: isProcessing ? 0.5 : 1,
              transform: micPulse ? "scale(0.95)" : "scale(1)",
            }}>
            {isRecording
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill={ERROR}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
            }
          </button>
        </div>
        <div style={{ flex: 1 }}>
          {isRecording && recordStartTime && (
            <div style={{ marginBottom: 4 }}>
              <Timer startTime={recordStartTime} />
            </div>
          )}
          {isProcessing && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: WARNING, animation: "pulse-ring 1s ease-in-out infinite" }} />
              <span style={{ fontSize: 13, color: WARNING, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {status === "transcribing" ? "Transcribing audio..." : "Parsing stats..."}
              </span>
            </div>
          )}
          {status === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ fontSize: 13, color: SUCCESS, fontWeight: 600 }}>Processed!</span>
            </div>
          )}
          {status === "idle" && !matchId && (
            <span style={{ fontSize: 13, color: WARNING }}>⚠ Select a match above to start</span>
          )}
          {status === "idle" && matchId && (
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>Tap mic or type a command below</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 12, backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`, fontSize: 13, color: ERROR, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0 }}>{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Text input */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Type a Command</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && textInput.trim()) { sendText(textInput.trim()); setTextInput(""); } }}
            placeholder='e.g. "Lado scored twice"'
            disabled={isProcessing || !matchId}
            style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE, color: TEXT_PRIMARY, fontSize: 15, fontFamily: "inherit", outline: "none", opacity: isProcessing || !matchId ? 0.4 : 1 }}
          />
          <button
            onClick={() => { if (textInput.trim()) { sendText(textInput.trim()); setTextInput(""); } }}
            disabled={isProcessing || !matchId || !textInput.trim()}
            style={{ padding: "12px 20px", borderRadius: 10, border: "none", backgroundColor: textInput.trim() && matchId ? ACCENT : TEXT_MUTED, color: BG_DARK, fontSize: 15, fontWeight: 700, cursor: textInput.trim() && matchId && !isProcessing ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: isProcessing ? 0.5 : 1, minWidth: 70 }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Quick tests — larger touch targets */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Quick Test</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Lado scored twice", "Mpirwe goal and assist", "Lado yellow card", "Clean sheet for Trotballo", "Mpirwe scored a hat trick"].map(cmd => (
            <button key={cmd} onClick={() => sendText(cmd)} disabled={isProcessing || !matchId}
              style={{
                padding: "10px 16px", borderRadius: 8,
                border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                color: TEXT_SECONDARY, fontSize: 13,
                cursor: isProcessing || !matchId ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: isProcessing || !matchId ? 0.4 : 1,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}>
              &ldquo;{cmd}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {showLogout && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              backgroundColor: "transparent",
              color: TEXT_MUTED,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* Processing skeleton */}
      {isProcessing && (
        <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: BG_SURFACE, animation: "pulse-ring 1.5s ease-in-out infinite" }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: "60%", borderRadius: 4, backgroundColor: BG_SURFACE, marginBottom: 6 }} />
              <div style={{ height: 10, width: "40%", borderRadius: 4, backgroundColor: BG_SURFACE }} />
            </div>
          </div>
          <div style={{ height: 12, width: "80%", borderRadius: 4, backgroundColor: BG_SURFACE, marginBottom: 8 }} />
          <div style={{ height: 12, width: "55%", borderRadius: 4, backgroundColor: BG_SURFACE }} />
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase" }}>Recent ({log.length})</span>
            <button onClick={() => setLog([])} style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 11, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>CLEAR</button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {log.map((entry, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, backgroundColor: i === 0 ? BG_SURFACE : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{entry.timestamp}</span>
                  <span style={{ fontSize: 10, color: entry.error ? ERROR : SUCCESS, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>{entry.error ? "ERROR" : "OK"}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY }}>{entry.transcript}</p>
                {entry.error && <p style={{ margin: "4px 0 0", fontSize: 12, color: ERROR }}>{friendlyError(entry.error)}</p>}
                {entry.result?.summary && <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXT_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{entry.result.summary.resolvedCount} players · {entry.result.summary.totalPoints}pts</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════
// CONFIRM VIEW
// ═══════════════════════════════════════════════════════════
function ConfirmView({ pipelineResult, matchId, onConfirm, onCancel }: { pipelineResult: any; matchId: number | null; onConfirm: (result: any) => void; onCancel: () => void }) {
  const [entries, setEntries] = useState<any[]>(pipelineResult?.resolved || []);
  const [unresolved] = useState<any[]>(pipelineResult?.unresolved || []);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");

  const validation = useMemo(() => validate(entries, matchId), [entries, matchId]);
  const totalPoints = useMemo(() => entries.reduce((sum: number, e: any) => sum + (e.totalPoints || 0), 0), [entries]);
  const ladyCount = useMemo(() => entries.filter((e: any) => e.player?.is_lady).length, [entries]);

  const removeEntry = useCallback((idx: number) => {
    setEntries(prev => prev.filter((_: any, i: number) => i !== idx));
  }, []);

  const updateActionQty = useCallback((entryIdx: number, actionIdx: number, newQty: number) => {
    setEntries(prev => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      const actions = [...entry.actions];
      actions[actionIdx] = { ...actions[actionIdx], quantity: newQty };
      entry.actions = actions;
      next[entryIdx] = entry;
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    if (!validation.valid || entries.length === 0) return;
    setCommitting(true); setCommitError("");
    try {
      const res = await fetch("/api/voice-admin/commit-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, entries, adminId: 1, transcript: pipelineResult?.transcript || "" }),
      });
      const result = await res.json();
      if (res.ok) {
        onConfirm(result);
        onCancel();
      } else {
        setCommitError(result.error || "Commit failed");
      }
    } catch {
      setCommitError("Network error — is the dev server running?");
    }
    setCommitting(false);
  }, [entries, matchId, pipelineResult, validation, onConfirm, onCancel]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Confirm Stats</h2>
          {pipelineResult?.transcript && <p style={{ margin: "4px 0 0", fontSize: 12, color: TEXT_MUTED }}>&ldquo;{pipelineResult.transcript}&rdquo;</p>}
        </div>
        <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: validation.valid ? SUCCESS : ERROR, backgroundColor: validation.valid ? `${SUCCESS}15` : `${ERROR}15`, border: `1px solid ${validation.valid ? SUCCESS + "40" : ERROR + "40"}` }}>
          {validation.valid ? "Valid" : `${validation.errors.length} error${validation.errors.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "12px 16px", backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
        {[
          { label: "Players", value: entries.length, color: TEXT_PRIMARY },
          { label: "Total Pts", value: totalPoints, color: ACCENT },
          { label: "Ladies", value: ladyCount, color: ladyCount > 0 ? "#EC4899" : TEXT_MUTED },
          { label: "Unresolved", value: unresolved.length, color: unresolved.length > 0 ? WARNING : TEXT_MUTED },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value}</p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Errors & warnings */}
      {validation.errors.map((err, i) => (
        <div key={`e${i}`} style={{ padding: "10px 14px", marginBottom: 6, borderRadius: 8, backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`, fontSize: 13, color: ERROR }}>{err.message}</div>
      ))}
      {validation.warnings.map((w, i) => (
        <div key={`w${i}`} style={{ padding: "10px 14px", marginBottom: 6, borderRadius: 8, backgroundColor: `${WARNING}10`, border: `1px solid ${WARNING}30`, fontSize: 13, color: WARNING }}>{w.message}</div>
      ))}

      {/* Player entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, marginTop: 16 }}>
        {entries.map((entry, ei) => {
          const name = entry.player?.web_name || entry.spoken_name;
          const position = entry.player?.position || "?";
          return (
            <div key={ei} style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, backgroundColor: (POS_COLORS[position] || TEXT_MUTED) + "20", color: POS_COLORS[position] || TEXT_MUTED, fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{position}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{name}</p>
                      {entry.player?.is_lady && (
                        <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, backgroundColor: "#EC489920", color: "#EC4899", border: "1px solid #EC489940" }}>♀ Lady</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>{entry.player?.team_name || ""}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{entry.totalPoints}pts</span>
                  <button onClick={() => removeEntry(ei)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: "transparent", cursor: "pointer", color: TEXT_MUTED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
                </div>
              </div>
              <div style={{ padding: "10px 16px" }}>
                {entry.actions.map((action: any, ai: number) => {
                  const meta = ACTION_META[action.action] || { icon: "?", label: action.action, color: TEXT_MUTED };
                  const max = ACTION_LIMITS[action.action] || 10;
                  return (
                    <div key={ai} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: ai < entry.actions.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                        <span style={{ fontSize: 13, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => { if (action.quantity > 1) updateActionQty(ei, ai, action.quantity - 1); }} disabled={action.quantity <= 1}
                          style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: action.quantity > 1 ? "pointer" : "not-allowed", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: action.quantity > 1 ? 1 : 0.3 }}>−</button>
                        <span style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{action.quantity}</span>
                        <button onClick={() => { if (action.quantity < max) updateActionQty(ei, ai, action.quantity + 1); }} disabled={action.quantity >= max}
                          style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, cursor: action.quantity < max ? "pointer" : "not-allowed", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: action.quantity < max ? 1 : 0.3 }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unresolved */}
      {unresolved.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: WARNING, textTransform: "uppercase", letterSpacing: 0.5 }}>Unresolved ({unresolved.length})</h3>
          {unresolved.map((u, i) => (
            <div key={i} style={{ padding: "10px 14px", marginBottom: 6, borderRadius: 8, backgroundColor: `${WARNING}08`, border: `1px solid ${WARNING}40`, fontSize: 13, color: WARNING }}>
              &ldquo;{u.spoken_name}&rdquo; — {u.actions.map((a: any) => `${a.action}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ")}
            </div>
          ))}
        </div>
      )}

      {/* Commit error */}
      {commitError && (
        <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: 8, backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`, fontSize: 13, color: ERROR }}>
          {commitError}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "14px 20px", borderRadius: 10, border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE, color: TEXT_SECONDARY, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={handleCommit} disabled={!validation.valid || entries.length === 0 || committing}
          style={{ flex: 2, padding: "14px 20px", borderRadius: 10, border: "none", backgroundColor: validation.valid && entries.length > 0 ? ACCENT : TEXT_MUTED, color: BG_DARK, fontSize: 14, fontWeight: 700, cursor: validation.valid && entries.length > 0 && !committing ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: committing ? 0.7 : 1 }}>
          {committing ? "Committing..." : `Confirm ${entries.length} Player${entries.length !== 1 ? "s" : ""} → DB`}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════
function HistoryView({ history }: { history: any[] }) {
  const [undoing, setUndoing] = useState<number | null>(null);
  const [undone, setUndone] = useState<Set<number>>(new Set());

  const handleUndo = useCallback(async (auditLogId: number, index: number) => {
    if (!auditLogId || undone.has(index)) return;
    setUndoing(index);
    try {
      const res = await fetch("/api/voice-admin/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogId }),
      });
      const result = await res.json();
      if (res.ok) {
        setUndone(prev => new Set(prev).add(index));
      } else {
        alert(result.error || "Undo failed");
      }
    } catch {
      alert("Network error");
    }
    setUndoing(null);
  }, [undone]);

  if (history.length === 0) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>📋</p>
      <p style={{ color: TEXT_MUTED, fontSize: 14 }}>No committed entries yet.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Session History ({history.length})</h2>
      {history.map((h, i) => {
        const isUndone = undone.has(i);
        const isUndoing = undoing === i;
        const auditLogId = h.result?.auditLogId;
        return (
          <div key={i} style={{ padding: "14px 16px", marginBottom: 8, borderRadius: 10, backgroundColor: BG_CARD, border: `1px solid ${isUndone ? ERROR + "40" : BORDER}`, opacity: isUndone ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{new Date(h.timestamp).toLocaleTimeString()}</span>
              <span style={{ fontSize: 11, color: isUndone ? ERROR : SUCCESS, fontWeight: 600 }}>
                {isUndone ? "UNDONE" : "COMMITTED"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>&ldquo;{h.transcript}&rdquo;</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXT_MUTED }}>
              Match #{h.matchId} · {h.result?.message || "Saved"}
            </p>
            {auditLogId && !isUndone && (
              <button
                onClick={() => handleUndo(auditLogId, i)}
                disabled={isUndoing}
                style={{
                  marginTop: 10, padding: "6px 14px", borderRadius: 6,
                  border: `1px solid ${ERROR}40`, backgroundColor: `${ERROR}10`,
                  color: ERROR, fontSize: 12, fontWeight: 600, cursor: isUndoing ? "wait" : "pointer",
                  fontFamily: "inherit", opacity: isUndoing ? 0.6 : 1,
                }}
              >
                {isUndoing ? "Undoing..." : "↩ Undo"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCORING VIEW
// ═══════════════════════════════════════════════════════════
function ScoringView({ matchesByGw }: { matchesByGw: { gw: number; matches: Match[] }[] }) {
  const [selectedGw, setSelectedGw] = useState<number | null>(
    matchesByGw.length > 0 ? matchesByGw[0].gw : null
  );
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const gwOptions = matchesByGw.map(g => g.gw);

  const handleCalculate = useCallback(async () => {
    if (!selectedGw) return;
    setCalculating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/voice-admin/calculate-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweekId: selectedGw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to calculate scores");
    }
    setCalculating(false);
  }, [selectedGw]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Calculate Scores</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: TEXT_MUTED }}>
        Select a gameweek and calculate fantasy scores for all users.
      </p>

      {/* GW Selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select
          value={selectedGw ?? ""}
          onChange={e => setSelectedGw(e.target.value ? parseInt(e.target.value) : null)}
          style={{
            flex: 1, padding: "10px 12px", backgroundColor: BG_DARK, color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit",
            outline: "none", cursor: "pointer",
            WebkitAppearance: "none", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A0A0A0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
          }}
        >
          <option value="" style={{ backgroundColor: BG_DARK, color: TEXT_PRIMARY }}>Select gameweek...</option>
          {gwOptions.map(gw => (
            <option key={gw} value={gw} style={{ backgroundColor: BG_DARK, color: TEXT_PRIMARY }}>
              Gameweek {gw}
            </option>
          ))}
        </select>

        <button
          onClick={handleCalculate}
          disabled={!selectedGw || calculating}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none",
            backgroundColor: selectedGw && !calculating ? ACCENT : TEXT_MUTED,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: selectedGw && !calculating ? "pointer" : "not-allowed",
            fontFamily: "inherit", opacity: calculating ? 0.7 : 1, whiteSpace: "nowrap",
          }}
        >
          {calculating ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 16, backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`, fontSize: 13, color: ERROR }}>
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <>
          <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 16, backgroundColor: `${SUCCESS}10`, border: `1px solid ${SUCCESS}30`, fontSize: 13, color: SUCCESS, fontWeight: 600 }}>
            {result.message}
          </div>

          {/* Leaderboard */}
          {result.leaderboard && result.leaderboard.length > 0 && (
            <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  GW{result.gameweekId} Leaderboard
                </span>
              </div>
              {result.leaderboard.map((entry: any, i: number) => (
                <div key={entry.user_id} style={{
                  padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: i < result.leaderboard.length - 1 ? `1px solid ${BORDER}` : "none",
                  backgroundColor: i === 0 ? `${ACCENT}08` : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      backgroundColor: i === 0 ? `${ACCENT}20` : BG_SURFACE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: i === 0 ? ACCENT : TEXT_MUTED,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {entry.user_id.slice(0, 8)}...
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {entry.total_weekly_points}pts
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Breakdown (collapsible) */}
          {result.breakdown && result.breakdown.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 12, color: TEXT_MUTED, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Detailed Breakdown ({result.breakdown.length} entries)
              </summary>
              <pre style={{
                backgroundColor: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: 12, fontSize: 11, color: TEXT_SECONDARY, overflowX: "auto", maxHeight: 300,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}>
                {JSON.stringify(result.breakdown, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}

      {/* Empty state */}
      {!calculating && !result && !error && (
        <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_MUTED }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🧮</p>
          <p style={{ fontSize: 13 }}>Select a gameweek and calculate fantasy scores.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>This runs scoring RPCs and updates the leaderboard.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MANUAL ENTRY VIEW
// ═══════════════════════════════════════════════════════════
type ManualPlayer = {
  id: string;
  name: string;
  web_name: string | null;
  position: string;
  is_lady: boolean;
  team_id: string;
};

type PlayerEvents = {
  appeared: boolean;
  goals: number;
  assists: number;
  clean_sheet: boolean;
  yellow: boolean;
  red: boolean;
  own_goal: number;
  pen_miss: number;
  pen_save: number;
  save_3: number;
};

const DEFAULT_EVENTS: PlayerEvents = {
  appeared: false, goals: 0, assists: 0, clean_sheet: false,
  yellow: false, red: false, own_goal: 0, pen_miss: 0,
  pen_save: 0, save_3: 0,
};

const POS_SHORT: Record<string, string> = {
  Goalkeeper: "GKP", Defender: "DEF", Midfielder: "MID", Forward: "FWD",
};

function ManualView({ matchId }: { matchId: number | null }) {
  const [homeTeam, setHomeTeam] = useState<{ name: string; short_name: string; players: ManualPlayer[] } | null>(null);
  const [awayTeam, setAwayTeam] = useState<{ name: string; short_name: string; players: ManualPlayer[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playerEvents, setPlayerEvents] = useState<Record<string, PlayerEvents>>({});
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [homeOpen, setHomeOpen] = useState(true);
  const [awayOpen, setAwayOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch players when match changes
  useEffect(() => {
    if (!matchId) {
      setHomeTeam(null);
      setAwayTeam(null);
      setPlayerEvents({});
      return;
    }
    setLoading(true);
    setError("");
    setSaveResult(null);
    fetch(`/api/voice-admin/match-players?matchId=${matchId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load players");
        return res.json();
      })
      .then(data => {
        setHomeTeam(data.homeTeam);
        setAwayTeam(data.awayTeam);
        // Initialize events for all players
        const events: Record<string, PlayerEvents> = {};
        for (const p of [...(data.homeTeam?.players || []), ...(data.awayTeam?.players || [])]) {
          events[p.id] = { ...DEFAULT_EVENTS };
        }
        setPlayerEvents(events);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  const updateEvent = useCallback((playerId: string, field: keyof PlayerEvents, value: any) => {
    setPlayerEvents(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }));
  }, []);

  const selectAllAppeared = useCallback((players: ManualPlayer[]) => {
    setPlayerEvents(prev => {
      const next = { ...prev };
      const allChecked = players.every(p => prev[p.id]?.appeared);
      for (const p of players) {
        next[p.id] = { ...next[p.id], appeared: !allChecked };
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((playerId: string) => {
    setExpandedPlayer(prev => prev === playerId ? null : playerId);
  }, []);

  // Count players with events
  const playersWithEvents = useMemo(() => {
    return Object.entries(playerEvents).filter(([, ev]) => ev.appeared).length;
  }, [playerEvents]);

  // Build payload and save
  const handleSave = useCallback(async () => {
    if (!matchId || playersWithEvents === 0) return;
    setSaving(true);
    setSaveResult(null);

    // Build events array: only players who appeared
    const events: { playerId: string; actions: { action: string; quantity: number }[] }[] = [];
    for (const [playerId, ev] of Object.entries(playerEvents)) {
      if (!ev.appeared) continue;
      const actions: { action: string; quantity: number }[] = [];
      actions.push({ action: "appearance", quantity: 1 });
      if (ev.goals > 0) actions.push({ action: "goal", quantity: ev.goals });
      if (ev.assists > 0) actions.push({ action: "assist", quantity: ev.assists });
      if (ev.clean_sheet) actions.push({ action: "clean_sheet", quantity: 1 });
      if (ev.yellow) actions.push({ action: "yellow", quantity: 1 });
      if (ev.red) actions.push({ action: "red", quantity: 1 });
      if (ev.own_goal > 0) actions.push({ action: "own_goal", quantity: ev.own_goal });
      if (ev.pen_miss > 0) actions.push({ action: "pen_miss", quantity: ev.pen_miss });
      if (ev.pen_save > 0) actions.push({ action: "pen_save", quantity: ev.pen_save });
      if (ev.save_3 > 0) actions.push({ action: "save_3", quantity: ev.save_3 });
      events.push({ playerId, actions });
    }

    try {
      const res = await fetch("/api/voice-admin/commit-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, events }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveResult({ success: true, message: `Saved ${data.eventsCreated} events for ${data.playersUpdated} players` });
      } else {
        setSaveResult({ success: false, message: data.error || "Save failed" });
      }
    } catch {
      setSaveResult({ success: false, message: "Network error" });
    }
    setSaving(false);
  }, [matchId, playerEvents, playersWithEvents]);

  // Helper: has any non-appearance event
  const hasEvents = (ev: PlayerEvents) =>
    ev.goals > 0 || ev.assists > 0 || ev.clean_sheet || ev.yellow || ev.red || ev.own_goal > 0 || ev.pen_miss > 0 || ev.pen_save > 0 || ev.save_3 > 0;

  if (!matchId) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>📝</p>
      <p style={{ color: TEXT_MUTED, fontSize: 14 }}>Select a match above to enter stats manually.</p>
    </div>
  );

  if (loading) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
      <p style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading players...</p>
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ padding: "12px 14px", borderRadius: 10, backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`, fontSize: 13, color: ERROR }}>{error}</div>
    </div>
  );

  const renderTeamSection = (team: { name: string; short_name: string; players: ManualPlayer[] }, isOpen: boolean, setOpen: (v: boolean) => void, label: string) => (
    <div style={{ marginBottom: 16 }}>
      {/* Team header */}
      <button
        onClick={() => setOpen(!isOpen)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: isOpen ? "10px 10px 0 0" : 10,
          border: `1px solid ${BORDER}`, borderBottom: isOpen ? "none" : `1px solid ${BORDER}`,
          backgroundColor: BG_CARD, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY }}>{team.name}</span>
          <span style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 600, textTransform: "uppercase" }}>({label})</span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>{team.players.length} players</span>
        </div>
        <span style={{ fontSize: 14, color: TEXT_MUTED, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
      </button>

      {isOpen && (
        <div style={{ border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          {/* Select All Appeared */}
          <button
            onClick={() => selectAllAppeared(team.players)}
            style={{
              width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
              backgroundColor: BG_SURFACE, border: "none", borderBottom: `1px solid ${BORDER}`,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 4,
              border: `2px solid ${team.players.every(p => playerEvents[p.id]?.appeared) ? ACCENT : BORDER}`,
              backgroundColor: team.players.every(p => playerEvents[p.id]?.appeared) ? ACCENT : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#fff", fontWeight: 700,
            }}>
              {team.players.every(p => playerEvents[p.id]?.appeared) ? "✓" : ""}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>Select All Appeared</span>
          </button>

          {/* Player rows */}
          {team.players.map((player) => {
            const ev = playerEvents[player.id] || DEFAULT_EVENTS;
            const isExpanded = expandedPlayer === player.id;
            const posShort = POS_SHORT[player.position] || player.position;
            const posColor = POS_COLORS[posShort] || TEXT_MUTED;
            const playerHasEvents = hasEvents(ev);

            return (
              <div key={player.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                {/* Collapsed row */}
                <div
                  style={{
                    display: "flex", alignItems: "center", padding: "10px 16px", gap: 10,
                    backgroundColor: ev.appeared ? `${ACCENT}06` : "transparent",
                  }}
                >
                  {/* Appeared checkbox */}
                  <button
                    onClick={() => updateEvent(player.id, "appeared", !ev.appeared)}
                    style={{
                      width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${ev.appeared ? ACCENT : BORDER}`,
                      backgroundColor: ev.appeared ? ACCENT : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 700,
                    }}
                  >
                    {ev.appeared ? "✓" : ""}
                  </button>

                  {/* Player info — tap to expand */}
                  <button
                    onClick={() => toggleExpand(player.id)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 8,
                      background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: 0, fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 20, borderRadius: 4,
                      backgroundColor: posColor + "20", color: posColor,
                      fontSize: 9, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}>{posShort}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>
                      {player.web_name || player.name}
                    </span>
                    {player.is_lady && (
                      <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, backgroundColor: "#EC489920", color: "#EC4899", fontWeight: 700 }}>♀</span>
                    )}
                  </button>

                  {/* Event summary icons (when collapsed + has events) */}
                  {!isExpanded && playerHasEvents && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {ev.goals > 0 && <span style={{ fontSize: 12 }}>⚽{ev.goals > 1 ? ev.goals : ""}</span>}
                      {ev.assists > 0 && <span style={{ fontSize: 12 }}>🅰️{ev.assists > 1 ? ev.assists : ""}</span>}
                      {ev.clean_sheet && <span style={{ fontSize: 12 }}>🛡️</span>}
                      {ev.yellow && <span style={{ fontSize: 12 }}>🟨</span>}
                      {ev.red && <span style={{ fontSize: 12 }}>🟥</span>}
                      {ev.own_goal > 0 && <span style={{ fontSize: 12 }}>🔴{ev.own_goal > 1 ? ev.own_goal : ""}</span>}
                    </div>
                  )}

                  {/* Expand chevron */}
                  <span style={{ fontSize: 10, color: TEXT_MUTED, flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "8px 16px 12px", backgroundColor: BG_SURFACE }}>
                    {/* Goals stepper */}
                    <ManualStepper label="Goals" icon="⚽" value={ev.goals} max={10}
                      onChange={(v) => updateEvent(player.id, "goals", v)} />
                    {/* Assists stepper */}
                    <ManualStepper label="Assists" icon="🅰️" value={ev.assists} max={10}
                      onChange={(v) => updateEvent(player.id, "assists", v)} />
                    {/* Clean sheet toggle */}
                    <ManualToggle label="Clean Sheet" icon="🛡️" value={ev.clean_sheet}
                      onChange={(v) => updateEvent(player.id, "clean_sheet", v)} />
                    {/* Yellow toggle */}
                    <ManualToggle label="Yellow Card" icon="🟨" value={ev.yellow}
                      onChange={(v) => updateEvent(player.id, "yellow", v)} />
                    {/* Red toggle */}
                    <ManualToggle label="Red Card" icon="🟥" value={ev.red}
                      onChange={(v) => updateEvent(player.id, "red", v)} />
                    {/* Own Goal stepper */}
                    <ManualStepper label="Own Goal" icon="🔴" value={ev.own_goal} max={5}
                      onChange={(v) => updateEvent(player.id, "own_goal", v)} />
                    {/* GK-specific: pen_save, save_3 */}
                    {player.position === "Goalkeeper" && (
                      <>
                        <ManualStepper label="Pen Save" icon="🧤" value={ev.pen_save} max={5}
                          onChange={(v) => updateEvent(player.id, "pen_save", v)} />
                        <ManualStepper label="3+ Saves" icon="🧤" value={ev.save_3} max={10}
                          onChange={(v) => updateEvent(player.id, "save_3", v)} />
                      </>
                    )}
                    {/* Pen miss */}
                    <ManualStepper label="Pen Miss" icon="❌" value={ev.pen_miss} max={5}
                      onChange={(v) => updateEvent(player.id, "pen_miss", v)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Manual Stat Entry</h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: TEXT_MUTED }}>
        Check appeared players, tap a name to add goals/assists/cards.
      </p>

      {/* Save result banner */}
      {saveResult && (
        <div style={{
          padding: "12px 14px", borderRadius: 10, marginBottom: 16,
          backgroundColor: saveResult.success ? `${SUCCESS}10` : `${ERROR}10`,
          border: `1px solid ${saveResult.success ? SUCCESS + "30" : ERROR + "30"}`,
          fontSize: 13, color: saveResult.success ? SUCCESS : ERROR, fontWeight: 600,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{saveResult.message}</span>
          <button onClick={() => setSaveResult(null)} style={{ background: "none", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Team sections */}
      {homeTeam && renderTeamSection(homeTeam, homeOpen, setHomeOpen, "Home")}
      {awayTeam && renderTeamSection(awayTeam, awayOpen, setAwayOpen, "Away")}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || playersWithEvents === 0}
        style={{
          width: "100%", padding: "14px 20px", borderRadius: 10, border: "none",
          backgroundColor: playersWithEvents > 0 && !saving ? ACCENT : TEXT_MUTED,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: playersWithEvents > 0 && !saving ? "pointer" : "not-allowed",
          fontFamily: "inherit", opacity: saving ? 0.7 : 1,
          position: "sticky", bottom: 16,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {saving ? "Saving..." : `Save ${playersWithEvents} player${playersWithEvents !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

// ── Manual entry sub-components ──
function ManualStepper({ label, icon, value, max, onChange }: { label: string; icon: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => { if (value > 0) onChange(value - 1); }} disabled={value <= 0}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: BG_CARD, color: TEXT_SECONDARY, cursor: value > 0 ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", opacity: value > 0 ? 1 : 0.3, fontFamily: "inherit" }}>−</button>
        <span style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 700, color: value > 0 ? TEXT_PRIMARY : TEXT_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value}</span>
        <button onClick={() => { if (value < max) onChange(value + 1); }} disabled={value >= max}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: BG_CARD, color: TEXT_SECONDARY, cursor: value < max ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", opacity: value < max ? 1 : 0.3, fontFamily: "inherit" }}>+</button>
      </div>
    </div>
  );
}

function ManualToggle({ label, icon, value, onChange }: { label: string; icon: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 500 }}>{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 24, borderRadius: 12, border: "none",
          backgroundColor: value ? ACCENT : BG_CARD,
          cursor: "pointer", position: "relative", transition: "background-color 0.2s",
          boxShadow: `inset 0 0 0 1px ${value ? ACCENT : BORDER}`,
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: value ? 19 : 3,
          width: 18, height: 18, borderRadius: "50%",
          backgroundColor: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

function Timer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const id = setInterval(() => setElapsed(Date.now() - startTime), 100); return () => clearInterval(id); }, [startTime]);
  const secs = Math.floor(elapsed / 1000);
  return <span style={{ fontSize: 20, fontWeight: 600, color: ERROR, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: 2 }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>;
}
