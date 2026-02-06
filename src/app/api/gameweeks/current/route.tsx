// src/app/api/gameweeks/current/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // 1) Current gameweek (admin flag)
  const { data: flaggedCurrent, error } = await supabase
    .from("gameweeks")
    .select("id, name, deadline_time, finalized, is_current")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Earliest open gameweek (not finalized)
  const { data: earliestOpen, error: openErr } = await supabase
    .from("gameweeks")
    .select("id, name, deadline_time, finalized, is_current")
    .or("finalized.is.false,finalized.is.null")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (openErr) {
    return NextResponse.json({ error: openErr.message }, { status: 500 });
  }

  // Prefer the earliest open gameweek if it's ahead of or missing from the flag
  let current = flaggedCurrent ?? null;
  if (earliestOpen) {
    if (!current) current = earliestOpen;
    else if (current.finalized) current = earliestOpen;
    else if (earliestOpen.id < current.id) current = earliestOpen;
  }

  // 3) Next gameweek
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
