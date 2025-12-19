/**
 * @fileOverview Extracts and summarizes key rules and regulations from a document.
 *
 * - extractLeagueRules - A function that handles the extraction and summarization of league rules.
 * - ExtractLeagueRulesInput - The input type for the extractLeagueRules function.
 * - ExtractLeagueRulesOutput - The return type for the extractLeagueRules function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractLeagueRulesInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A document containing league rules, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractLeagueRulesInput = z.infer<typeof ExtractLeagueRulesInputSchema>;

const ExtractLeagueRulesOutputSchema = z.object({
  summary: z.string().describe('A summary of the key league rules.'),
});
export type ExtractLeagueRulesOutput = z.infer<typeof ExtractLeagueRulesOutputSchema>;

export async function extractLeagueRules(input: ExtractLeagueRulesInput): Promise<ExtractLeagueRulesOutput> {
  return extractLeagueRulesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractLeagueRulesPrompt',
  input: {schema: ExtractLeagueRulesInputSchema},
  output: {schema: ExtractLeagueRulesOutputSchema},
  prompt: `You are an expert at extracting and summarizing key rules from documents.

  Please summarize the key rules from the following document.

  Document: {{media url=documentDataUri}}`,
});

const extractLeagueRulesFlow = ai.defineFlow(
  {
    name: 'extractLeagueRulesFlow',
    inputSchema: ExtractLeagueRulesInputSchema,
    outputSchema: ExtractLeagueRulesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
