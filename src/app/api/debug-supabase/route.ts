import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.SUPABASE_URL ?? "";
  return NextResponse.json({
    raw,
    show: `>>>${raw}<<<`,
    startsWithHttp: raw.startsWith("http://") || raw.startsWith("https://"),
    hasSpace: /\s/.test(raw),
    length: raw.length,
  });
}
