"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import dynamic from "next/dynamic";
import type { LayoutType } from "@/components/admin/LayoutPicker";
import type { GalleryImage } from "@/components/admin/GalleryUploader";
import type { CardDesign } from "@/components/admin/CardDesigner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { scoreContent, type QualityBreakdown } from "@/lib/content-quality";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// lucide icons
import {
  ArrowLeft, Plus, Search, LayoutGrid, List, Upload, Image as ImageIcon,
  Video, Eye, EyeOff, Pin, PinOff, Calendar, Clock, Hash,
  Pencil, Trash2, RotateCcw, X, GripVertical, FileText,
  CloudUpload, Sparkles, Wand2, Brain, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Clipboard,
  Gauge, Lightbulb, Megaphone, Copy, Maximize2, Minimize2, Square,
  Paintbrush,
} from "lucide-react";

// Dynamic imports to keep initial bundle small
const ImageEditor = dynamic(() => import("@/components/admin/ImageEditor"), { ssr: false });
const VideoEditor = dynamic(() => import("@/components/admin/VideoEditor"), { ssr: false });
const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), { ssr: false });
const LayoutPicker = dynamic(() => import("@/components/admin/LayoutPicker"), { ssr: false });
const GalleryUploader = dynamic(() => import("@/components/admin/GalleryUploader"), { ssr: false });
const FeedPreview = dynamic(() => import("@/components/admin/FeedPreview"), { ssr: false });
const ContentCalendar = dynamic(() => import("@/components/admin/ContentCalendar"), { ssr: false });
const CardDesigner = dynamic(() => import("@/components/admin/CardDesigner"), { ssr: false });

/* ── Constants ────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { value: "announcement", label: "Announcement", color: "bg-amber-500" },
  { value: "matchday", label: "Match Day", color: "bg-blue-500" },
  { value: "player_spotlight", label: "Player Spotlight", color: "bg-emerald-500" },
  { value: "deadline", label: "Deadline", color: "bg-red-500" },
  { value: "general", label: "General", color: "bg-violet-500" },
  { value: "breaking", label: "Breaking News", color: "bg-red-600" },
  { value: "transfer_news", label: "Transfer News", color: "bg-purple-600" },
  { value: "match_report", label: "Match Report", color: "bg-sky-500" },
] as const;

const CAT_HEX: Record<string, string> = {
  announcement: "#F59E0B", matchday: "#3B82F6", player_spotlight: "#10B981",
  deadline: "#EF4444", general: "#8B5CF6", breaking: "#DC2626",
  transfer_news: "#7C3AED", match_report: "#0EA5E9",
};

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
  display_size: string;
};

type StatusFilter = "all" | "published" | "draft" | "scheduled";
type ViewMode = "grid" | "list" | "calendar";
type DisplaySize = "compact" | "standard" | "featured";

/* ── Component ────────────────────────────────────────────────────────── */

export default function FeedMediaPage() {
  const { data: session, status } = useSession();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Editor panel state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState("compose");

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState("general");
  const [layout, setLayout] = useState<LayoutType>("hero");
  const [isPinned, setIsPinned] = useState(false);
  const [gameweekId, setGameweekId] = useState("");
  const [itemStatus, setItemStatus] = useState<"draft" | "review" | "approved" | "published" | "scheduled">("published");
  const [sendPush, setSendPush] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [displaySize, setDisplaySize] = useState<DisplaySize>("standard");
  const [cardDesign, setCardDesign] = useState<CardDesign>({
    filters: { brightness: 100, contrast: 100, saturation: 100 },
    filterPreset: "original",
    overlayColor: "#000000",
    overlayOpacity: 60,
    textOverlays: [],
    badge: null,
    imagePosition: { x: 50, y: 50 },
  });

  // Series state
  type FeedSeries = { id: number; name: string; description: string | null };
  const [seriesList, setSeriesList] = useState<FeedSeries[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [seriesOrder, setSeriesOrder] = useState("");

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

  // Drag-and-drop
  const [isDragOver, setIsDragOver] = useState(false);

  // Phase 1: AI-Powered Content Studio
  const [aiHeadlines, setAiHeadlines] = useState<string[]>([]);
  const [aiHeadlinesLoading, setAiHeadlinesLoading] = useState(false);
  const [aiHeadlinesOpen, setAiHeadlinesOpen] = useState(false);
  const [headlineHint, setHeadlineHint] = useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [toneResult, setToneResult] = useState<{ tone: string; matches_category: boolean; suggestion: string } | null>(null);
  const [toneLoading, setToneLoading] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  // Template state
  type FeedTemplate = { id: number; name: string; title: string; body: string | null; category: string; layout: string };
  const [templates, setTemplates] = useState<FeedTemplate[]>([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const isDraggingImage = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 50, posY: 50 });

  /* ── Data loading ──────────────────────────────────────────────────── */

  const loadItems = useCallback(async () => {
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
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feed-templates", { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
      }
    } catch { /* non-fatal */ }
  }, []);

  const loadSeries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feed-series", { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        setSeriesList(json.series ?? []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadItems();
      loadTemplates();
      loadSeries();
    }
  }, [session, loadItems, loadTemplates, loadSeries]);

  /* ── File handlers ─────────────────────────────────────────────────── */

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Image must be under 3MB.", variant: "destructive" });
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
      toast({ title: "Video too large", description: "Video must be under 50MB.", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setEditedVideoBlob(null);
    setShowVideoEditor(true);
  };

  // Drag-and-drop on the entire editor media tab
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max 3MB.", variant: "destructive" });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setEditedImageBlob(null);
      setShowImageEditor(true);
      setEditorTab("media");
    } else if (file.type.startsWith("video/")) {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "Video too large", description: "Max 50MB.", variant: "destructive" });
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setEditedVideoBlob(null);
      setShowVideoEditor(true);
      setEditorTab("media");
    }
  }, [toast]);

  /* ── Phase 1: AI Helpers ────────────────────────────────────────────── */

  const generateHeadlines = useCallback(async () => {
    setAiHeadlinesLoading(true);
    setAiHeadlines([]);
    try {
      const res = await fetch("/api/admin/ai-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "headlines",
          hint: headlineHint || title || undefined,
          category,
          body: bodyHtml || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiHeadlines(data.headlines || []);
        setAiHeadlinesOpen(true);
      } else {
        toast({ title: "AI Error", description: "Could not generate headlines.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network Error", description: "Failed to reach AI service.", variant: "destructive" });
    } finally {
      setAiHeadlinesLoading(false);
    }
  }, [headlineHint, title, category, bodyHtml, toast]);

  const autoSummarize = useCallback(async () => {
    if (!bodyHtml.trim() && !title.trim()) {
      toast({ title: "Nothing to summarize", description: "Write some content first.", variant: "destructive" });
      return;
    }
    setAiSummaryLoading(true);
    try {
      const res = await fetch("/api/admin/ai-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "summarize", title, body: bodyHtml }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          if (bodyHtml.trim() && !window.confirm("This will replace your current body with an AI summary. Continue?")) {
            return;
          }
          setBodyHtml(`<p>${data.summary}</p>`);
          toast({ title: "Summarized", description: "Body replaced with AI summary." });
        }
      } else {
        toast({ title: "Summarize failed", description: "AI could not generate a summary.", variant: "destructive" });
      }
    } catch {
      toast({ title: "AI Error", description: "Summarize failed. Check your connection.", variant: "destructive" });
    } finally {
      setAiSummaryLoading(false);
    }
  }, [bodyHtml, title, toast]);

  const analyzeTone = useCallback(async () => {
    if (!title.trim()) return;
    setToneLoading(true);
    try {
      const res = await fetch("/api/admin/ai-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "tone", title, body: bodyHtml, category }),
      });
      if (res.ok) {
        const data = await res.json();
        setToneResult(data);
      } else {
        setToneResult(null);
      }
    } catch {
      setToneResult(null);
    } finally {
      setToneLoading(false);
    }
  }, [title, bodyHtml, category]);

  // Auto-analyze tone when title changes (debounced)
  useEffect(() => {
    if (!title.trim() || !editorOpen) return;
    const timer = setTimeout(() => analyzeTone(), 2000);
    return () => clearTimeout(timer);
  }, [title, category, analyzeTone, editorOpen]);

  // Content Quality Score (client-side, recomputes on every change)
  const qualityScore: QualityBreakdown = useMemo(() => {
    return scoreContent({
      title,
      bodyHtml,
      category,
      layout,
      hasImage: !!(editedImageBlob || imageFile || imagePreview),
      hasVideo: !!(editedVideoBlob || videoFile || videoPreview),
      hasGallery: galleryImages.length > 0,
      isPinned,
      status: itemStatus,
    });
  }, [title, bodyHtml, category, layout, editedImageBlob, imageFile, imagePreview, editedVideoBlob, videoFile, videoPreview, galleryImages, isPinned, itemStatus]);

  // Clipboard paste handler for images
  useEffect(() => {
    if (!editorOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          if (file.size > 3 * 1024 * 1024) {
            toast({ title: "Image too large", description: "Pasted image exceeds 3MB.", variant: "destructive" });
            return;
          }
          setImageFile(file);
          setImagePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
          });
          setEditedImageBlob(null);
          setShowImageEditor(true);
          setEditorTab("media");
          toast({ title: "Image pasted", description: "Image captured from clipboard." });
          return;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [editorOpen, toast]);

  /* ── Submit ────────────────────────────────────────────────────────── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a headline.", variant: "destructive" });
      return;
    }
    if (itemStatus === "scheduled" && !publishAt) {
      toast({ title: "Schedule required", description: "Scheduled items need a publish date.", variant: "destructive" });
      return;
    }

    const needsMedia = layout !== "quick";
    const hasImage = editedImageBlob || imageFile;
    const hasVideo = editedVideoBlob || videoFile;
    const hasGallery = galleryImages.length > 0;

    if (needsMedia && !hasImage && !hasVideo && !hasGallery && !editingId) {
      toast({ title: "Media required", description: "This layout requires at least one image or video.", variant: "destructive" });
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
      if (sendPush && itemStatus === "published") fd.append("send_push", "true");
      if (seriesId) fd.append("series_id", seriesId);
      if (seriesOrder) fd.append("series_order", seriesOrder);
      fd.append("display_size", displaySize);
      fd.append("card_design", JSON.stringify(cardDesign));

      if (editedImageBlob) {
        fd.append("file", editedImageBlob, imageFile?.name || "edited.jpg");
      } else if (imageFile) {
        fd.append("file", imageFile);
      }

      if (editedVideoBlob || videoFile) {
        fd.append("video", editedVideoBlob || videoFile!);
      }
      if (thumbnailBlob) {
        fd.append("thumbnail", thumbnailBlob, "thumbnail.jpg");
      }

      galleryImages.forEach((gi, i) => {
        fd.append(`gallery_${i}`, gi.file);
        fd.append(`gallery_caption_${i}`, gi.caption);
      });
      fd.append("gallery_count", String(galleryImages.length));

      if (editingId) {
        fd.append("id", String(editingId));
      }

      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/admin/feed-media", {
        method,
        body: fd,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const json = await res.json();
        toast({ title: "Error", description: json.error || "Upload failed.", variant: "destructive" });
        return;
      }

      toast({
        title: editingId ? "Updated" : "Published",
        description: editingId ? "Feed item updated successfully." : "Feed item created successfully.",
      });
      resetForm();
      loadItems();
    } catch {
      toast({ title: "Network error", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  /* ── Edit existing item ────────────────────────────────────────────── */

  function loadItemForEdit(item: FeedItem) {
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
    setItemStatus((item.status || "published") as "draft" | "published" | "scheduled");
    setPublishAt(item.publish_at || "");
    setImagePreview(item.image_url);
    setVideoPreview(item.video_url);
    setDisplaySize((item.display_size || "standard") as DisplaySize);
    setEditorTab("compose");
    setEditorOpen(true);
  }

  /* ── Delete / Reactivate ───────────────────────────────────────────── */

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this feed item?")) return;
    try {
      const res = await fetch(`/api/admin/feed-media?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast({ title: "Deactivated", description: "Feed item has been deactivated." });
        loadItems();
      }
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
      if (res.ok) {
        toast({ title: "Reactivated", description: "Feed item is live again." });
        loadItems();
      }
    } catch {
      // non-fatal
    }
  };

  /* ── Form reset ────────────────────────────────────────────────────── */

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBodyHtml("");
    setCategory("general");
    setLayout("hero");
    setIsPinned(false);
    setGameweekId("");
    setItemStatus("published");
    setSendPush(false);
    setPublishAt("");
    setSeriesId("");
    setSeriesOrder("");
    setDisplaySize("standard");
    setCardDesign({
      filters: { brightness: 100, contrast: 100, saturation: 100 },
      filterPreset: "original",
      overlayColor: "#000000",
      overlayOpacity: 60,
      textOverlays: [],
      badge: null,
      imagePosition: { x: 50, y: 50 },
    });
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
    // Reset AI state
    setAiHeadlines([]);
    setAiHeadlinesOpen(false);
    setHeadlineHint("");
    setToneResult(null);
    setQualityOpen(false);
    setEditorOpen(false);
  }

  /* ── Duplicate ────────────────────────────────────────────────────── */

  function handleDuplicate(item: FeedItem) {
    resetForm();
    setTitle(`Copy of ${item.title}`.substring(0, 200));
    setBodyHtml(item.body || "");
    setCategory(item.category);
    setLayout((item.layout || "hero") as LayoutType);
    setIsPinned(false);
    setGameweekId(item.gameweek_id ? String(item.gameweek_id) : "");
    setItemStatus("draft");
    setEditorTab("compose");
    setEditorOpen(true);
  }

  /* ── Templates ────────────────────────────────────────────────────── */

  async function handleSaveTemplate(name?: string) {
    const tmplName = name?.trim() || templateName.trim();
    if (!tmplName) {
      toast({ title: "Name required", description: "Enter a template name.", variant: "destructive" });
      return;
    }
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/admin/feed-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: tmplName, title, body: bodyHtml, category, layout }),
      });
      if (res.ok) {
        toast({ title: "Template saved", description: `"${tmplName}" saved.` });
        setTemplateName("");
        loadTemplates();
      } else {
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  }

  function loadTemplate(tmpl: FeedTemplate) {
    setTitle(tmpl.title);
    setBodyHtml(tmpl.body || "");
    setCategory(tmpl.category);
    setLayout((tmpl.layout || "hero") as LayoutType);
    setTemplateMenuOpen(false);
    toast({ title: "Template loaded", description: `"${tmpl.name}" applied.` });
  }

  async function handleDeleteTemplate(id: number) {
    const res = await fetch(`/api/admin/feed-templates?id=${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) loadTemplates();
  }

  /* ── Unsaved Changes Guard ────────────────────────────────────────── */

  const hasUnsavedChanges = editorOpen && (
    title.trim() !== "" || bodyHtml.trim() !== "" || imageFile !== null || videoFile !== null
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  function safeCloseEditor() {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Discard?")) return;
    resetForm();
  }

  /* ── Conflict Detection ──────────────────────────────────────────── */

  const scheduledByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (item.status === "scheduled" && item.publish_at) {
        const day = item.publish_at.split("T")[0];
        map[day] = (map[day] ?? 0) + 1;
      }
    }
    return map;
  }, [items]);

  const scheduledConflict = useMemo(() => {
    if (itemStatus !== "scheduled" || !publishAt) return false;
    const day = publishAt.split("T")[0];
    const count = scheduledByDay[day] ?? 0;
    // Subtract 1 if editing an existing scheduled item on the same day
    const existing = editingId && items.find((i) => i.id === editingId)?.publish_at?.startsWith(day) ? 1 : 0;
    return (count - existing) >= 2;
  }, [itemStatus, publishAt, scheduledByDay, editingId, items]);

  /* ── Keyboard Shortcuts ──────────────────────────────────────────── */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorOpen || uploading) return;

      // Ctrl+Enter → submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const form = document.querySelector<HTMLFormElement>("form");
        if (form) form.requestSubmit();
        return;
      }

      // Ctrl+S → save as draft
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setItemStatus("draft");
        setTimeout(() => {
          const form = document.querySelector<HTMLFormElement>("form");
          if (form) form.requestSubmit();
        }, 0);
        return;
      }

      // Escape → close editor (unless uploading)
      if (e.key === "Escape") {
        e.preventDefault();
        safeCloseEditor();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen, uploading]);

  /* ── Filtering ─────────────────────────────────────────────────────── */

  const filteredItems = items.filter((item) => {
    // Status filter
    if (statusFilter === "published" && !(item.status === "published" && item.is_active)) return false;
    if (statusFilter === "draft" && item.status !== "draft") return false;
    if (statusFilter === "scheduled" && item.status !== "scheduled") return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.body && item.body.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: items.length,
    published: items.filter((i) => i.status === "published" && i.is_active).length,
    drafts: items.filter((i) => i.status === "draft").length,
    scheduled: items.filter((i) => i.status === "scheduled").length,
  };

  /* ── Auth guard ────────────────────────────────────────────────────── */

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const userRole = (session?.user as any)?.role as string | undefined;
  const isSuperAdmin = !userRole || userRole === "superadmin";

  if (!session?.user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-destructive font-semibold text-lg mb-2">Access Denied</div>
            <p className="text-muted-foreground text-sm">
              {!session?.user ? "Please log in as admin." : "Superadmin access required."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className={cn("mx-auto max-w-6xl", isMobile ? "px-3 py-4" : "px-6 py-6")}>

          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="mb-6">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Feed Media Manager</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Create, edit, and schedule rich content for the dashboard feed.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/feed-media/analytics">
                  <Button variant="outline" className="gap-2">
                    <Gauge className="h-4 w-4" />
                    <span className="hidden sm:inline">Analytics</span>
                  </Button>
                </Link>
                <Button
                  onClick={() => { resetForm(); setEditorOpen(true); }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Post
                </Button>
              </div>
            </div>
          </div>

          {/* ── Stats Cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total", value: stats.total, icon: FileText, filter: "all" as StatusFilter },
              { label: "Published", value: stats.published, icon: Eye, filter: "published" as StatusFilter },
              { label: "Drafts", value: stats.drafts, icon: Clock, filter: "draft" as StatusFilter },
              { label: "Scheduled", value: stats.scheduled, icon: Calendar, filter: "scheduled" as StatusFilter },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => setStatusFilter(s.filter)}
                className={cn(
                  "rounded-xl border p-3 sm:p-4 text-left transition-all hover:shadow-md",
                  statusFilter === s.filter
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <s.icon className={cn("h-4 w-4", statusFilter === s.filter ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    statusFilter === s.filter ? "text-primary" : "text-foreground"
                  )}>
                    {s.value}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </button>
            ))}
          </div>

          {/* ── Toolbar: Search + View Toggle ─────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts by title, category, or content..."
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/30 self-start">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded-md p-2 transition-colors",
                      viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-md p-2 transition-colors",
                      viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={cn(
                      "rounded-md p-2 transition-colors",
                      viewMode === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Calendar view</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Content Library ────────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card animate-pulse">
                  <div className="h-36 bg-muted rounded-t-xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* ── Empty State ─────────────────────────────────────────── */
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-16 px-8 text-center transition-colors",
                isDragOver && "border-primary bg-primary/5"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); setEditorOpen(true); }}
            >
              <div className="rounded-full bg-muted p-4 mb-4">
                <CloudUpload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {searchQuery ? "No matching posts" : statusFilter !== "all" ? `No ${statusFilter} posts` : "No feed content yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                {searchQuery
                  ? "Try a different search term or clear the filter."
                  : "Create your first post to start engaging your league. Drag a file here or click below."}
              </p>
              {!searchQuery && (
                <Button onClick={() => { resetForm(); setEditorOpen(true); }} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create First Post
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ── Grid View ───────────────────────────────────────────── */
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
            )}>
              {filteredItems.map((item) => (
                <GridCard
                  key={item.id}
                  item={item}
                  onEdit={loadItemForEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onReactivate={handleReactivate}
                />
              ))}
            </div>
          ) : viewMode === "list" ? (
            /* ── List View ───────────────────────────────────────────── */
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <ListRow
                  key={item.id}
                  item={item}
                  onEdit={loadItemForEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onReactivate={handleReactivate}
                />
              ))}
            </div>
          ) : (
            /* ── Calendar View ────────────────────────────────────────── */
            <Card>
              <CardContent className="p-4">
                <ContentCalendar
                  items={filteredItems}
                  onDayClick={(date) => {
                    setSearchQuery(date);
                    setViewMode("grid");
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Editor Sheet (Side Panel) ───────────────────────────────── */}
        <Sheet open={editorOpen} onOpenChange={(open) => { if (!open) safeCloseEditor(); }}>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={cn(
              "overflow-y-auto",
              isMobile ? "h-[92vh] rounded-t-2xl" : "sm:max-w-xl w-full"
            )}
          >
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Editing #{editingId}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    New Feed Post
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {editingId ? "Update this feed item." : "Compose and publish content to the dashboard feed."}
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={handleSubmit}>
              <Tabs value={editorTab} onValueChange={setEditorTab}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="compose" className="flex-1 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Compose
                  </TabsTrigger>
                  <TabsTrigger value="media" className="flex-1 gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Media
                  </TabsTrigger>
                  <TabsTrigger value="design" className="flex-1 gap-1.5">
                    <Paintbrush className="h-3.5 w-3.5" />
                    Design
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                {/* ── COMPOSE TAB ──────────────────────────────────────── */}
                <TabsContent value="compose" className="space-y-5">
                  {/* Quality Score + Reading Time Bar */}
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <button
                      type="button"
                      onClick={() => setQualityOpen(!qualityOpen)}
                      className="flex items-center gap-2"
                    >
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-colors",
                        qualityScore.score >= 90 ? "bg-emerald-500/20 text-emerald-500" :
                        qualityScore.score >= 75 ? "bg-blue-500/20 text-blue-500" :
                        qualityScore.score >= 60 ? "bg-amber-500/20 text-amber-500" :
                        qualityScore.score >= 40 ? "bg-orange-500/20 text-orange-500" :
                        "bg-red-500/20 text-red-500"
                      )}>
                        {qualityScore.score}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold flex items-center gap-1">
                          Quality: {qualityScore.grade}
                          {qualityOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {qualityScore.checks.filter(c => c.passed).length}/{qualityScore.checks.length} checks passed
                        </div>
                      </div>
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      {qualityScore.readingTime}
                    </div>
                    {toneResult && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border",
                            toneResult.matches_category
                              ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                              : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                          )}>
                            {toneResult.matches_category
                              ? <CheckCircle2 className="h-3 w-3" />
                              : <AlertTriangle className="h-3 w-3" />}
                            {toneResult.tone}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          {toneResult.matches_category
                            ? "Tone matches your category"
                            : toneResult.suggestion || "Tone may not match your selected category"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {toneLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>

                  {/* Quality breakdown (expandable) */}
                  {qualityOpen && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5" />
                        Quality Breakdown
                      </h4>
                      {qualityScore.checks.map((check, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {check.passed
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                          <span className="flex-1">{check.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {check.points}/{check.maxPoints}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border mt-2">
                        <p className="text-xs text-muted-foreground">
                          <Lightbulb className="h-3 w-3 inline mr-1" />
                          {qualityScore.checks.find(c => !c.passed)?.tip || "All checks passed — great content!"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Layout picker */}
                  <LayoutPicker selected={layout} onChange={setLayout} />

                  {/* Title + AI Headline Generator */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-muted-foreground">
                        Headline *
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={generateHeadlines}
                        disabled={aiHeadlinesLoading}
                        className="gap-1.5 h-7 text-xs text-primary hover:text-primary"
                      >
                        {aiHeadlinesLoading
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Wand2 className="h-3 w-3" />}
                        AI Suggest
                      </Button>
                    </div>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. GW6 Preview: Top picks this weekend"
                      maxLength={200}
                      className="text-base font-semibold"
                    />
                    <div className="text-right text-xs text-muted-foreground mt-1">
                      {title.length}/200
                    </div>

                    {/* AI Headline Suggestions */}
                    {aiHeadlinesOpen && aiHeadlines.length > 0 && (
                      <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-primary flex items-center gap-1">
                            <Wand2 className="h-3 w-3" />
                            AI Suggestions
                          </span>
                          <button
                            type="button"
                            onClick={() => setAiHeadlinesOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {aiHeadlines.map((h, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setTitle(h); setAiHeadlinesOpen(false); }}
                            className="w-full text-left text-sm px-3 py-2 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/10 transition-colors leading-snug"
                          >
                            {h}
                          </button>
                        ))}
                        {/* Custom hint for regeneration */}
                        <div className="flex gap-2 mt-2 pt-2 border-t border-primary/10">
                          <Input
                            value={headlineHint}
                            onChange={(e) => setHeadlineHint(e.target.value)}
                            placeholder="Give a hint for better results..."
                            className="text-xs h-8"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={generateHeadlines}
                            disabled={aiHeadlinesLoading}
                            className="h-8 text-xs shrink-0"
                          >
                            {aiHeadlinesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerate"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rich text body + Auto-summarize */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-muted-foreground">
                        Story Body
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={autoSummarize}
                        disabled={aiSummaryLoading || (!bodyHtml.trim() && !title.trim())}
                        className="gap-1.5 h-7 text-xs text-primary hover:text-primary"
                      >
                        {aiSummaryLoading
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Brain className="h-3 w-3" />}
                        Auto-summarize
                      </Button>
                    </div>
                    <RichTextEditor
                      value={bodyHtml}
                      onChange={setBodyHtml}
                      maxLength={5000}
                      placeholder="Write your story... Use the toolbar for formatting."
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setCategory(c.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                            category === c.value
                              ? "border-transparent text-white shadow-sm"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          )}
                          style={category === c.value ? { backgroundColor: CAT_HEX[c.value] } : undefined}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Publish Status
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: "draft" as const, label: "Draft", icon: Clock },
                        { value: "review" as const, label: "Review", icon: BookOpen },
                        { value: "published" as const, label: "Publish", icon: Eye },
                        { value: "scheduled" as const, label: "Schedule", icon: Calendar },
                      ]).map((s) => (
                        <Button
                          key={s.value}
                          type="button"
                          size="sm"
                          variant={itemStatus === s.value ? "default" : "outline"}
                          onClick={() => setItemStatus(s.value)}
                          className="gap-1.5 flex-1"
                        >
                          <s.icon className="h-3.5 w-3.5" />
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule datetime */}
                  {itemStatus === "scheduled" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Publish Date & Time
                      </label>
                      <Input
                        type="datetime-local"
                        value={publishAt}
                        onChange={(e) => setPublishAt(e.target.value)}
                      />
                      {scheduledConflict && (
                        <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          3+ posts scheduled for this day. Consider spreading content.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Gameweek + Pin row */}
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Gameweek
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={gameweekId}
                          onChange={(e) => setGameweekId(e.target.value)}
                          placeholder="e.g. 6"
                          min={1}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch
                        checked={isPinned}
                        onCheckedChange={setIsPinned}
                        id="pin-toggle"
                      />
                      <label htmlFor="pin-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                        <Pin className="h-3.5 w-3.5" />
                        Pin
                      </label>
                    </div>
                  </div>

                  {/* Display size picker — visual card previews */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Card Size on Dashboard
                    </label>
                    <div className="space-y-2">
                      {/* ── Featured: full-width hero card with image + overlay ── */}
                      <button
                        type="button"
                        onClick={() => setDisplaySize("featured")}
                        className={cn(
                          "w-full rounded-xl border-2 overflow-hidden transition-all text-left",
                          displaySize === "featured"
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <div
                          className="relative select-none touch-none"
                          style={{ minHeight: 200 }}
                          onPointerDown={(e) => {
                            if (!imagePreview) return;
                            isDraggingImage.current = true;
                            dragStart.current = { x: e.clientX, y: e.clientY, posX: cardDesign.imagePosition.x, posY: cardDesign.imagePosition.y };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            if (!isDraggingImage.current) return;
                            const dx = e.clientX - dragStart.current.x;
                            const dy = e.clientY - dragStart.current.y;
                            setCardDesign((prev) => ({
                              ...prev,
                              imagePosition: {
                                x: Math.max(0, Math.min(100, dragStart.current.posX - dx * 0.5)),
                                y: Math.max(0, Math.min(100, dragStart.current.posY - dy * 0.5)),
                              },
                            }));
                          }}
                          onPointerUp={() => { isDraggingImage.current = false; }}
                        >
                          {imagePreview ? (
                            <img
                              src={imagePreview}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                              style={{ objectPosition: `${cardDesign.imagePosition.x}% ${cardDesign.imagePosition.y}%` }}
                              draggable={false}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-purple-800" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                            <div className="text-sm font-bold leading-tight line-clamp-2 mb-1">
                              {title || "Your headline here..."}
                            </div>
                            <span
                              className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: CAT_HEX[category] ?? "#8B5CF6" }}
                            >
                              {category.replace("_", " ")}
                            </span>
                          </div>
                          {imagePreview && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-medium pointer-events-none">
                              <GripVertical className="h-3 w-3" />
                              Drag to reposition
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 text-[10px] font-semibold flex items-center gap-1.5",
                          displaySize === "featured" ? "text-primary bg-primary/5" : "text-muted-foreground bg-muted/30"
                        )}>
                          <Maximize2 className="h-3 w-3" />
                          Featured — full-width hero card
                        </div>
                      </button>

                      {/* ── Standard: image top + text below ── */}
                      <button
                        type="button"
                        onClick={() => setDisplaySize("standard")}
                        className={cn(
                          "w-full rounded-xl border-2 overflow-hidden transition-all text-left",
                          displaySize === "standard"
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold leading-tight line-clamp-2">
                              {title || "Your headline here..."}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                              Tap to read the full story...
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span
                                className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: CAT_HEX[category] ?? "#8B5CF6" }}
                              >
                                {category.replace("_", " ")}
                              </span>
                              <span className="text-[9px] text-muted-foreground">2h ago</span>
                            </div>
                          </div>
                          <div className="h-16 w-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            {imagePreview ? (
                              <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 text-[10px] font-semibold flex items-center gap-1.5 border-t",
                          displaySize === "standard" ? "text-primary bg-primary/5 border-primary/10" : "text-muted-foreground bg-muted/30 border-border"
                        )}>
                          <Square className="h-3 w-3" />
                          Standard — default card size
                        </div>
                      </button>

                      {/* ── Compact: text-only with tiny thumbnail ── */}
                      <button
                        type="button"
                        onClick={() => setDisplaySize("compact")}
                        className={cn(
                          "w-full rounded-xl border-2 overflow-hidden transition-all text-left",
                          displaySize === "compact"
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold leading-tight line-clamp-2">
                              {title || "Your headline here..."}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: CAT_HEX[category] ?? "#8B5CF6" }}
                              >
                                {category.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                          <div className="h-10 w-10 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                            {imagePreview ? (
                              <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center">
                                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 text-[10px] font-semibold flex items-center gap-1.5 border-t",
                          displaySize === "compact" ? "text-primary bg-primary/5 border-primary/10" : "text-muted-foreground bg-muted/30 border-border"
                        )}>
                          <Minimize2 className="h-3 w-3" />
                          Compact — small card, headline only
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Series picker */}
                  {seriesList.length > 0 && (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                          Series (optional)
                        </label>
                        <select
                          value={seriesId}
                          onChange={(e) => setSeriesId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">None</option>
                          {seriesList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      {seriesId && (
                        <div className="w-20">
                          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Order</label>
                          <Input
                            type="number"
                            value={seriesOrder}
                            onChange={(e) => setSeriesOrder(e.target.value)}
                            min={0}
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Templates */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 flex-1"
                      onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Templates
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 flex-1"
                      disabled={!title.trim() || savingTemplate}
                      onClick={() => {
                        const name = window.prompt("Template name:");
                        if (name?.trim()) handleSaveTemplate(name);
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Save as Template
                    </Button>
                  </div>
                  {templateMenuOpen && templates.length > 0 && (
                    <div className="rounded-lg border bg-card p-2 space-y-1 max-h-40 overflow-y-auto">
                      {templates.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer group">
                          <button
                            type="button"
                            className="text-sm text-left flex-1 truncate"
                            onClick={() => loadTemplate(t)}
                          >
                            {t.name}
                          </button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                            onClick={() => handleDeleteTemplate(t.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {templateMenuOpen && templates.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No saved templates yet</p>
                  )}

                  {/* Push notification toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Push notification</p>
                        <p className="text-xs text-muted-foreground">Notify all subscribers when published</p>
                      </div>
                    </div>
                    <Switch
                      checked={sendPush}
                      onCheckedChange={setSendPush}
                      disabled={itemStatus !== "published"}
                      id="push-toggle"
                    />
                  </div>
                </TabsContent>

                {/* ── MEDIA TAB ────────────────────────────────────────── */}
                <TabsContent value="media" className="space-y-5">
                  {/* Drag-and-drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
                      isDragOver
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    )}
                    onClick={() => {
                      if (layout === "video") videoRef.current?.click();
                      else imageRef.current?.click();
                    }}
                  >
                    <Upload className={cn(
                      "h-8 w-8 mx-auto mb-3 transition-colors",
                      isDragOver ? "text-primary" : "text-muted-foreground"
                    )} />
                    <p className="text-sm font-medium mb-1">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Images: JPG, PNG, WebP (max 3MB) &middot; Video: MP4, WebM (max 50MB)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-center">
                      <Clipboard className="h-3 w-3" />
                      Pro tip: Ctrl+V to paste images from clipboard
                    </p>
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={imageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />

                  {/* Image section */}
                  {layout !== "video" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4" />
                          {layout === "gallery" ? "Primary Image" : "Image"}
                        </label>
                        {!imagePreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => imageRef.current?.click()}
                            className="gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Browse
                          </Button>
                        )}
                      </div>

                      {showImageEditor && imageFile && (
                        <div className="mt-2">
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

                      {imagePreview && !showImageEditor && (
                        <div className="relative group rounded-xl overflow-hidden border border-border">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full max-h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setShowImageEditor(true)}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setImageFile(null);
                                setImagePreview(null);
                                setEditedImageBlob(null);
                                if (imageRef.current) imageRef.current.value = "";
                              }}
                              className="gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video section */}
                  {(layout === "video" || layout === "hero") && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                          <Video className="h-4 w-4" />
                          Video {layout === "video" ? "*" : "(optional)"}
                        </label>
                        {!videoPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => videoRef.current?.click()}
                            className="gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Browse
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        MP4 or WebM, max 50MB, max 2 minutes recommended
                      </p>

                      {showVideoEditor && videoFile && (
                        <div className="mt-2">
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
                        <div className="flex items-center gap-3 rounded-xl border border-border p-3 bg-muted/30">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Video className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Video ready</p>
                            <p className="text-xs text-muted-foreground">Processed and ready to publish</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowVideoEditor(true)}
                          >
                            Re-edit
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gallery section */}
                  {layout === "gallery" && (
                    <GalleryUploader
                      images={galleryImages}
                      onChange={setGalleryImages}
                      max={6}
                    />
                  )}
                </TabsContent>

                {/* ── DESIGN TAB ──────────────────────────────────────── */}
                <TabsContent value="design">
                  <CardDesigner
                    imagePreview={imagePreview}
                    title={title}
                    category={category}
                    catHex={CAT_HEX}
                    design={cardDesign}
                    onChange={setCardDesign}
                  />
                </TabsContent>

                {/* ── PREVIEW TAB ──────────────────────────────────────── */}
                <TabsContent value="preview">
                  <div className="text-center text-xs text-muted-foreground mb-4 bg-muted/30 rounded-lg py-2">
                    Live preview — this is how your content will appear on the dashboard
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
                </TabsContent>
              </Tabs>

              {/* ── Submit bar ────────────────────────────────────────── */}
              <div className="flex gap-2 mt-6 pt-4 border-t border-border sticky bottom-0 bg-background pb-2">
                {editingId && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    disabled={uploading}
                    onClick={() => {
                      handleDelete(editingId);
                      resetForm();
                    }}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Publishing...
                    </>
                  ) : editingId ? (
                    "Update Item"
                  ) : itemStatus === "draft" ? (
                    "Save Draft"
                  ) : itemStatus === "scheduled" ? (
                    <>
                      <Calendar className="h-4 w-4" />
                      Schedule
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Publish to Feed
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

/* ── Grid Card Component ──────────────────────────────────────────────── */

function GridCard({
  item,
  onEdit,
  onDuplicate,
  onDelete,
  onReactivate,
}: {
  item: FeedItem;
  onEdit: (item: FeedItem) => void;
  onDuplicate: (item: FeedItem) => void;
  onDelete: (id: number) => void;
  onReactivate: (id: number) => void;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/20",
        !item.is_active && "opacity-50"
      )}
    >
      {/* Media preview */}
      <div className="relative">
        {item.video_url ? (
          <video
            src={item.video_url}
            muted
            playsInline
            className="w-full h-36 object-cover block"
          />
        ) : item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-36 object-cover block"
          />
        ) : (
          <div className="w-full h-24 bg-muted flex items-center justify-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          <Badge
            className="text-[10px] uppercase tracking-wider border-0 text-white"
            style={{ backgroundColor: CAT_HEX[item.category] ?? "#8B5CF6" }}
          >
            {item.category.replace("_", " ")}
          </Badge>
          {item.is_pinned && (
            <Badge variant="secondary" className="text-[10px] gap-0.5">
              <Pin className="h-2.5 w-2.5" />
              Pinned
            </Badge>
          )}
          {item.display_size === "featured" && (
            <Badge variant="secondary" className="text-[10px] gap-0.5 bg-primary/20 text-primary border-0">
              <Maximize2 className="h-2.5 w-2.5" />
              Featured
            </Badge>
          )}
          {item.display_size === "compact" && (
            <Badge variant="secondary" className="text-[10px] gap-0.5">
              <Minimize2 className="h-2.5 w-2.5" />
              Compact
            </Badge>
          )}
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge
            variant={item.status === "draft" ? "outline" : item.status === "scheduled" ? "secondary" : "default"}
            className="text-[10px] uppercase tracking-wider"
          >
            {item.status || "published"}
          </Badge>
          {!item.is_active && (
            <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
              Inactive
            </Badge>
          )}
        </div>

        {/* Hover overlay with quick actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onEdit(item)}
            className="gap-1 h-8"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDuplicate(item)}
            className="gap-1 h-8"
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1">
          {item.title}
        </h3>
        {item.body && (
          <div
            className="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.body) }}
          />
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {new Date(item.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "short",
                timeZone: "Africa/Kampala",
              })}
            </span>
            {item.gameweek_id && (
              <span className="text-primary font-medium">GW{item.gameweek_id}</span>
            )}
            {(item.view_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Eye className="h-3 w-3" />
                {item.view_count}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {item.is_active ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Deactivate</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onReactivate(item.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reactivate</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── List Row Component ───────────────────────────────────────────────── */

function ListRow({
  item,
  onEdit,
  onDuplicate,
  onDelete,
  onReactivate,
}: {
  item: FeedItem;
  onEdit: (item: FeedItem) => void;
  onDuplicate: (item: FeedItem) => void;
  onDelete: (id: number) => void;
  onReactivate: (id: number) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-md hover:border-primary/20",
        !item.is_active && "opacity-50"
      )}
    >
      {/* Thumbnail */}
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
        ) : item.video_url ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Video className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-semibold truncate">{item.title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className="text-[10px] border-0 text-white"
            style={{ backgroundColor: CAT_HEX[item.category] ?? "#8B5CF6" }}
          >
            {item.category.replace("_", " ")}
          </Badge>
          <Badge
            variant={item.status === "draft" ? "outline" : item.status === "scheduled" ? "secondary" : "default"}
            className="text-[10px]"
          >
            {item.status || "published"}
          </Badge>
          {item.is_pinned && (
            <Pin className="h-3 w-3 text-amber-500" />
          )}
          <span className="text-[11px] text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
              timeZone: "Africa/Kampala",
            })}
          </span>
          {(item.view_count ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {item.view_count}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onDuplicate(item)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate</TooltipContent>
        </Tooltip>
        {item.is_active ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deactivate</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:text-primary"
                onClick={() => onReactivate(item.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reactivate</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
