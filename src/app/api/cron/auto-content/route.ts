import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import {
  generateGWPreview,
  generateGWRecap,
  generatePlayerSpotlight,
  generateMatchReports,
  generateTransferBuzz,
  generateMilestoneAlerts,
} from "@/lib/auto-content-pipelines";

type PipelineResult = {
  pipeline: string;
  created: boolean;
  postId?: number;
  postIds?: number[];
  reason?: string;
};

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: auto-generate the daily draft feed content.
 *
 * Runs daily at 7am UTC (10am Kampala). Each run checks the daily pipelines:
 *   1. GW Preview       - 24h before deadline
 *   2. GW Recap         - all GW matches final + GW finalized
 *   3. Player Spotlight - Mondays only
 *   4. Match Reports    - per-match when is_final
 *   5. Transfer Buzz    - trending transfer-in player (daily)
 *   6. Milestone Alerts - player crosses stat threshold
 *
 * Posts are created as drafts. Admin reviews and publishes manually.
 * Deadline countdown runs in a separate hourly cron so the 6h / 1h windows
 * can be detected reliably.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerOrThrow();

    let openai: OpenAI | null = null;
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey && !/\s/.test(apiKey)) {
      openai = new OpenAI({ apiKey });
    }

    // Run daily pipelines independently so one failure doesn't crash the rest.
    const safe = async (
      name: string,
      fn: () => Promise<PipelineResult>,
    ): Promise<PipelineResult> => {
      try {
        return await fn();
      } catch (err: any) {
        console.error(`[auto-content] Pipeline "${name}" crashed:`, err?.message);
        return { pipeline: name, created: false, reason: `Error: ${err?.message}` };
      }
    };

    const [preview, recap, spotlight, matchReports, transferBuzz, milestones] =
      await Promise.all([
        safe("gw_preview", () => generateGWPreview(supabase, openai)),
        safe("gw_recap", () => generateGWRecap(supabase, openai)),
        safe("player_spotlight", () => generatePlayerSpotlight(supabase, openai)),
        safe("match_reports", () => generateMatchReports(supabase, openai)),
        safe("transfer_buzz", () => generateTransferBuzz(supabase, openai)),
        safe("milestone_alerts", () => generateMilestoneAlerts(supabase, openai)),
      ]);

    const all = [preview, recap, spotlight, matchReports, transferBuzz, milestones];
    const results = { preview, recap, spotlight, matchReports, transferBuzz, milestones };
    const created = all.filter((r) => r.created).length;

    console.log(`[auto-content] ${created} pipeline(s) created drafts:`, JSON.stringify(results));

    return NextResponse.json({ ok: true, created, results });
  } catch (err: any) {
    console.error("[auto-content] Cron error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
