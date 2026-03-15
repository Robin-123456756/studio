"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

/* ── Types ─────────────────────────────────────────────────────────────── */

type AspectPreset = { label: string; value: number | undefined };

const ASPECT_PRESETS: AspectPreset[] = [
  { label: "Free", value: undefined },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "9:16", value: 9 / 16 },
];

type Props = {
  file: File;
  onDone: (editedBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Apply brightness/contrast/saturation via CSS filter string */
function filterString(b: number, c: number, s: number) {
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function ImageEditor({ file, onDone, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState("");

  // Crop state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);

  // Adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Rotation
  const [rotation, setRotation] = useState(0); // degrees: 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Tab
  const [tab, setTab] = useState<"crop" | "adjust" | "rotate">("crop");
  const [processing, setProcessing] = useState(false);

  // Load file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget;
    },
    []
  );

  /** Render final image to canvas and return blob */
  async function exportImage(): Promise<Blob> {
    const img = imgRef.current;
    if (!img) throw new Error("Image not loaded");

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // Source dimensions (cropped area or full image)
    let sx = 0,
      sy = 0,
      sw = img.naturalWidth,
      sh = img.naturalHeight;
    if (completedCrop) {
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      sx = completedCrop.x * scaleX;
      sy = completedCrop.y * scaleY;
      sw = completedCrop.width * scaleX;
      sh = completedCrop.height * scaleY;
    }

    // Account for rotation in output dimensions
    const rotated = rotation % 180 !== 0;
    const outW = rotated ? sh : sw;
    const outH = rotated ? sw : sh;

    canvas.width = outW;
    canvas.height = outH;

    ctx.clearRect(0, 0, outW, outH);
    ctx.filter = filterString(brightness, contrast, saturation);

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
        file.type === "image/png" ? "image/png" : "image/jpeg",
        0.92
      );
    });
  }

  async function handleApply() {
    setProcessing(true);
    try {
      const blob = await exportImage();
      const url = URL.createObjectURL(blob);
      onDone(blob, url);
    } catch {
      // fallback — use original
      onDone(file, imgSrc);
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }

  // Inline style tokens (admin dark theme)
  const BG = "#111827";
  const SURFACE = "#1A2236";
  const BORDER = "#1E293B";
  const ACCENT = "#00E676";
  const TEXT = "#F1F5F9";
  const MUTED = "#64748B";

  const sliderStyle: React.CSSProperties = {
    width: "100%",
    accentColor: ACCENT,
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: active ? ACCENT : SURFACE,
    color: active ? "#000" : TEXT,
  });

  if (!imgSrc) return null;

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Edit Image</span>
        <button onClick={handleReset} style={{ fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer" }}>
          Reset All
        </button>
      </div>

      {/* Image preview with crop */}
      <div style={{ marginBottom: 12, background: "#000", borderRadius: 8, overflow: "hidden", maxHeight: 320, display: "flex", justifyContent: "center" }}>
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
          disabled={tab !== "crop"}
        >
          <img
            src={imgSrc}
            alt="Edit"
            onLoad={onImageLoad}
            style={{
              maxHeight: 320,
              maxWidth: "100%",
              objectFit: "contain",
              filter: filterString(brightness, contrast, saturation),
              transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transition: "filter 0.15s, transform 0.2s",
            }}
          />
        </ReactCrop>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["crop", "adjust", "rotate"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tabBtnStyle(tab === t)}>
            {t === "crop" ? "Crop" : t === "adjust" ? "Adjust" : "Rotate"}
          </button>
        ))}
      </div>

      {/* Crop controls */}
      {tab === "crop" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setAspect(p.value);
                setCrop(undefined);
                setCompletedCrop(undefined);
              }}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: `1px solid ${aspect === p.value ? ACCENT : BORDER}`,
                background: aspect === p.value ? ACCENT + "20" : SURFACE,
                color: aspect === p.value ? ACCENT : TEXT,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Adjust controls */}
      {tab === "adjust" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: MUTED }}>
            Brightness: {brightness}%
            <input type="range" min={30} max={200} value={brightness} onChange={(e) => setBrightness(+e.target.value)} style={sliderStyle} />
          </label>
          <label style={{ fontSize: 12, color: MUTED }}>
            Contrast: {contrast}%
            <input type="range" min={30} max={200} value={contrast} onChange={(e) => setContrast(+e.target.value)} style={sliderStyle} />
          </label>
          <label style={{ fontSize: 12, color: MUTED }}>
            Saturation: {saturation}%
            <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(+e.target.value)} style={sliderStyle} />
          </label>
        </div>
      )}

      {/* Rotate / Flip controls */}
      {tab === "rotate" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            style={{ ...tabBtnStyle(false), fontSize: 12 }}
          >
            Rotate 90°
          </button>
          <button
            onClick={() => setFlipH((f) => !f)}
            style={{ ...tabBtnStyle(flipH), fontSize: 12 }}
          >
            Flip H
          </button>
          <button
            onClick={() => setFlipV((f) => !f)}
            style={{ ...tabBtnStyle(flipV), fontSize: 12 }}
          >
            Flip V
          </button>
        </div>
      )}

      {/* Hidden export canvas */}
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
          {processing ? "Processing..." : "Apply Edits"}
        </button>
      </div>
    </div>
  );
}
