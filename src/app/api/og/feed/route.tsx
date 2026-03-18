import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const runtime = "edge";

const CAT_LABELS: Record<string, string> = {
  announcement: "Announcement", matchday: "Match Day", player_spotlight: "Player Spotlight",
  deadline: "Deadline", general: "General", breaking: "BREAKING",
  transfer_news: "Transfer News", match_report: "Match Report",
};

/**
 * GET /api/og/feed?id=N
 *
 * Generates a branded 1200x630 OG image for a feed post.
 * Uses @vercel/og (Satori + Resvg) on Edge Runtime.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();
  const now = new Date().toISOString();
  const { data: post } = await supabase
    .from("feed_media")
    .select("title, category, image_url")
    .eq("id", parseInt(id, 10))
    .eq("is_active", true)
    .or(`status.eq.published,and(status.eq.scheduled,publish_at.lte.${now})`)
    .maybeSingle();

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  const catLabel = CAT_LABELS[post.category] || post.category || "General";
  const title = post.title || "Budo League";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px",
          background: "linear-gradient(135deg, #37003C 0%, #1a0020 50%, #0d0012 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Category badge */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "60px",
            display: "flex",
            padding: "8px 20px",
            borderRadius: "20px",
            background: "rgba(200, 16, 46, 0.9)",
            color: "white",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.5px",
          }}
        >
          {catLabel}
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? "42px" : "52px",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.2,
              maxWidth: "900px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title.length > 100 ? title.substring(0, 97) + "..." : title}
          </div>

          {/* Branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#C8102E",
              }}
            />
            <span
              style={{
                fontSize: "22px",
                color: "rgba(255,255,255,0.7)",
                fontWeight: 600,
              }}
            >
              The Budo League
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
