"use server";

import { revalidatePath } from "next/cache";
import { sendMessageWithAI } from "@/lib/ai/conversation-service";
import type { Conversation, ConversationSender } from "@/types/database";

export type SendMessageState = {
  error?: string;
  userMessage?: Conversation;
  aiMessage?: Conversation;
};

export async function sendMessage(
  leadId: string,
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const message = (formData.get("message") as string)?.trim();
  const sender = formData.get("sender") as ConversationSender;

  if (!message) {
    return { error: "Message cannot be empty." };
  }

  if (!sender || !["client", "ai", "agent"].includes(sender)) {
    return { error: "Invalid sender." };
  }

  try {
    const result = await sendMessageWithAI(leadId, message, sender);
    revalidatePath(`/leads/${leadId}`);

    return {
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to send message.",
    };
  }
}
