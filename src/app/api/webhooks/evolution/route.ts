import { NextResponse } from "next/server";
import {
  parseEvolutionWebhook,
  verifyEvolutionWebhook,
} from "@/lib/evolution/parse-webhook";
import { processIncomingWhatsAppMessage } from "@/lib/evolution/process-incoming";
import type { EvolutionWebhookPayload } from "@/lib/evolution/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;

    if (!verifyEvolutionWebhook(request, payload)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incoming = parseEvolutionWebhook(payload);
    if (!incoming) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const result = await processIncomingWhatsAppMessage(incoming);

    return NextResponse.json({
      ok: true,
      leadId: result.lead.id,
      isNewLead: result.isNewLead,
      whatsappSent: result.whatsappSent,
      clientMessageId: result.clientMessage.id,
      aiMessageId: result.aiMessage?.id ?? null,
    });
  } catch (error) {
    console.error("[Evolution webhook]", error);
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
