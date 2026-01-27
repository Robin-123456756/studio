import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // 1) Current gameweek (the one with is_current = true)
  const { data: current, error: currentErr } = await supabase
    .from("gameweeks")
    .select("id, name, deadline_time, is_current")
    .eq("is_current", true)
    .maybeSingle();

  if (currentErr) {
    return NextResponse.json({ error: currentErr.message }, { status: 500 });
  }

  // 2) Next gameweek: smallest id greater than current.id
  // If no current is set, we just pick the smallest id as "current" fallback.
  const currentId = current?.id ?? null;

  const nextQuery = supabase
    .from("gameweeks")
    .select("id, name, deadline_time")
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
