/**
 * Content Quality Scoring Engine
 *
 * Scores feed content 0-100 based on best practices.
 * Runs entirely client-side — no API calls needed.
 */

export type QualityBreakdown = {
  score: number;           // 0-100 overall
  grade: "A" | "B" | "C" | "D" | "F";
  readingTime: string;     // e.g. "2 min read"
  readingTimeSeconds: number;
  checks: QualityCheck[];
};

export type QualityCheck = {
  label: string;
  passed: boolean;
  points: number;     // points awarded (0 if failed)
  maxPoints: number;  // max possible
  tip: string;        // improvement suggestion
};

/** Strip HTML tags and decode entities */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ");
}

/** Count words in plain text */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Average reading speed: 200 WPM for casual mobile reading */
function readingTime(words: number): { label: string; seconds: number } {
  const seconds = Math.ceil((words / 200) * 60);
  if (seconds < 60) return { label: "< 1 min read", seconds };
  const mins = Math.ceil(seconds / 60);
  return { label: `${mins} min read`, seconds };
}

export function scoreContent(input: {
  title: string;
  bodyHtml: string;
  category: string;
  layout: string;
  hasImage: boolean;
  hasVideo: boolean;
  hasGallery: boolean;
  isPinned: boolean;
  status: string;
}): QualityBreakdown {
  const checks: QualityCheck[] = [];
  const plainBody = stripHtml(input.bodyHtml);
  const bodyWords = wordCount(plainBody);
  const titleLen = input.title.trim().length;

  // 1. Headline length (0-20 pts)
  const headlineOptimal = titleLen >= 30 && titleLen <= 100;
  const headlineOk = titleLen >= 10 && titleLen <= 150;
  checks.push({
    label: "Headline length",
    passed: headlineOptimal,
    points: headlineOptimal ? 20 : headlineOk ? 12 : titleLen > 0 ? 5 : 0,
    maxPoints: 20,
    tip: headlineOptimal
      ? "Great headline length"
      : titleLen < 30
        ? "Headline is too short — aim for 30-100 characters"
        : "Headline is too long — try to keep it under 100 characters",
  });

  // 2. Has body content (0-20 pts)
  const bodyOptimal = bodyWords >= 30 && bodyWords <= 300;
  const bodyOk = bodyWords >= 10;
  checks.push({
    label: "Body content",
    passed: bodyOptimal,
    points: bodyOptimal ? 20 : bodyOk ? 12 : bodyWords > 0 ? 5 : 0,
    maxPoints: 20,
    tip: bodyOptimal
      ? "Good body length for mobile reading"
      : bodyWords === 0
        ? "Add some body text to engage readers"
        : bodyWords < 30
          ? "Body is very short — add more context"
          : "Body is long — mobile users prefer 30-300 words",
  });

  // 3. Has media (0-20 pts)
  const hasMedia = input.hasImage || input.hasVideo || input.hasGallery;
  const mediaNotRequired = input.layout === "quick";
  checks.push({
    label: "Visual media",
    passed: hasMedia || mediaNotRequired,
    points: hasMedia ? 20 : mediaNotRequired ? 15 : 0,
    maxPoints: 20,
    tip: hasMedia
      ? "Visual content attached"
      : mediaNotRequired
        ? "Quick updates work without media, but images boost engagement 2x"
        : "Add an image or video — visual posts get 2x more engagement",
  });

  // 4. Category is specific (0-15 pts)
  const specificCategory = input.category !== "general";
  checks.push({
    label: "Specific category",
    passed: specificCategory,
    points: specificCategory ? 15 : 5,
    maxPoints: 15,
    tip: specificCategory
      ? "Category helps users find relevant content"
      : "Consider a more specific category than 'General' for better discoverability",
  });

  // 5. Headline starts with capital, no all-caps (0-10 pts)
  const titleTrimmed = input.title.trim();
  const startsWithCap = /^[A-Z]/.test(titleTrimmed);
  const isAllCaps = titleTrimmed === titleTrimmed.toUpperCase() && titleLen > 5;
  const headlineFormat = startsWithCap && !isAllCaps;
  checks.push({
    label: "Headline formatting",
    passed: headlineFormat,
    points: headlineFormat ? 10 : startsWithCap ? 5 : 0,
    maxPoints: 10,
    tip: isAllCaps
      ? "Avoid ALL CAPS — it feels like shouting"
      : !startsWithCap
        ? "Start your headline with a capital letter"
        : "Headline formatting looks good",
  });

  // 6. No spelling/grammar red flags (0-15 pts) — basic heuristic
  const hasExcessivePunctuation = /[!?]{3,}/.test(titleTrimmed) || /[!?]{3,}/.test(plainBody);
  const hasRepeatedChars = /(.)\1{4,}/.test(titleTrimmed);
  const cleanWriting = !hasExcessivePunctuation && !hasRepeatedChars;
  checks.push({
    label: "Writing quality",
    passed: cleanWriting,
    points: cleanWriting ? 15 : 5,
    maxPoints: 15,
    tip: hasExcessivePunctuation
      ? "Reduce excessive punctuation (!!!, ???) — one is enough"
      : hasRepeatedChars
        ? "Avoid repeated characters"
        : "Writing quality looks clean",
  });

  // Calculate total
  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const maxTotal = checks.reduce((sum, c) => sum + c.maxPoints, 0);
  const score = Math.round((totalPoints / maxTotal) * 100);

  const grade: QualityBreakdown["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const rt = readingTime(bodyWords);

  return {
    score,
    grade,
    readingTime: rt.label,
    readingTimeSeconds: rt.seconds,
    checks,
  };
}
