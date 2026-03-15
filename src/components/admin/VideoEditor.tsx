"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ── Style tokens ──────────────────────────────────────────────────────── */

const BG = "#111827";
const SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const ERROR = "#EF4444";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Props = {
  file: File;
  onDone: (trimmedBlob: Blob, thumbnailBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
};

/* ── Component ─────────────────────────────────────────────────────────── */

export default function VideoEditor({ file, onDone, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Load video
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setEndTime(Math.min(v.duration, 120)); // Max 2 min default
    captureThumbnail(0.5);
  }, []);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  }, []);

  function captureThumbnail(time?: number) {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    const targetTime = time ?? v.currentTime;
    v.currentTime = targetTime;

    // Wait for seek to complete
    const handleSeeked = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      const url = canvas.toDataURL("image/jpeg", 0.85);
      setThumbnailUrl(url);
      v.removeEventListener("seeked", handleSeeked);
    };
    v.addEventListener("seeked", handleSeeked);
  }

  function handlePreview() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startTime;
    v.play();
  }

  async function handleApply() {
    setProcessing(true);
    setError("");

    try {
      // For the trimmed video, we pass the original file with trim metadata
      // (actual trimming requires server-side FFmpeg, so we store start/end)
      // For now, we attach trim info and let the server handle it
      // or pass the original file if no trimming is needed

      // Generate thumbnail blob
      const canvas = canvasRef.current!;
      const v = videoRef.current;
      if (v) {
        const ctx = canvas.getContext("2d")!;
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 360;
        v.currentTime = startTime + (endTime - startTime) / 4; // thumbnail at 25% of clip

        await new Promise<void>((resolve) => {
          const h = () => {
            ctx.drawImage(v, 0, 0);
            v.removeEventListener("seeked", h);
            resolve();
          };
          v.addEventListener("seeked", h);
        });
      }

      const thumbBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Thumbnail failed"))),
          "image/jpeg",
          0.85
        );
      });

      // Create a new file with trim metadata in the name
      const trimmedFile = new File(
        [file],
        `video_${startTime.toFixed(1)}-${endTime.toFixed(1)}_${file.name}`,
        { type: file.type }
      );

      const previewUrl = thumbnailUrl || URL.createObjectURL(thumbBlob);
      onDone(trimmedFile, thumbBlob, previewUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to process video");
    } finally {
      setProcessing(false);
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (!videoUrl) return null;

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Edit Video</span>
        <span style={{ fontSize: 12, color: MUTED }}>
          {formatTime(endTime - startTime)} selected
        </span>
      </div>

      {/* Video preview */}
      <div style={{ marginBottom: 12, background: "#000", borderRadius: 8, overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          controls
          style={{ width: "100%", maxHeight: 280, display: "block" }}
        />
      </div>

      {/* Trim controls */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 6 }}>
          Trim: {formatTime(startTime)} — {formatTime(endTime)}
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>Start</div>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={startTime}
              onChange={(e) => {
                const v = +e.target.value;
                setStartTime(Math.min(v, endTime - 1));
              }}
              style={{ width: "100%", accentColor: ACCENT }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>End</div>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const v = +e.target.value;
                setEndTime(Math.max(v, startTime + 1));
              }}
              style={{ width: "100%", accentColor: ACCENT }}
            />
          </div>
        </div>
      </div>

      {/* Thumbnail */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: MUTED }}>Thumbnail</span>
          <button
            type="button"
            onClick={() => captureThumbnail()}
            style={{
              fontSize: 11,
              color: ACCENT,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Capture current frame
          </button>
        </div>
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            style={{
              width: 160,
              height: 90,
              objectFit: "cover",
              borderRadius: 6,
              border: `1px solid ${BORDER}`,
            }}
          />
        )}
      </div>

      {/* Preview button */}
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={handlePreview}
          style={{
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            color: TEXT,
            cursor: "pointer",
          }}
        >
          Preview Clip
        </button>
      </div>

      {error && (
        <div style={{ color: ERROR, fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: TEXT,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={processing}
          style={{
            padding: "8px 24px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            background: ACCENT,
            color: "#000",
            cursor: processing ? "not-allowed" : "pointer",
            opacity: processing ? 0.6 : 1,
          }}
        >
          {processing ? "Processing..." : "Apply"}
        </button>
      </div>
    </div>
  );
}
