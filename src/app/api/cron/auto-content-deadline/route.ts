import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { generateDeadlineCountdown } from "@/lib/auto-content-pipelines";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: run the deadline countdown pipeline hourly.
 *
 * This separate schedule lets the 6h / 1h alert windows be checked often
 * enough to actually create the intended reminder drafts.
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

    const countdown = await generateDeadlineCountdown(supabase, openai);
    return NextResponse.json({ ok: true, result: countdown });
  } catch (err: any) {
    console.error("[auto-content-deadline] Cron error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
