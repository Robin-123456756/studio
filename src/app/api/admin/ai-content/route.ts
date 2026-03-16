import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getOpenAIApiKey } from "@/lib/openai/api-key";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/* ── Lazy OpenAI init (same pattern as voice-admin) ──────────────────── */

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  return _openai;
}

/* ── Types ────────────────────────────────────────────────────────────── */

type AiAction = "headlines" | "summarize" | "tone";

/* ── Prompts ──────────────────────────────────────────────────────────── */

const HEADLINE_SYSTEM = `You are a sports content editor for a fantasy football league in Kampala, Uganda called "The Budo League".
Generate exactly 5 headline options for a feed post. Headlines should be:
- Engaging, punchy, and concise (max 120 chars each)
- Varied in style: 1 factual, 1 question, 1 bold/dramatic, 1 casual/fun, 1 with a stat or number
- Relevant to fantasy football and the Budo League audience
- Written in English

Return ONLY a JSON object: { "headlines": ["headline1", "headline2", "headline3", "headline4", "headline5"] }`;

const SUMMARIZE_SYSTEM = `You are a sports content editor. Given an article body (may contain HTML), create a concise TL;DR summary.
Requirements:
- Maximum 2 sentences, under 160 characters total
- Strip all HTML, focus on key facts
- Written in plain, engaging English suitable for mobile notification
- If the text is too short to summarize, just clean it up

Return ONLY a JSON object: { "summary": "your summary here" }`;

const TONE_SYSTEM = `You are a content tone analyzer for a fantasy football league. Analyze the given headline + body and determine:
1. The detected tone (one of: "neutral", "urgent", "celebratory", "informative", "casual", "dramatic")
2. Whether the tone matches the given category
3. A brief suggestion if there's a mismatch

Categories and expected tones:
- announcement: neutral/informative
- matchday: dramatic/celebratory
- player_spotlight: celebratory/informative
- deadline: urgent
- general: neutral/casual
- breaking: urgent/dramatic
- transfer_news: informative/dramatic
- match_report: informative/celebratory

Return ONLY a JSON object: { "tone": "detected_tone", "matches_category": true/false, "suggestion": "brief suggestion or empty string" }`;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function safeExtract(response: OpenAI.Chat.Completions.ChatCompletion): Record<string, any> {
  const content = response.choices?.[0]?.message?.content;
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/* ── POST handler ─────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as AiAction;

    if (!action || !["headlines", "summarize", "tone"].includes(action)) {
      return apiError("Invalid action. Use: headlines, summarize, tone", "INVALID_ACTION", 400);
    }

    const openai = getOpenAI();

    /* ── Headlines ─────────────────────────────────────────────────── */
    if (action === "headlines") {
      const { hint, category, body: articleBody } = body;
      if (!hint && !articleBody) {
        return apiError("Provide a hint or body text to generate headlines.", "MISSING_INPUT", 400);
      }

      const userContent = [
        `Category: ${category || "general"}`,
        hint ? `Topic/Idea: ${hint}` : "",
        articleBody ? `Article body: ${articleBody.substring(0, 500)}` : "",
      ].filter(Boolean).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: HEADLINE_SYSTEM },
          { role: "user", content: userContent },
        ],
      });

      const parsed = safeExtract(response);
      const headlines = Array.isArray(parsed.headlines)
        ? parsed.headlines.filter((h: unknown) => typeof h === "string" && h.trim()).slice(0, 5)
        : [];

      if (headlines.length === 0) {
        return apiError("AI failed to generate headlines.", "AI_PARSE_ERROR", 500);
      }

      return NextResponse.json({ headlines });
    }

    /* ── Summarize ─────────────────────────────────────────────────── */
    if (action === "summarize") {
      const { body: articleBody, title } = body;
      if (!articleBody && !title) {
        return apiError("Provide body text or title to summarize.", "MISSING_INPUT", 400);
      }

      const userContent = [
        title ? `Title: ${title}` : "",
        articleBody ? `Body: ${articleBody.substring(0, 2000)}` : "",
      ].filter(Boolean).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SUMMARIZE_SYSTEM },
          { role: "user", content: userContent },
        ],
      });

      const parsed = safeExtract(response);

      return NextResponse.json({ summary: parsed.summary || "" });
    }

    /* ── Tone ──────────────────────────────────────────────────────── */
    if (action === "tone") {
      const { title, body: articleBody, category } = body;
      if (!title) {
        return apiError("Provide at least a title for tone analysis.", "MISSING_INPUT", 400);
      }

      const userContent = [
        `Category: ${category || "general"}`,
        `Title: ${title}`,
        articleBody ? `Body: ${articleBody.substring(0, 1000)}` : "",
      ].filter(Boolean).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TONE_SYSTEM },
          { role: "user", content: userContent },
        ],
      });

      const parsed = safeExtract(response);

      return NextResponse.json({
        tone: parsed.tone || "neutral",
        matches_category: parsed.matches_category ?? true,
        suggestion: parsed.suggestion || "",
      });
    }

    return apiError("Unhandled action", "UNKNOWN", 400);
  } catch (err) {
    return apiError("AI service error. Try again.", "AI_ERROR", 500, err);
  }
}
