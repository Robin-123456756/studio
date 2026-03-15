"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import dynamic from "next/dynamic";
import type { LayoutType } from "@/components/admin/LayoutPicker";
import type { GalleryImage } from "@/components/admin/GalleryUploader";

// Dynamic imports to keep initial bundle small
const ImageEditor = dynamic(() => import("@/components/admin/ImageEditor"), { ssr: false });
const VideoEditor = dynamic(() => import("@/components/admin/VideoEditor"), { ssr: false });
const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), { ssr: false });
const LayoutPicker = dynamic(() => import("@/components/admin/LayoutPicker"), { ssr: false });
const GalleryUploader = dynamic(() => import("@/components/admin/GalleryUploader"), { ssr: false });
const FeedPreview = dynamic(() => import("@/components/admin/FeedPreview"), { ssr: false });

/* ── Style tokens ──────────────────────────────────────────────────────── */

const BG_CARD = "#111827";
const BG_SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT_PRIMARY = "#F1F5F9";
const TEXT_SECONDARY = "#CBD5E1";
const TEXT_MUTED = "#64748B";
const ERROR = "#EF4444";
const WARNING = "#F59E0B";

const CATEGORIES = [
  { value: "announcement", label: "Announcement", color: "#F59E0B" },
  { value: "matchday", label: "Match Day", color: "#3B82F6" },
  { value: "player_spotlight", label: "Player Spotlight", color: "#10B981" },
  { value: "deadline", label: "Deadline", color: "#EF4444" },
  { value: "general", label: "General", color: "#8B5CF6" },
  { value: "breaking", label: "Breaking News", color: "#DC2626" },
  { value: "transfer_news", label: "Transfer News", color: "#7C3AED" },
  { value: "match_report", label: "Match Report", color: "#0EA5E9" },
] as const;

type FeedItem = {
  id: number;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  category: string;
  layout: string;
  is_pinned: boolean;
  is_active: boolean;
  status: string;
  publish_at: string | null;
  media_urls: string[] | null;
  gameweek_id: number | null;
  created_at: string;
  view_count: number;
};

type StatusFilter = "all" | "published" | "draft" | "scheduled";

/* ── Tab switcher for editing mode ─────────────────────────────────────── */

type EditorTab = "compose" | "media" | "preview";

export default function FeedMediaPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Editor tab
  const [editorTab, setEditorTab] = useState<EditorTab>("compose");

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null); // null = new item
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState("general");
  const [layout, setLayout] = useState<LayoutType>("hero");
  const [isPinned, setIsPinned] = useState(false);
  const [gameweekId, setGameweekId] = useState("");
  const [itemStatus, setItemStatus] = useState<"draft" | "published" | "scheduled">("published");
  const [publishAt, setPublishAt] = useState("");

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editedImageBlob, setEditedImageBlob] = useState<Blob | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [editedVideoBlob, setEditedVideoBlob] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [showVideoEditor, setShowVideoEditor] = useState(false);

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  /* ── Data loading ────────────────────────────────────────────────────── */

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

  /* ── File handlers ───────────────────────────────────────────────────── */

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be under 3MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setEditedImageBlob(null);
    setShowImageEditor(true);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be under 50MB.");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setEditedVideoBlob(null);
    setShowVideoEditor(true);
  };

  /* ── Submit ──────────────────────────────────────────────────────────── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (itemStatus === "scheduled" && !publishAt) {
      setError("Scheduled items require a publish date & time.");
      return;
    }

    // Validate media based on layout
    const needsMedia = layout !== "quick";
    const hasImage = editedImageBlob || imageFile;
    const hasVideo = editedVideoBlob || videoFile;
    const hasGallery = galleryImages.length > 0;

    if (needsMedia && !hasImage && !hasVideo && !hasGallery && !editingId) {
      setError("This layout requires at least one image or video.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      if (bodyHtml.trim()) fd.append("body", bodyHtml.trim());
      fd.append("category", category);
      fd.append("layout", layout);
      fd.append("is_pinned", String(isPinned));
      fd.append("status", itemStatus);
      if (publishAt) fd.append("publish_at", publishAt);
      if (gameweekId) fd.append("gameweek_id", gameweekId);

      // Image
      if (editedImageBlob) {
        fd.append("file", editedImageBlob, imageFile?.name || "edited.jpg");
      } else if (imageFile) {
        fd.append("file", imageFile);
      }

      // Video
      if (editedVideoBlob || videoFile) {
        fd.append("video", editedVideoBlob || videoFile!);
      }
      if (thumbnailBlob) {
        fd.append("thumbnail", thumbnailBlob, "thumbnail.jpg");
      }

      // Gallery images
      galleryImages.forEach((gi, i) => {
        fd.append(`gallery_${i}`, gi.file);
        fd.append(`gallery_caption_${i}`, gi.caption);
      });
      fd.append("gallery_count", String(galleryImages.length));

      if (editingId) {
        fd.append("id", String(editingId));
      }

      const url = editingId
        ? "/api/admin/feed-media"
        : "/api/admin/feed-media";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: fd,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Upload failed.");
        return;
      }

      setSuccess(editingId ? "Feed item updated!" : "Feed item created!");
      resetForm();
      loadItems();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  };

  /* ── Edit existing item ──────────────────────────────────────────────── */

  function loadItemForEdit(item: FeedItem) {
    // Clear stale file state from any previous edit session
    setImageFile(null);
    setEditedImageBlob(null);
    setShowImageEditor(false);
    setVideoFile(null);
    setEditedVideoBlob(null);
    setThumbnailBlob(null);
    setShowVideoEditor(false);
    setGalleryImages([]);
    if (imageRef.current) imageRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";

    setEditingId(item.id);
    setTitle(item.title);
    setBodyHtml(item.body || "");
    setCategory(item.category);
    setLayout((item.layout || "hero") as LayoutType);
    setIsPinned(item.is_pinned);
    setGameweekId(item.gameweek_id ? String(item.gameweek_id) : "");
    setItemStatus((item.status || "published") as any);
    setPublishAt(item.publish_at || "");
    setImagePreview(item.image_url);
    setVideoPreview(item.video_url);
    setEditorTab("compose");
    setError("");
    setSuccess("");
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Delete / Reactivate ─────────────────────────────────────────────── */

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this feed item?")) return;
    try {
      const res = await fetch(`/api/admin/feed-media?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) loadItems();
    } catch {
      // non-fatal
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      const fd = new FormData();
      fd.append("id", String(id));
      fd.append("reactivate", "true");
      const res = await fetch("/api/admin/feed-media", {
        method: "PUT",
        body: fd,
        credentials: "same-origin",
      });
      if (res.ok) loadItems();
    } catch {
      // non-fatal
    }
  };

  /* ── Form reset ──────────────────────────────────────────────────────── */

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBodyHtml("");
    setCategory("general");
    setLayout("hero");
    setIsPinned(false);
    setGameweekId("");
    setItemStatus("published");
    setPublishAt("");
    setImageFile(null);
    setImagePreview(null);
    setEditedImageBlob(null);
    setShowImageEditor(false);
    setVideoFile(null);
    setVideoPreview(null);
    setEditedVideoBlob(null);
    setThumbnailBlob(null);
    setShowVideoEditor(false);
    setGalleryImages([]);
    setEditorTab("compose");
    if (imageRef.current) imageRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  const catColor = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.color ?? TEXT_MUTED;

  const filteredItems = items.filter((item) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "published") return item.status === "published" && item.is_active;
    if (statusFilter === "draft") return item.status === "draft";
    if (statusFilter === "scheduled") return item.status === "scheduled";
    return true;
  });

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    background: active ? ACCENT + "15" : "transparent",
    color: active ? ACCENT : TEXT_SECONDARY,
    cursor: "pointer",
  });

  const editorTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    fontSize: 13,
    fontWeight: 700,
    borderRadius: "8px 8px 0 0",
    border: "none",
    borderBottom: active ? `2px solid ${ACCENT}` : `2px solid transparent`,
    background: active ? BG_CARD : "transparent",
    color: active ? ACCENT : TEXT_MUTED,
    cursor: "pointer",
  });

  /* ── Auth guard ──────────────────────────────────────────────────────── */

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
    <div style={{ minHeight: "100vh", backgroundColor: "#0F172A", color: TEXT_PRIMARY }}>
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/admin" style={{ color: ACCENT, fontSize: 13, textDecoration: "none" }}>
            &larr; Back to Admin
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY, marginTop: 8 }}>
            Feed Media Manager
          </h1>
          <p style={{ color: TEXT_SECONDARY, fontSize: 14, marginTop: 4 }}>
            Create, edit, and schedule rich content for the dashboard feed.
          </p>
        </div>

        {/* ── EDITOR SECTION ─────────────────────────────────────────── */}
        <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 32, overflow: "hidden" }}>
          {/* Editor tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: "#0F172A" }}>
            {(["compose", "media", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setEditorTab(t)} style={editorTabStyle(editorTab === t)}>
                {t === "compose" ? "Compose" : t === "media" ? "Media" : "Preview"}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {editingId && (
              <button
                onClick={resetForm}
                style={{ padding: "8px 16px", fontSize: 12, color: WARNING, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 16 }}>
              {editingId ? `Editing Item #${editingId}` : "New Feed Item"}
            </h2>

            {/* ── COMPOSE TAB ─────────────────────────────────────────── */}
            {editorTab === "compose" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Left column — content */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Layout picker */}
                  <LayoutPicker selected={layout} onChange={setLayout} />

                  {/* Title */}
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      Headline *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. GW6 Preview: Top picks this weekend"
                      maxLength={200}
                      style={{
                        width: "100%", fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY,
                        background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    />
                    <div style={{ textAlign: "right", fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
                      {title.length}/200
                    </div>
                  </div>

                  {/* Rich text body */}
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      Story Body
                    </label>
                    <RichTextEditor
                      value={bodyHtml}
                      onChange={setBodyHtml}
                      maxLength={5000}
                      placeholder="Write your story... Use the toolbar for formatting."
                    />
                  </div>
                </div>

                {/* Right column — metadata */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Category */}
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      Category
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setCategory(c.value)}
                          style={{
                            padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: `1px solid ${category === c.value ? c.color : BORDER}`,
                            background: category === c.value ? c.color + "20" : "transparent",
                            color: category === c.value ? c.color : TEXT_SECONDARY,
                            cursor: "pointer",
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      Publish Status
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["draft", "published", "scheduled"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setItemStatus(s)}
                          style={btnStyle(itemStatus === s)}
                        >
                          {s === "draft" ? "Save as Draft" : s === "published" ? "Publish Now" : "Schedule"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule datetime */}
                  {itemStatus === "scheduled" && (
                    <div>
                      <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                        Publish Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={publishAt}
                        onChange={(e) => setPublishAt(e.target.value)}
                        style={{
                          width: "100%", fontSize: 14, color: TEXT_PRIMARY, background: BG_SURFACE,
                          border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px",
                        }}
                      />
                    </div>
                  )}

                  {/* Gameweek */}
                  <div>
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
                        width: "100%", fontSize: 14, color: TEXT_PRIMARY, background: BG_SURFACE,
                        border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px",
                      }}
                    />
                  </div>

                  {/* Pin toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: TEXT_PRIMARY, cursor: "pointer" }}>
                    <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} style={{ width: 16, height: 16 }} />
                    Pin to top of feed (hero card)
                  </label>
                </div>
              </div>
            )}

            {/* ── MEDIA TAB ───────────────────────────────────────────── */}
            {editorTab === "media" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Image upload section */}
                {layout !== "video" && (
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      {layout === "gallery" ? "Primary Image (optional for gallery)" : "Image *"}
                    </label>
                    <input
                      ref={imageRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageSelect}
                      style={{
                        display: "block", fontSize: 13, color: TEXT_PRIMARY, background: BG_SURFACE,
                        border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", width: "100%",
                      }}
                    />
                    {/* Image editor */}
                    {showImageEditor && imageFile && (
                      <div style={{ marginTop: 12 }}>
                        <ImageEditor
                          file={imageFile}
                          onDone={(blob, url) => {
                            setEditedImageBlob(blob);
                            setImagePreview(url);
                            setShowImageEditor(false);
                          }}
                          onCancel={() => setShowImageEditor(false)}
                        />
                      </div>
                    )}
                    {/* Edited preview */}
                    {imagePreview && !showImageEditor && (
                      <div style={{ marginTop: 10, position: "relative" }}>
                        <img src={imagePreview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, border: `1px solid ${BORDER}` }} />
                        <button
                          type="button"
                          onClick={() => setShowImageEditor(true)}
                          style={{
                            position: "absolute", bottom: 8, right: 8, padding: "4px 12px",
                            fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none",
                            background: ACCENT, color: "#000", cursor: "pointer",
                          }}
                        >
                          Re-edit
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Video upload section */}
                {(layout === "video" || layout === "hero") && (
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 }}>
                      Video {layout === "video" ? "*" : "(optional)"}
                    </label>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 6 }}>
                      MP4 or WebM, max 50MB, max 2 minutes recommended
                    </div>
                    <input
                      ref={videoRef}
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={handleVideoSelect}
                      style={{
                        display: "block", fontSize: 13, color: TEXT_PRIMARY, background: BG_SURFACE,
                        border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", width: "100%",
                      }}
                    />
                    {/* Video editor */}
                    {showVideoEditor && videoFile && (
                      <div style={{ marginTop: 12 }}>
                        <VideoEditor
                          file={videoFile}
                          onDone={(video, thumb, url) => {
                            setEditedVideoBlob(video);
                            setThumbnailBlob(thumb);
                            setVideoPreview(url);
                            setShowVideoEditor(false);
                          }}
                          onCancel={() => setShowVideoEditor(false)}
                        />
                      </div>
                    )}
                    {videoPreview && !showVideoEditor && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: ACCENT, marginBottom: 4 }}>Video ready</div>
                        <button
                          type="button"
                          onClick={() => setShowVideoEditor(true)}
                          style={{
                            padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                            border: `1px solid ${BORDER}`, background: BG_SURFACE, color: TEXT_PRIMARY, cursor: "pointer",
                          }}
                        >
                          Re-edit video
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Gallery upload section */}
                {layout === "gallery" && (
                  <GalleryUploader
                    images={galleryImages}
                    onChange={setGalleryImages}
                    max={6}
                  />
                )}
              </div>
            )}

            {/* ── PREVIEW TAB ─────────────────────────────────────────── */}
            {editorTab === "preview" && (
              <div>
                <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 12, textAlign: "center" }}>
                  This is how your content will appear on the dashboard
                </div>
                <FeedPreview
                  layout={layout}
                  title={title}
                  bodyHtml={bodyHtml}
                  category={category}
                  imagePreview={imagePreview}
                  videoPreview={videoPreview}
                  galleryPreviews={galleryImages.map((g) => g.preview)}
                />
              </div>
            )}

            {/* ── Messages + Submit ───────────────────────────────────── */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {error && (
                <div style={{ color: ERROR, fontSize: 13, fontWeight: 500 }}>{error}</div>
              )}
              {success && (
                <div style={{ color: ACCENT, fontSize: 13, fontWeight: 500 }}>{success}</div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    background: ACCENT, color: "#000", fontWeight: 700, fontSize: 14,
                    border: "none", borderRadius: 8, padding: "10px 28px",
                    cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading
                    ? "Publishing..."
                    : editingId
                    ? "Update Item"
                    : itemStatus === "draft"
                    ? "Save Draft"
                    : itemStatus === "scheduled"
                    ? "Schedule"
                    : "Publish to Feed"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_SECONDARY, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* ── ITEMS LIST ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>
            Content Library ({filteredItems.length})
          </h2>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "published", "draft", "scheduled"] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={btnStyle(statusFilter === f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: TEXT_MUTED, padding: 20 }}>Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: "center", color: TEXT_MUTED }}>
            {statusFilter === "all" ? "No feed items yet. Create your first one above." : `No ${statusFilter} items.`}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                  overflow: "hidden", opacity: item.is_active ? 1 : 0.5,
                  transition: "opacity 0.15s",
                }}
              >
                {/* Media preview */}
                <div style={{ position: "relative" }}>
                  {item.video_url ? (
                    <video
                      src={item.video_url}
                      muted
                      playsInline
                      style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                    />
                  ) : item.image_url ? (
                    <img src={item.image_url} alt={item.title} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: 80, background: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: TEXT_MUTED, fontSize: 11 }}>No media</span>
                    </div>
                  )}
                  {/* Badges */}
                  <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span style={{
                      background: catColor(item.category), color: "#fff", fontSize: 9, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      {item.category.replace("_", " ")}
                    </span>
                    {item.is_pinned && (
                      <span style={{ background: "#fff", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                        PINNED
                      </span>
                    )}
                    <span style={{
                      background: item.status === "draft" ? WARNING : item.status === "scheduled" ? "#3B82F6" : ACCENT,
                      color: item.status === "published" ? "#000" : "#fff",
                      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                    }}>
                      {item.status || "published"}
                    </span>
                    {item.layout && item.layout !== "hero" && (
                      <span style={{ background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                        {item.layout}
                      </span>
                    )}
                  </div>
                  {!item.is_active && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: ERROR, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                      INACTIVE
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3 }}>{item.title}</div>
                  {item.body && (
                    <div
                      style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 1.4, maxHeight: 36, overflow: "hidden" }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.body!) }}
                    />
                  )}

                  {/* Stats row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: TEXT_MUTED }}>
                        {new Date(item.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala",
                        })}
                      </span>
                      {item.gameweek_id && (
                        <span style={{ fontSize: 10, color: TEXT_MUTED }}>GW {item.gameweek_id}</span>
                      )}
                      {(item.view_count ?? 0) > 0 && (
                        <span style={{ fontSize: 10, color: ACCENT }}>
                          {item.view_count} views
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => loadItemForEdit(item)}
                      style={{
                        flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, borderRadius: 6,
                        border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    {item.is_active ? (
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, borderRadius: 6,
                          border: `1px solid ${ERROR}`, background: "transparent", color: ERROR, cursor: "pointer",
                        }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(item.id)}
                        style={{
                          flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, borderRadius: 6,
                          border: `1px solid ${ACCENT}`, background: ACCENT + "15", color: ACCENT, cursor: "pointer",
                        }}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
