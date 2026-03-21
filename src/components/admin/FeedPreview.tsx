"use client";

import DOMPurify from "dompurify";
import type { LayoutType } from "./LayoutPicker";

/* ── Style tokens (simulates user-facing theme) ────────────────────────── */

const CARD_BG = "#1c1c1e"; // simulates dark card
const TEXT_W = "#ffffff";
const TEXT_S = "#a1a1aa";

/* ── Category pill (matches dashboard) ─────────────────────────────────── */

function PreviewPill({ category }: { category: string }) {
  const colors: Record<string, string> = {
    announcement: "#F59E0B",
    matchday: "#3B82F6",
    player_spotlight: "#10B981",
    deadline: "#EF4444",
    general: "#8B5CF6",
  };
  return (
    <span
      style={{
        background: colors[category] ?? "#8B5CF6",
        color: "#fff",
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {category.replace("_", " ")}
    </span>
  );
}

/* ── Props ─────────────────────────────────────────────────────────────── */

type Props = {
  layout: LayoutType;
  title: string;
  bodyHtml: string;
  category: string;
  imagePreview: string | null;
  videoPreview: string | null;
  galleryPreviews: string[];
};

/* ── Component ─────────────────────────────────────────────────────────── */

export default function FeedPreview({
  layout,
  title,
  bodyHtml,
  category,
  imagePreview,
  videoPreview,
  galleryPreviews,
}: Props) {
  const mediaUrl = videoPreview || imagePreview;
  const displayTitle = title || "Your headline here...";
  const rawBody = bodyHtml || "<p>Your story content will appear here...</p>";
  const displayBody = typeof window !== "undefined" ? DOMPurify.sanitize(rawBody) : rawBody;

  const containerStyle: React.CSSProperties = {
    borderRadius: "1.2rem",
    overflow: "hidden",
    background: CARD_BG,
    maxWidth: 380,
    margin: "0 auto",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
  };

  // ── Hero layout ──
  if (layout === "hero") {
    return (
      <div style={containerStyle}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
          {mediaUrl ? (
            videoPreview ? (
              <video
                src={videoPreview}
                muted
                loop
                autoPlay
                playsInline
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <img src={mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: TEXT_S, fontSize: 13 }}>Image preview</span>
            </div>
          )}
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <PreviewPill category={category} />
          </div>
          <div style={{ color: TEXT_W, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{displayTitle}</div>
          <div
            style={{ color: TEXT_S, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}
            dangerouslySetInnerHTML={{ __html: displayBody }}
          />
        </div>
      </div>
    );
  }

  // ── Split layout ──
  if (layout === "split") {
    return (
      <div style={{ ...containerStyle, display: "flex" }}>
        <div style={{ width: "40%", flexShrink: 0, position: "relative", aspectRatio: "4/3" }}>
          {mediaUrl ? (
            <img src={mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: TEXT_S, fontSize: 11 }}>Image</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <PreviewPill category={category} />
          <div style={{ color: TEXT_W, fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{displayTitle}</div>
          <div
            style={{ color: TEXT_S, fontSize: 11, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: displayBody }}
          />
        </div>
      </div>
    );
  }

  // ── Feature layout ──
  if (layout === "feature") {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 16, paddingBottom: 8 }}>
          <PreviewPill category={category} />
          <div style={{ color: TEXT_W, fontWeight: 800, fontSize: 20, marginTop: 8, lineHeight: 1.2 }}>{displayTitle}</div>
          <div
            style={{ color: TEXT_S, fontSize: 12, marginTop: 8, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: displayBody }}
          />
        </div>
        {mediaUrl && (
          <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
            <img src={mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}
      </div>
    );
  }

  // ── Gallery layout ──
  if (layout === "gallery") {
    const previews = galleryPreviews.length > 0 ? galleryPreviews : (mediaUrl ? [mediaUrl] : []);
    return (
      <div style={containerStyle}>
        <div style={{ padding: 14, paddingBottom: 8 }}>
          <PreviewPill category={category} />
          <div style={{ color: TEXT_W, fontWeight: 700, fontSize: 15, marginTop: 6, lineHeight: 1.3 }}>{displayTitle}</div>
        </div>
        {previews.length > 0 && (
          <div style={{ display: "flex", gap: 2, overflow: "hidden", padding: "0 2px 2px" }}>
            {previews.slice(0, 4).map((url, i) => (
              <div key={i} style={{ flex: 1, position: "relative", aspectRatio: "4/3" }}>
                <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 4 }} />
                {i === 3 && previews.length > 4 && (
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: TEXT_W, fontWeight: 700, fontSize: 16, borderRadius: 4,
                  }}>
                    +{previews.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {previews.length === 0 && (
          <div style={{ height: 80, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 14px 14px" , borderRadius: 8 }}>
            <span style={{ color: TEXT_S, fontSize: 12 }}>Add images to see gallery preview</span>
          </div>
        )}
        <div
          style={{ color: TEXT_S, fontSize: 11, padding: "6px 14px 14px", lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: displayBody }}
        />
      </div>
    );
  }

  // ── Video layout ──
  if (layout === "video") {
    return (
      <div style={containerStyle}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
          {videoPreview ? (
            <video
              src={videoPreview}
              muted
              loop
              autoPlay
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : mediaUrl ? (
            <img src={mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: TEXT_S, fontSize: 13 }}>Upload a video</span>
            </div>
          )}
          {/* Play button overlay */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 0, height: 0, borderLeft: "16px solid white", borderTop: "10px solid transparent", borderBottom: "10px solid transparent", marginLeft: 4 }} />
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <PreviewPill category={category} />
          <div style={{ color: TEXT_W, fontWeight: 700, fontSize: 15, marginTop: 6, lineHeight: 1.3 }}>{displayTitle}</div>
          <div
            style={{ color: TEXT_S, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: displayBody }}
          />
        </div>
      </div>
    );
  }

  // ── Quick update layout ──
  return (
    <div style={{ ...containerStyle, borderLeft: `4px solid #8B5CF6` }}>
      <div style={{ padding: 16 }}>
        <PreviewPill category={category} />
        <div style={{ color: TEXT_W, fontWeight: 700, fontSize: 15, marginTop: 8, lineHeight: 1.3 }}>{displayTitle}</div>
        <div
          style={{ color: TEXT_S, fontSize: 12, marginTop: 8, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: displayBody }}
        />
      </div>
    </div>
  );
}
