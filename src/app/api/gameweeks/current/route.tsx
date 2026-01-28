// src/app/api/gameweeks/current/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // 1) Current gameweek
  const { data: current, error } = await supabase
    .from("gameweeks")
    .select("id, name, deadline_time, finalized, is_current")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Next gameweek
  const currentId = current?.id ?? null;

  const nextQuery = supabase
    .from("gameweeks")
    .select("id, name, deadline_time, finalized, is_current")
    .order("id", { ascending: true })
    .limit(1);

  const { data: next, error: nextErr } = currentId
    ? await nextQuery.gt("id", currentId).maybeSingle()
    : await nextQuery.maybeSingle();

  if (nextErr) {
    return NextResponse.json({ error: nextErr.message }, { status: 500 });
  }

  return NextResponse.json({
    current: current ?? null,
    next: next ?? null,
  });
}
