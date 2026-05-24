import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { sendMessageWithAI } from "@/lib/ai/conversation-service";
import { createClient } from "@/lib/supabase/server";
import type { ConversationSender } from "@/types/database";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const leadId = body.leadId as string | undefined;
    const message = (body.message as string | undefined)?.trim();
    const sender = body.sender as ConversationSender | undefined;

    if (!leadId || !message) {
      return NextResponse.json(
        { error: "leadId and message are required." },
        { status: 400 }
      );
    }

    if (!sender || !["client", "ai", "agent"].includes(sender)) {
      return NextResponse.json({ error: "Invalid sender." }, { status: 400 });
    }

    const result = await sendMessageWithAI(leadId, message, sender);

    revalidatePath(`/leads/${leadId}`);

    return NextResponse.json({
      userMessage: result.userMessage,
      aiMessage: result.aiMessage ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate AI reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
