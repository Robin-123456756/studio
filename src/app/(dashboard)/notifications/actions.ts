'use server';
import { sendSmartNotification, SmartNotificationInput } from "@/ai/flows/smart-notifications";

export async function checkNotificationRelevance(data: SmartNotificationInput) {
  try {
    const result = await sendSmartNotification(data);
    return { success: true, ...result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to check relevance. The AI model may be unavailable. Please try again." };
  }
}
