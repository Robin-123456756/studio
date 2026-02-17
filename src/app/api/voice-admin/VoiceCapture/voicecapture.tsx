import React, { useState, useRef, useCallback, useEffect } from "react";

const ACCENT = "#00E676";
const ACCENT_DIM = "#00C853";
const BG_DARK = "#0A0F1C";
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#94A3B8";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const WARNING = "#F59E0B";
const SUCCESS = "#10B981";

// ── Waveform visualizer (driven by real audio analyser) ─────
function Waveform({ isActive, analyserRef }: { isActive: boolean; analyserRef: React.RefObject<AnalyserNode | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const BAR_W = 3;
    const GAP = 2;
    const BARS = Math.floor(W / (BAR_W + GAP));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (isActive && analyserRef.current) {
        const analyser = analyserRef.current;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BARS);

        for (let i = 0; i < BARS; i++) {
          const val = data[i * step] / 255;
          const h = Math.max(4, val * H * 0.9);
          const x = i * (BAR_W + GAP);
          const y = (H - h) / 2;
          ctx.fillStyle = ACCENT;
          ctx.globalAlpha = 0.5 + val * 0.5;
          ctx.beginPath();
          ctx.roundRect(x, y, BAR_W, h, 1.5);
          ctx.fill();
        }
      } else {
        // Idle bars
        for (let i = 0; i < BARS; i++) {
          const h = 4 + Math.sin(Date.now() / 800 + i * 0.3) * 3;
          const x = i * (BAR_W + GAP);
          const y = (H - h) / 2;
          ctx.fillStyle = TEXT_MUTED;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.roundRect(x, y, BAR_W, h, 1.5);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={48}
      style={{ display: "block", margin: "0 auto" }}
    />
  );
}

// ── Status pill ─────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    idle: { label: "Ready", color: TEXT_MUTED, bg: "transparent", border: BORDER },
    recording: { label: "Recording", color: ACCENT, bg: "#00E67615", border: ACCENT + "40" },
    transcribing: { label: "Transcribing...", color: WARNING, bg: "#F59E0B15", border: WARNING + "40" },
    interpreting: { label: "Interpreting...", color: "#818CF8", bg: "#818CF815", border: "#818CF840" },
    done: { label: "Done", color: SUCCESS, bg: "#10B98115", border: SUCCESS + "40" },
    error: { label: "Error", color: ERROR, bg: "#EF444415", border: ERROR + "40" },
  };
  const c = config[status] || config.idle;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 12px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
        color: c.color, backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        textTransform: "uppercase",
      }}
    >
      {status === "recording" && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ERROR, animation: "blink 1s infinite" }} />
      )}
      {(status === "transcribing" || status === "interpreting") && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: c.color, animation: "blink 0.6s infinite" }} />
      )}
      {c.label}
    </span>
  );
}

// ── Log entry ───────────────────────────────────────────────
function LogEntry({ entry, index }: { entry: any; index: number }) {
  const statusColor = entry.error ? ERROR : entry.result ? SUCCESS : WARNING;
  const statusLabel = entry.error ? "ERROR" : entry.result ? "PROCESSED" : "PENDING";

  return (
    <div
      style={{
        padding: "12px 16px",
        backgroundColor: index === 0 ? BG_SURFACE : "transparent",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
          {entry.timestamp}
        </span>
        <span
          style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 4,
            backgroundColor: statusColor + "20", color: statusColor,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Transcript */}
      <p style={{ margin: "0 0 4px", fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
        {entry.transcript}
      </p>

      {/* AI interpretation preview */}
      {entry.result && entry.result.resolved && entry.result.resolved.length > 0 && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, backgroundColor: BG_DARK, border: `1px solid ${BORDER}` }}>
          {entry.result.resolved.map((r: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < entry.result.resolved.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>
                {r.player?.web_name || r.spoken_name}
              </span>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'JetBrains Mono', monospace" }}>
                {r.actions.map((a: any) => `${a.action}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ")}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: "'JetBrains Mono', monospace" }}>
                {r.totalPoints}pts
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {entry.error && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: ERROR }}>{entry.error}</p>
      )}

      {/* Pipeline timing */}
      {entry.result?.pipeline?.totalDuration && (
        <p style={{ margin: "4px 0 0", fontSize: 10, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
          Pipeline: {entry.result.pipeline.totalDuration}ms
          {entry.result.pipeline.steps?.map((s: any) => ` → ${s.name}: ${s.duration}ms`).join("")}
        </p>
      )}
    </div>
  );
}

// ── Duration display ────────────────────────────────────────
function RecordingTimer({ isRecording, startTime }: { isRecording: boolean; startTime: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !startTime) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(id);
  }, [isRecording, startTime]);

  if (!isRecording) return null;

  const secs = Math.floor(elapsed / 1000);
  const mins = Math.floor(secs / 60);
  const display = `${mins}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <span style={{ fontSize: 20, fontWeight: 600, color: ERROR, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>
      {display}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────
export default function VoiceCapture() {
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const formatTime = () =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });

  // ── Start recording ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      setErrorMsg("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      // Set up audio analyser for waveform
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      // MediaRecorder — prefer webm/opus, fallback to whatever's available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Handled in stopRecording
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect chunks every 250ms
      setStatus("recording");
      setRecordStartTime(Date.now());
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic access in your browser settings."
          : `Mic error: ${err.message}`
      );
    }
  }, []);

  // ── Stop recording & send to Whisper pipeline ─────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        // Clean up media resources
        streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        audioContextRef.current?.close();
        analyserRef.current = null;

        const blob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current!.mimeType,
        });

        if (blob.size < 1000) {
          setStatus("idle");
          setErrorMsg("Recording too short — try speaking for at least 1 second.");
          setRecordStartTime(null);
          resolve();
          return;
        }

        // Send to Whisper → GPT-4o Mini pipeline
        setStatus("transcribing");
        setRecordStartTime(null);

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          formData.append("matchId", selectedMatch || "1");

          const res = await fetch("/api/voice-admin/process", {
            method: "POST",
            body: formData,
          });

          setStatus("interpreting");

          const result = await res.json();

          if (res.ok) {
            const entry = {
              transcript: result.transcript || "(no transcript)",
              timestamp: formatTime(),
              result,
            };
            setLog((prev) => [entry, ...prev].slice(0, 50));
            setStatus("done");
            setTimeout(() => setStatus("idle"), 2000);
          } else {
            const entry = {
              transcript: result.transcript || "(failed)",
              timestamp: formatTime(),
              error: result.error || `HTTP ${res.status}`,
            };
            setLog((prev) => [entry, ...prev].slice(0, 50));
            setStatus("error");
            setErrorMsg(result.error || "Processing failed");
          }
        } catch (err) {
          const entry = {
            transcript: "(network error)",
            timestamp: formatTime(),
            error: "Network error — is the dev server running?",
          };
          setLog((prev) => [entry, ...prev].slice(0, 50));
          setStatus("error");
          setErrorMsg("Network error — check your dev server.");
        }

        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  }, [selectedMatch]);

  // ── Send text directly (skips Whisper) ────────────────────
  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setStatus("interpreting");

      const entry: any = { transcript: text, timestamp: formatTime() };
      try {
        const res = await fetch("/api/voice-admin/process-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, matchId: selectedMatch || "1" }),
        });
        const result = await res.json();

        if (res.ok) {
          entry.result = result;
        } else {
          entry.error = result.error || `HTTP ${res.status}`;
        }
      } catch (err) {
        entry.error = "Network error — is the dev server running?";
      }

      setLog((prev) => [entry, ...prev].slice(0, 50));
      setStatus("done");
      setTimeout(() => setStatus("idle"), 1500);
    },
    [selectedMatch]
  );

  const toggleRecording = () => {
    if (status === "recording") {
      stopRecording();
    } else if (status === "idle" || status === "done" || status === "error") {
      startRecording();
    }
  };

  const clearLog = () => setLog([]);
  const isRecording = status === "recording";
  const isProcessing = status === "transcribing" || status === "interpreting";

  // Demo matches (replace with real Supabase fetch)
  const demoMatches = [
    { id: "1", label: "GW12 — Arsenal vs Chelsea" },
    { id: "2", label: "GW12 — Liverpool vs Man City" },
    { id: "3", label: "GW12 — Spurs vs Man Utd" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: BG_DARK,
        color: TEXT_PRIMARY,
        fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif",
        padding: 0, margin: 0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: `linear-gradient(180deg, ${BG_CARD} 0%, ${BG_DARK} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}
          >
            🎙️
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Voice Admin</h1>
            <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500 }}>BUDO LEAGUE — Whisper + GPT-4o Mini</p>
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>

        {/* Match selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Active Match
          </label>
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px",
              backgroundColor: BG_SURFACE, color: TEXT_PRIMARY,
              border: `1px solid ${BORDER}`, borderRadius: 10,
              fontSize: 14, fontFamily: "inherit", outline: "none", cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center",
            }}
          >
            <option value="">Select a match...</option>
            {demoMatches.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* ── Mic Button Zone ──────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0 24px", marginBottom: 24 }}>

          {/* Recording timer */}
          <div style={{ height: 28, marginBottom: 16, display: "flex", alignItems: "center" }}>
            <RecordingTimer isRecording={isRecording} startTime={recordStartTime} />
            {isProcessing && (
              <div style={{
                width: 18, height: 18, border: `2px solid ${WARNING}`,
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            )}
          </div>

          {/* Mic button */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            {isRecording && (
              <>
                <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: `2px solid ${ERROR}40`, animation: "pulse-ring 2s ease-out infinite" }} />
                <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: `2px solid ${ERROR}30`, animation: "pulse-ring 2s ease-out infinite 0.5s" }} />
              </>
            )}

            <button
              onClick={toggleRecording}
              disabled={isProcessing}
              style={{
                width: 96, height: 96, borderRadius: "50%",
                border: isRecording ? `3px solid ${ERROR}` : `3px solid ${BORDER}`,
                backgroundColor: isRecording ? `${ERROR}20` : BG_SURFACE,
                cursor: isProcessing ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative", zIndex: 1,
                boxShadow: isRecording
                  ? `0 0 40px ${ERROR}30, 0 0 80px ${ERROR}10`
                  : "0 4px 24px rgba(0,0,0,0.3)",
                opacity: isProcessing ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {isRecording ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill={ERROR}>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* Waveform */}
          <Waveform isActive={isRecording} analyserRef={analyserRef} />

          {/* Hint */}
          <p style={{ marginTop: 16, fontSize: 13, color: TEXT_MUTED, textAlign: "center", fontWeight: 400, maxWidth: 320 }}>
            {isRecording
              ? "Recording — tap stop to send to Whisper"
              : isProcessing
                ? "Processing through Whisper → GPT-4o Mini..."
                : 'Tap the mic and say something like "Haaland scored twice"'}
          </p>
        </div>

        {/* ── Error display ────────────────────────────────── */}
        {errorMsg && (
          <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 24, backgroundColor: "#EF444415", border: `1px solid ${ERROR}30`, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: ERROR, lineHeight: 1.5 }}>{errorMsg}</p>
              <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 11, cursor: "pointer", marginTop: 4, padding: 0 }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Quick commands (text mode, skips Whisper) ───── */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
            Quick Test — tap to send text (skips Whisper)
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              "Haaland scored twice",
              "Salah goal and assist",
              "Clean sheet for Arsenal",
              "Yellow card for Bruno",
              "Penalty saved by Raya",
            ].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendText(cmd)}
                disabled={isProcessing}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                  color: TEXT_SECONDARY, fontSize: 12, fontWeight: 500,
                  cursor: isProcessing ? "wait" : "pointer",
                  fontFamily: "inherit", transition: "all 0.2s ease",
                  opacity: isProcessing ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = ACCENT + "60";
                    e.currentTarget.style.color = ACCENT;
                    e.currentTarget.style.backgroundColor = `${ACCENT}10`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.color = TEXT_SECONDARY;
                  e.currentTarget.style.backgroundColor = BG_SURFACE;
                }}
              >
                "{cmd}"
              </button>
            ))}
          </div>
        </div>

        {/* ── Command Log ─────────────────────────────────── */}
        <div style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
              Command Log ({log.length})
            </span>
            {log.length > 0 && (
              <button onClick={clearLog} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: TEXT_MUTED, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                CLEAR
              </button>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {log.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED }}>
                  No commands yet. Tap the mic or use a quick test.
                </p>
              </div>
            ) : (
              log.map((entry, i) => <LogEntry key={i} entry={entry} index={i} />)
            )}
          </div>
        </div>

        {/* ── Pipeline info ────────────────────────────────── */}
        <div style={{ marginTop: 24, padding: "16px", borderRadius: 10, backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
          <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
            <span style={{ color: TEXT_SECONDARY }}>Pipeline:</span>{" "}
            Browser Mic → MediaRecorder → <span style={{ color: ACCENT }}>Whisper API</span> → <span style={{ color: "#818CF8" }}>GPT-4o Mini</span> → Fuzzy Match → Points Calc
            <br />
            <span style={{ color: TEXT_SECONDARY }}>Audio route:</span>{" "}
            POST /api/voice-admin/process (multipart/form-data)
            <br />
            <span style={{ color: TEXT_SECONDARY }}>Text route:</span>{" "}
            POST /api/voice-admin/process-text (JSON)
          </p>
        </div>
      </div>
    </div>
  );
}