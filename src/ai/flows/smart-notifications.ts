// src/ai/flows/smart-notifications.ts
'use server';

/**
 * @fileOverview A smart notification AI agent that sends notifications to the relevant users about game schedules, score updates, and rule changes based on their roles.
 *
 * - sendSmartNotification - A function that handles the smart notification process.
 * - SmartNotificationInput - The input type for the sendSmartNotification function.
 * - SmartNotificationOutput - The return type for the sendSmartNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartNotificationInputSchema = z.object({
  notificationType: z.enum(['game_schedule', 'score_update', 'rule_change']).describe('The type of notification.'),
  userRole: z.enum(['league_admin', 'team_member', 'coach']).describe('The role of the user receiving the notification.'),
  message: z.string().describe('The message to be sent in the notification.'),
  gameDetails: z.string().optional().describe('Details about the game, if applicable.'),
  ruleChanges: z.string().optional().describe('Details about the rule changes, if applicable.'),
});
export type SmartNotificationInput = z.infer<typeof SmartNotificationInputSchema>;

const SmartNotificationOutputSchema = z.object({
  relevant: z.boolean().describe('Whether the notification is relevant to the user based on their role and the notification type.'),
  reason: z.string().describe('The reason why the notification is relevant or not relevant.'),
});
export type SmartNotificationOutput = z.infer<typeof SmartNotificationOutputSchema>;

export async function sendSmartNotification(input: SmartNotificationInput): Promise<SmartNotificationOutput> {
  return smartNotificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartNotificationPrompt',
  input: {schema: SmartNotificationInputSchema},
  output: {schema: SmartNotificationOutputSchema},
  prompt: `You are an AI assistant that determines whether a notification is relevant to a user based on their role and the notification type.

Notification Type: {{{notificationType}}}
User Role: {{{userRole}}}
Message: {{{message}}}

Consider the following:
- League admins should receive all notifications.
- Team members should receive notifications about game schedules and score updates related to their team.
- Coaches should receive notifications about game schedules, score updates, and rule changes.

Respond with JSON. Your response must have the following structure:
{
  "relevant": true or false,
  "reason": "A brief explanation of why the notification is relevant or not relevant to the user."
}

Is the above notification relevant to the user?`,
});

const smartNotificationFlow = ai.defineFlow(
  {
    name: 'smartNotificationFlow',
    inputSchema: SmartNotificationInputSchema,
    outputSchema: SmartNotificationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
