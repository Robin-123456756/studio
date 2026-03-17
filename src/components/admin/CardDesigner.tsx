"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Palette, Type, Award, SlidersHorizontal, Sun, Contrast,
  Droplets, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Bold, Move, Image as ImageIcon,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────────── */

export type TextOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  textShadow: boolean;
};

export type CardDesign = {
  filters: { brightness: number; contrast: number; saturation: number };
  filterPreset: string;
  overlayColor: string;
  overlayOpacity: number;
  textOverlays: TextOverlay[];
  badge: string | null;
  imagePosition: { x: number; y: number };
};

export const DEFAULT_CARD_DESIGN: CardDesign = {
  filters: { brightness: 100, contrast: 100, saturation: 100 },
  filterPreset: "original",
  overlayColor: "#000000",
  overlayOpacity: 60,
  textOverlays: [],
  badge: null,
  imagePosition: { x: 50, y: 50 },
};

/* ── Constants ───────────────────────────────────────────────────── */

const FILTER_PRESETS = [
  { name: "Original", key: "original", icon: "✨", filters: { brightness: 100, contrast: 100, saturation: 100 } },
  { name: "Warm", key: "warm", icon: "🌅", filters: { brightness: 105, contrast: 105, saturation: 130 } },
  { name: "Cool", key: "cool", icon: "❄️", filters: { brightness: 100, contrast: 110, saturation: 80 } },
  { name: "Vintage", key: "vintage", icon: "📷", filters: { brightness: 110, contrast: 85, saturation: 65 } },
  { name: "B&W", key: "bw", icon: "⬛", filters: { brightness: 105, contrast: 130, saturation: 0 } },
  { name: "Vivid", key: "vivid", icon: "🎨", filters: { brightness: 100, contrast: 115, saturation: 150 } },
  { name: "Dramatic", key: "dramatic", icon: "🎭", filters: { brightness: 85, contrast: 145, saturation: 110 } },
  { name: "Fade", key: "fade", icon: "🌫️", filters: { brightness: 120, contrast: 80, saturation: 85 } },
];

const BADGES = [
  { key: "breaking", label: "BREAKING", bg: "#DC2626" },
  { key: "matchday", label: "MATCH DAY", bg: "#3B82F6" },
  { key: "live", label: "🔴 LIVE", bg: "#EF4444" },
  { key: "new", label: "NEW", bg: "#10B981" },
  { key: "exclusive", label: "EXCLUSIVE", bg: "#7C3AED" },
  { key: "transfer", label: "TRANSFER", bg: "#F59E0B" },
  { key: "update", label: "UPDATE", bg: "#0EA5E9" },
  { key: "rumour", label: "RUMOUR", bg: "#EC4899" },
];

const OVERLAY_COLORS = [
  "#000000", "#1a1a2e", "#16213e", "#0f3460",
  "#1b1b2f", "#2d132c", "#3a0ca3", "#001524",
];

const TEXT_COLORS = [
  "#FFFFFF", "#000000", "#F59E0B", "#EF4444",
  "#3B82F6", "#10B981", "#8B5CF6", "#EC4899",
];

/* ── Helpers ─────────────────────────────────────────────────────── */

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── Component ───────────────────────────────────────────────────── */

type Props = {
  imagePreview: string | null;
  title: string;
  category: string;
  catHex: Record<string, string>;
  design: CardDesign;
  onChange: (design: CardDesign) => void;
};

export default function CardDesigner({
  imagePreview, title, category, catHex, design, onChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const imgDragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number;
  } | null>(null);

  /* Update helpers */
  const update = (partial: Partial<CardDesign>) => onChange({ ...design, ...partial });

  const updateFilter = (key: keyof CardDesign["filters"], value: number) => {
    onChange({
      ...design,
      filters: { ...design.filters, [key]: value },
      filterPreset: "custom",
    });
  };

  /* Text overlay helpers */
  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: crypto.randomUUID(),
      text: "Your text here",
      x: 50,
      y: 30,
      fontSize: 18,
      color: "#FFFFFF",
      fontWeight: "bold",
      textShadow: true,
    };
    update({ textOverlays: [...design.textOverlays, newText] });
  };

  const updateTextOverlay = (id: string, partial: Partial<TextOverlay>) => {
    update({
      textOverlays: design.textOverlays.map((t) =>
        t.id === id ? { ...t, ...partial } : t
      ),
    });
  };

  const removeTextOverlay = (id: string) => {
    update({ textOverlays: design.textOverlays.filter((t) => t.id !== id) });
  };

  /* CSS filter string */
  const filterStr = `brightness(${design.filters.brightness}%) contrast(${design.filters.contrast}%) saturate(${design.filters.saturation}%)`;

  return (
    <div className="space-y-4">
      {/* ── Live Card Preview ────────────────────────────────────── */}
      <div className="text-center text-xs text-muted-foreground mb-1 bg-muted/30 rounded-lg py-2">
        Design your card — drag the image to reposition, drag text overlays to place them
      </div>

      <div
        ref={canvasRef}
        className="relative rounded-xl overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
        style={{ minHeight: 260 }}
        onPointerDown={(e) => {
          // Check if clicking on a text overlay (handled by its own handler)
          if ((e.target as HTMLElement).closest("[data-text-overlay]")) return;
          if (!imagePreview) return;
          imgDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: design.imagePosition.x,
            origY: design.imagePosition.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragRef.current) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const newX = Math.max(5, Math.min(95, dragRef.current.origX + (dx / rect.width) * 100));
            const newY = Math.max(5, Math.min(95, dragRef.current.origY + (dy / rect.height) * 100));
            updateTextOverlay(dragRef.current.id, { x: newX, y: newY });
          } else if (imgDragRef.current) {
            const dx = e.clientX - imgDragRef.current.startX;
            const dy = e.clientY - imgDragRef.current.startY;
            update({
              imagePosition: {
                x: Math.max(0, Math.min(100, imgDragRef.current.origX - dx * 0.5)),
                y: Math.max(0, Math.min(100, imgDragRef.current.origY - dy * 0.5)),
              },
            });
          }
        }}
        onPointerUp={() => {
          dragRef.current = null;
          imgDragRef.current = null;
        }}
      >
        {/* Image layer with filters */}
        {imagePreview ? (
          <img
            src={imagePreview}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{
              objectPosition: `${design.imagePosition.x}% ${design.imagePosition.y}%`,
              filter: filterStr,
            }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${design.overlayColor}, ${hexToRgba(design.overlayColor, 0.5)})`,
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${hexToRgba(design.overlayColor, design.overlayOpacity / 100)} 0%, ${hexToRgba(design.overlayColor, design.overlayOpacity / 300)} 50%, transparent 100%)`,
          }}
        />

        {/* Badge stamp */}
        {design.badge && (() => {
          const b = BADGES.find((badge) => badge.key === design.badge);
          return b ? (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest text-white shadow-lg pointer-events-none"
              style={{ backgroundColor: b.bg }}
            >
              {b.label}
            </div>
          ) : null;
        })()}

        {/* Text overlays (draggable) */}
        {design.textOverlays.map((t) => (
          <div
            key={t.id}
            data-text-overlay="true"
            className="absolute cursor-move select-none"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform: "translate(-50%, -50%)",
              fontSize: t.fontSize,
              color: t.color,
              fontWeight: t.fontWeight === "bold" ? 700 : 400,
              textShadow: t.textShadow
                ? "0 2px 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)"
                : "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              dragRef.current = {
                id: t.id,
                startX: e.clientX,
                startY: e.clientY,
                origX: t.x,
                origY: t.y,
              };
              canvasRef.current?.setPointerCapture(e.pointerId);
            }}
          >
            <div className="flex items-center gap-1">
              <GripVertical className="h-3 w-3 opacity-50" />
              {t.text}
            </div>
          </div>
        ))}

        {/* Title + Category (from compose tab) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
          <div className="text-base font-bold leading-tight line-clamp-2 mb-1.5" style={{
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}>
            {title || "Your headline here..."}
          </div>
          <span
            className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: catHex[category] ?? "#8B5CF6" }}
          >
            {category.replace("_", " ")}
          </span>
        </div>

        {/* Reposition hint */}
        {imagePreview && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 text-white text-[10px] pointer-events-none">
            <Move className="h-3 w-3" />
            Drag to reposition
          </div>
        )}
      </div>

      {/* ── Design Tools ─────────────────────────────────────────── */}

      {/* Filter Presets */}
      <ToolSection title="Filters" icon={<Palette className="h-4 w-4" />} defaultOpen>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {FILTER_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => update({ filterPreset: p.key, filters: { ...p.filters } })}
              className={cn(
                "rounded-lg border p-2 text-center transition-all",
                design.filterPreset === p.key
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="text-base mb-0.5">{p.icon}</div>
              <div className="text-[10px] font-medium truncate">{p.name}</div>
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <FilterSlider
            label="Brightness"
            icon={<Sun className="h-3.5 w-3.5" />}
            value={design.filters.brightness}
            min={50}
            max={150}
            onChange={(v) => updateFilter("brightness", v)}
          />
          <FilterSlider
            label="Contrast"
            icon={<Contrast className="h-3.5 w-3.5" />}
            value={design.filters.contrast}
            min={50}
            max={150}
            onChange={(v) => updateFilter("contrast", v)}
          />
          <FilterSlider
            label="Saturation"
            icon={<Droplets className="h-3.5 w-3.5" />}
            value={design.filters.saturation}
            min={0}
            max={200}
            onChange={(v) => updateFilter("saturation", v)}
          />
        </div>

        {design.filterPreset === "custom" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-muted-foreground"
            onClick={() => update({
              filterPreset: "original",
              filters: { brightness: 100, contrast: 100, saturation: 100 },
            })}
          >
            Reset to original
          </Button>
        )}
      </ToolSection>

      {/* Overlay */}
      <ToolSection title="Overlay" icon={<SlidersHorizontal className="h-4 w-4" />}>
        <p className="text-[11px] text-muted-foreground mb-2">
          Choose a gradient overlay color for text readability
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update({ overlayColor: c })}
              className={cn(
                "w-9 h-9 rounded-lg border-2 transition-all",
                design.overlayColor === c
                  ? "border-primary scale-110 shadow-md"
                  : "border-border hover:border-primary/30"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="w-9 h-9 rounded-lg border-2 border-dashed border-border cursor-pointer flex items-center justify-center hover:border-primary/50 transition-colors overflow-hidden relative">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="color"
              value={design.overlayColor}
              onChange={(e) => update({ overlayColor: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>
        <FilterSlider
          label="Opacity"
          icon={<Droplets className="h-3.5 w-3.5" />}
          value={design.overlayOpacity}
          min={0}
          max={100}
          onChange={(v) => update({ overlayOpacity: v })}
          suffix="%"
        />
      </ToolSection>

      {/* Text Overlays */}
      <ToolSection title="Text Overlays" icon={<Type className="h-4 w-4" />}>
        <p className="text-[11px] text-muted-foreground mb-2">
          Add custom text layers and drag them on the card to position
        </p>

        {design.textOverlays.map((t) => (
          <div key={t.id} className="rounded-lg border border-border p-2.5 mb-2 space-y-2">
            <div className="flex gap-2">
              <Input
                value={t.text}
                onChange={(e) => updateTextOverlay(t.id, { text: e.target.value })}
                className="text-xs h-8 flex-1"
                placeholder="Enter text..."
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 hover:text-destructive"
                onClick={() => removeTextOverlay(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={t.fontSize}
                onChange={(e) => updateTextOverlay(t.id, { fontSize: Number(e.target.value) })}
                className="h-7 text-xs rounded border border-input bg-background px-1.5"
              >
                {[12, 14, 16, 18, 20, 24, 28, 32, 40].map((s) => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateTextOverlay(t.id, {
                  fontWeight: t.fontWeight === "bold" ? "normal" : "bold",
                })}
                className={cn(
                  "h-7 w-7 rounded border flex items-center justify-center transition-colors",
                  t.fontWeight === "bold"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-muted"
                )}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-5 bg-border mx-0.5" />
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateTextOverlay(t.id, { color: c })}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all",
                    t.color === c ? "border-primary scale-125 shadow-sm" : "border-border"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={addTextOverlay}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Text Layer
        </Button>
      </ToolSection>

      {/* Badge Stamps */}
      <ToolSection title="Badges" icon={<Award className="h-4 w-4" />}>
        <p className="text-[11px] text-muted-foreground mb-2">
          Add a stamp badge to the top of your card
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BADGES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => update({ badge: design.badge === b.key ? null : b.key })}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all",
                design.badge === b.key
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                  : "opacity-70 hover:opacity-100 hover:scale-105"
              )}
              style={{ backgroundColor: b.bg }}
            >
              {b.label}
            </button>
          ))}
        </div>
        {design.badge && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-muted-foreground"
            onClick={() => update({ badge: null })}
          >
            Remove badge
          </Button>
        )}
      </ToolSection>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function ToolSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
      >
        {icon}
        {title}
        <div className="flex-1" />
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

function FilterSlider({
  label,
  icon,
  value,
  min,
  max,
  onChange,
  suffix = "",
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-24 shrink-0">
        {icon} {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />
      <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
        {value}{suffix}
      </span>
    </div>
  );
}
