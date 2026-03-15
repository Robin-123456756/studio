"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Admin theme tokens
const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#CBD5E1";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";

const CATEGORIES = [
  { value: "announcement", label: "Announcement", color: "#F59E0B" },
  { value: "matchday", label: "Match Day", color: "#3B82F6" },
  { value: "player_spotlight", label: "Player Spotlight", color: "#10B981" },
  { value: "deadline", label: "Deadline", color: "#EF4444" },
  { value: "general", label: "General", color: "#8B5CF6" },
] as const;

type FeedItem = {
  id: number;
  title: string;
  body: string | null;
  image_url: string;
  category: string;
  is_pinned: boolean;
  is_active: boolean;
  gameweek_id: number | null;
  created_at: string;
};

export default function FeedMediaPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [isPinned, setIsPinned] = useState(false);
  const [gameweekId, setGameweekId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    try {
      const res = await fetch("/api/admin/feed-media", { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        setItems(json.items ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) loadItems();
  }, [session]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select an image.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      if (body.trim()) fd.append("body", body.trim());
      fd.append("category", category);
      fd.append("is_pinned", String(isPinned));
      if (gameweekId) fd.append("gameweek_id", gameweekId);

      const res = await fetch("/api/admin/feed-media", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Upload failed.");
        return;
      }

      setSuccess("Feed item created!");
      setTitle("");
      setBody("");
      setCategory("general");
      setIsPinned(false);
      setGameweekId("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      loadItems();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this feed item?")) return;
    try {
      const res = await fetch(`/api/admin/feed-media?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        loadItems();
      }
    } catch {
      // non-fatal
    }
  };

  const catColor = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.color ?? TEXT_MUTED;

  if (status === "loading") {
    return <div style={{ padding: 32, color: TEXT_MUTED }}>Loading...</div>;
  }
  const userRole = (session?.user as any)?.role as string | undefined;
  const isSuperAdmin = !userRole || userRole === "superadmin";

  if (!session?.user || !isSuperAdmin) {
    return (
      <div style={{ padding: 32, color: ERROR, fontWeight: 600 }}>
        Access denied. {!session?.user ? "Please log in as admin." : "Superadmin access required."}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin"
          style={{ color: ACCENT, fontSize: 13, textDecoration: "none" }}
        >
          &larr; Back to Admin
        </Link>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            marginTop: 8,
          }}
        >
          Feed Media Manager
        </h1>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14, marginTop: 4 }}>
          Upload images and announcements for the dashboard &ldquo;Latest&rdquo; feed.
        </p>
      </div>

      {/* Upload Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16 }}>
          New Feed Item
        </h2>

        {/* Image upload + preview */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
            Image *
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            style={{
              display: "block",
              fontSize: 13,
              color: TEXT_PRIMARY,
              background: BG_SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "8px 12px",
              width: "100%",
            }}
          />
          {preview && (
            <div style={{ marginTop: 10 }}>
              <img
                src={preview}
                alt="Preview"
                style={{
                  width: "100%",
                  maxHeight: 200,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                }}
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GW6 Preview: Top picks this weekend"
            maxLength={120}
            style={{
              width: "100%",
              fontSize: 14,
              color: TEXT_PRIMARY,
              background: BG_SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "8px 12px",
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
            Description (optional)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Brief description or details..."
            maxLength={500}
            style={{
              width: "100%",
              fontSize: 14,
              color: TEXT_PRIMARY,
              background: BG_SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "8px 12px",
              resize: "vertical",
            }}
          />
        </div>

        {/* Category + Gameweek row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                fontSize: 14,
                color: TEXT_PRIMARY,
                background: BG_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
              Gameweek (optional)
            </label>
            <input
              type="number"
              value={gameweekId}
              onChange={(e) => setGameweekId(e.target.value)}
              placeholder="e.g. 6"
              min={1}
              style={{
                width: "100%",
                fontSize: 14,
                color: TEXT_PRIMARY,
                background: BG_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            />
          </div>
        </div>

        {/* Pin toggle */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: TEXT_PRIMARY,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Pin to top of feed
          </label>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ color: ERROR, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: ACCENT, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading}
          style={{
            background: ACCENT,
            color: "#000",
            fontWeight: 600,
            fontSize: 14,
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading..." : "Publish to Feed"}
        </button>
      </form>

      {/* Existing items */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16 }}>
        Published Items ({items.filter((i) => i.is_active).length} active)
      </h2>

      {loading ? (
        <div style={{ color: TEXT_MUTED, padding: 20 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div
          style={{
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: TEXT_MUTED,
          }}
        >
          No feed items yet. Upload your first one above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                overflow: "hidden",
                opacity: item.is_active ? 1 : 0.4,
              }}
            >
              {/* Image preview */}
              <div style={{ position: "relative" }}>
                <img
                  src={item.image_url}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: 140,
                    objectFit: "cover",
                  }}
                />
                {/* Category pill + pinned badge */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      background: catColor(item.category),
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.category.replace("_", " ")}
                  </span>
                  {item.is_pinned && (
                    <span
                      style={{
                        background: "#fff",
                        color: "#000",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      PINNED
                    </span>
                  )}
                </div>
                {!item.is_active && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: ERROR,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    INACTIVE
                  </div>
                )}
              </div>

              {/* Content + actions */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>
                  {item.title}
                </div>
                {item.body && (
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.body}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                  }}
                >
                  <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                    {new Date(item.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Kampala",
                    })}
                    {item.gameweek_id ? ` · GW ${item.gameweek_id}` : ""}
                  </span>
                  {item.is_active && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${ERROR}`,
                        color: ERROR,
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 6,
                        padding: "4px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
