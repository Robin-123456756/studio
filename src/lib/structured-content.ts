/**
 * Structured Content Types and Helpers
 *
 * Every feed post can optionally carry structured_data JSONB
 * for typed, channel-agnostic content rendering.
 */

export type StructuredContent = {
  headline: string;
  summary: string;
  facts: string[];
  media_refs: string[];
  tags: string[];
};

/** Strip HTML tags for plain text extraction */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

/** Extract first sentence from plain text */
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.substring(0, 160).trim();
}

/** Auto-populate structured data from existing post fields */
export function extractStructuredData(input: {
  title: string;
  bodyHtml: string;
  category: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}): StructuredContent {
  const plainBody = stripHtml(input.bodyHtml);

  const mediaRefs: string[] = [];
  if (input.imageUrl) mediaRefs.push(input.imageUrl);
  if (input.videoUrl) mediaRefs.push(input.videoUrl);

  return {
    headline: input.title,
    summary: firstSentence(plainBody) || input.title,
    facts: [],
    media_refs: mediaRefs,
    tags: [input.category],
  };
}
