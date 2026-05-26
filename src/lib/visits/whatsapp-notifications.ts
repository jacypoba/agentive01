import { createConversation } from "@/lib/data/conversations";
import { sendWhatsAppText } from "@/lib/evolution/client";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, VisitRequestStatus } from "@/types/database";

type Client = SupabaseClient<Database>;

function firstName(clientName: string): string {
  const trimmed = clientName.trim();
  if (!trimmed) return "Olá";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function buildVisitConfirmedMessage(
  clientName: string,
  requestedDatetimeText: string | null
): string {
  const name = firstName(clientName);
  const whenClause = requestedDatetimeText
    ? ` referente a ${requestedDatetimeText}`
    : "";

  return `${name}, a nossa equipa confirmou o seu pedido de visita${whenClause}. Entraremos em contacto em breve com os detalhes finais. Obrigado!`;
}

export function buildVisitCancelledMessage(
  clientName: string,
  requestedDatetimeText: string | null
): string {
  const name = firstName(clientName);
  const slotClause = requestedDatetimeText
    ? ` para ${requestedDatetimeText}`
    : "";

  return `${name}, infelizmente o horário solicitado${slotClause} já não está disponível. Pode indicar-nos outra data ou horário de preferência? Obrigado!`;
}

export function resolveLeadPhoneDigits(lead: Lead): string | null {
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
  requestedDatetimeText: string | null
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
      ? buildVisitConfirmedMessage(lead.client_name, requestedDatetimeText)
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
