import { createConversation } from "@/lib/data/conversations";
import { sendWhatsAppText } from "@/lib/evolution/client";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, VisitRequestStatus } from "@/types/database";

type Client = SupabaseClient<Database>;

export function buildVisitConfirmedMessage(
  requestedDatetimeText: string | null,
  naturalWhen?: string | null
): string {
  const when = naturalWhen?.trim() || requestedDatetimeText?.trim();
  if (when) {
    return `Perfeito 👌 Ficou marcado para ${when}.`;
  }
  return "Perfeito 👌 Visita confirmada.";
}

export function buildVisitCancelledMessage(
  _clientName: string,
  requestedDatetimeText: string | null
): string {
  const slotClause = requestedDatetimeText
    ? ` para ${requestedDatetimeText}`
    : "";

  return `Esse horário${slotClause} já não dá infelizmente 🙏 Tens outra data que te dê jeito?`;
}

export function buildVisitConflictMessage(suggestedText: string): string {
  return `Esse horário já não dá 🙏 Consegues ${suggestedText}?`;
}

export function resolveLeadPhoneDigits(
  lead: Pick<Lead, "phone" | "phone_normalized">
): string | null {
  if (lead.phone_normalized) {
    return lead.phone_normalized;
  }
  if (lead.phone) {
    const digits = normalizePhoneDigits(lead.phone);
    return digits.length > 0 ? digits : null;
  }
  return null;
}

export type SendVisitStatusWhatsAppResult = {
  sent: boolean;
  error?: string;
};

export async function sendVisitStatusWhatsApp(
  supabase: Client,
  lead: Lead,
  status: Extract<VisitRequestStatus, "confirmed" | "cancelled">,
  requestedDatetimeText: string | null,
  naturalWhen?: string | null
): Promise<SendVisitStatusWhatsAppResult> {
  const phoneDigits = resolveLeadPhoneDigits(lead);
  if (!phoneDigits) {
    return {
      sent: false,
      error: "This lead has no phone number — WhatsApp was not sent.",
    };
  }

  const text =
    status === "confirmed"
      ? buildVisitConfirmedMessage(requestedDatetimeText, naturalWhen)
      : buildVisitCancelledMessage(lead.client_name, requestedDatetimeText);

  try {
    await sendWhatsAppText(phoneDigits, text);
  } catch (error) {
    return {
      sent: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send WhatsApp notification.",
    };
  }

  try {
    await createConversation(supabase, {
      lead_id: lead.id,
      message: text,
      sender: "agent",
    });
  } catch (error) {
    console.error("[Visit requests] WhatsApp sent but failed to log conversation", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return { sent: true };
}

export async function sendVisitConflictWhatsApp(
  supabase: Client,
  lead: Lead,
  suggestedText: string
): Promise<SendVisitStatusWhatsAppResult> {
  const phoneDigits = resolveLeadPhoneDigits(lead);
  if (!phoneDigits) {
    return {
      sent: false,
      error: "This lead has no phone number — WhatsApp was not sent.",
    };
  }

  const text = buildVisitConflictMessage(suggestedText);

  try {
    await sendWhatsAppText(phoneDigits, text);
  } catch (error) {
    return {
      sent: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send WhatsApp notification.",
    };
  }

  try {
    await createConversation(supabase, {
      lead_id: lead.id,
      message: text,
      sender: "agent",
    });
  } catch (error) {
    console.error("[Visit requests] Conflict WhatsApp failed to log", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return { sent: true };
}
