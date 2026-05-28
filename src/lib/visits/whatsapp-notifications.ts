import { createConversation } from "@/lib/data/conversations";
import { sendWhatsAppText } from "@/lib/evolution/client";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import {
  VISIT_CANCELLED,
  VISIT_CONFIRMED,
  VISIT_CONFLICT,
} from "@/lib/i18n/messages";
import { getLeadLanguage } from "@/lib/i18n/sync-language";
import type { SupportedLanguage } from "@/lib/i18n/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, VisitRequestStatus } from "@/types/database";

type Client = SupabaseClient<Database>;

function resolveOutboundLanguage(
  lead: Pick<Lead, "preferred_language">,
  language?: SupportedLanguage
): SupportedLanguage {
  return language ?? getLeadLanguage(lead);
}

export function buildVisitConfirmedMessage(
  lead: Pick<Lead, "preferred_language">,
  requestedDatetimeText: string | null,
  naturalWhen?: string | null,
  language?: SupportedLanguage
): string {
  const resolvedLanguage = resolveOutboundLanguage(lead, language);
  const when = naturalWhen?.trim() || requestedDatetimeText?.trim();
  if (when) {
    return VISIT_CONFIRMED[resolvedLanguage].withWhen(when);
  }
  return VISIT_CONFIRMED[resolvedLanguage].generic;
}

export function buildVisitCancelledMessage(
  lead: Pick<Lead, "preferred_language">,
  requestedDatetimeText: string | null,
  language?: SupportedLanguage
): string {
  const resolvedLanguage = resolveOutboundLanguage(lead, language);
  const slotClause = requestedDatetimeText
    ? ` ${requestedDatetimeText}`
    : "";
  return VISIT_CANCELLED[resolvedLanguage](slotClause);
}

export function buildVisitConflictMessage(
  lead: Pick<Lead, "preferred_language">,
  suggestedText: string,
  language?: SupportedLanguage
): string {
  return VISIT_CONFLICT[resolveOutboundLanguage(lead, language)](suggestedText);
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
      ? buildVisitConfirmedMessage(lead, requestedDatetimeText, naturalWhen)
      : buildVisitCancelledMessage(lead, requestedDatetimeText);

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

  const text = buildVisitConflictMessage(lead, suggestedText);

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
