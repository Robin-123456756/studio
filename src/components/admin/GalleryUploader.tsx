"use client";

import { useState, useRef } from "react";

/* ── Style tokens ──────────────────────────────────────────────────────── */

const SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const ERROR = "#EF4444";

/* ── Types ─────────────────────────────────────────────────────────────── */

export type GalleryImage = {
  id: string;
  file: File;
  preview: string;
  caption: string;
};

type Props = {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  max?: number;
};

/* ── Component ─────────────────────────────────────────────────────────── */

export default function GalleryUploader({ images, onChange, max = 6 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function addFiles(files: FileList | File[]) {
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
    const arr = Array.from(files).slice(0, max - images.length);
    const newImages: GalleryImage[] = arr
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE)
      .map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        preview: URL.createObjectURL(f),
        caption: "",
      }));
    onChange([...images, ...newImages]);
  }

  function removeImage(id: string) {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    onChange(images.filter((i) => i.id !== id));
  }

  function updateCaption(id: string, caption: string) {
    onChange(images.map((i) => (i.id === id ? { ...i, caption } : i)));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  // Reorder via drag
  function moveImage(from: number, to: number) {
    const arr = [...images];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: MUTED, marginBottom: 6 }}>
        Gallery Images ({images.length}/{max})
      </label>

      {/* Drop zone */}
      {images.length < max && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? ACCENT : BORDER}`,
            borderRadius: 10,
            padding: "24px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? ACCENT + "10" : SURFACE,
            marginBottom: 12,
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
          <div style={{ fontSize: 13, color: MUTED }}>
            Drop images here or click to browse
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            JPEG, PNG, WebP &middot; Max 3MB each &middot; Up to {max} images
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) moveImage(dragIdx, idx);
                setDragIdx(null);
              }}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                overflow: "hidden",
                background: SURFACE,
                cursor: "grab",
              }}
            >
              <div style={{ position: "relative" }}>
                <img
                  src={img.preview}
                  alt={`Gallery ${idx + 1}`}
                  style={{
                    width: "100%",
                    height: 100,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "none",
                    background: ERROR,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Remove"
                >
                  ×
                </button>
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 4,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {idx + 1}
                </div>
              </div>
              <input
                type="text"
                value={img.caption}
                onChange={(e) => updateCaption(img.id, e.target.value)}
                placeholder="Caption (optional)"
                maxLength={100}
                style={{
                  width: "100%",
                  fontSize: 11,
                  color: TEXT,
                  background: "transparent",
                  border: "none",
                  borderTop: `1px solid ${BORDER}`,
                  padding: "6px 8px",
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
