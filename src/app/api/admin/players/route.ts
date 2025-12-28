import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-password") || "";
  return token === (process.env.ADMIN_PASSWORD || "");
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const position = String(body.position ?? "").trim();
  const team_id = String(body.team_id ?? "").trim();

  const avatar_url = body.avatar_url ? String(body.avatar_url) : null;
  const price = Number(body.price ?? 0);
  const points = Number(body.points ?? 0);

  if (!name || !position || !team_id) {
    return NextResponse.json({ error: "name, position, team_id required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("players")
    .insert([{ name, position, team_id, avatar_url, price, points }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ player: data });
}
