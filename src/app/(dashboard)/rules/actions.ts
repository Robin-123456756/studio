'use server';

import { extractLeagueRules, ExtractLeagueRulesInput } from "@/ai/flows/extract-league-rules";

export async function getRulesSummary(data: ExtractLeagueRulesInput) {
  try {
    const result = await extractLeagueRules(data);
    return { success: true, summary: result.summary };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to extract rules. The AI model may be unavailable or the document format is not supported. Please try again." };
  }
}
