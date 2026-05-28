import type { calendar_v3 } from "googleapis";
import { getAuthorizedCalendarClient } from "@/lib/google-calendar/oauth";
import {
  addMinutes,
  formatSuggestedSlot,
  isWithinWorkingHours,
  type ParsedVisitSlot,
} from "@/lib/visits/parse-datetime";
import { VISIT_CONFLICT_FALLBACK_SLOT } from "@/lib/i18n/messages";
import { normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/types";
import type { Lead, Profile, VisitRequestWithLead } from "@/types/database";

export type CalendarConflictResult =
  | { available: true }
  | {
      available: false;
      suggestedSlot: ParsedVisitSlot;
      suggestedText: string;
    };

function getCalendarId(profile: Profile): string {
  return profile.google_calendar_id?.trim() || "primary";
}

function getDurationMinutes(profile: Profile): number {
  return profile.calendar_visit_duration_minutes ?? 60;
}

export async function isCalendarSlotAvailable(
  profile: Profile,
  slot: ParsedVisitSlot
): Promise<boolean> {
  const calendar = getAuthorizedCalendarClient(profile);
  const calendarId = getCalendarId(profile);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: slot.start.toISOString(),
      timeMax: slot.end.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busy = response.data.calendars?.[calendarId]?.busy ?? [];
  return busy.length === 0;
}

export async function findNextAvailableSlot(
  profile: Profile,
  fromSlot: ParsedVisitSlot,
  maxDays = 14,
  language: SupportedLanguage = "pt"
): Promise<ParsedVisitSlot | null> {
  const duration = getDurationMinutes(profile);
  const workStart = profile.calendar_work_start ?? "09:00";
  const workEnd = profile.calendar_work_end ?? "18:00";

  let candidateStart = new Date(fromSlot.start);
  const endSearch = addMinutes(new Date(), maxDays * 24 * 60);

  while (candidateStart < endSearch) {
    const candidateEnd = addMinutes(candidateStart, duration);
    const candidate: ParsedVisitSlot = {
      start: candidateStart,
      end: candidateEnd,
      displayText: formatSuggestedSlot(
        {
          start: candidateStart,
          end: candidateEnd,
          displayText: "",
        },
        language
      ),
    };

    if (
      isWithinWorkingHours(candidate, workStart, workEnd) &&
      (await isCalendarSlotAvailable(profile, candidate))
    ) {
      return candidate;
    }

    candidateStart = addMinutes(candidateStart, 30);
  }

  return null;
}

export async function checkVisitSlotConflict(
  profile: Profile,
  slot: ParsedVisitSlot,
  language: SupportedLanguage = "pt"
): Promise<CalendarConflictResult> {
  const available = await isCalendarSlotAvailable(profile, slot);
  if (available) {
    return { available: true };
  }

  const suggestedSlot = await findNextAvailableSlot(profile, slot, 14, language);
  if (!suggestedSlot) {
    return {
      available: false,
      suggestedSlot: slot,
      suggestedText: VISIT_CONFLICT_FALLBACK_SLOT[language],
    };
  }

  return {
    available: false,
    suggestedSlot,
    suggestedText: formatSuggestedSlot(suggestedSlot, language),
  };
}

export async function createVisitCalendarEvent(
  profile: Profile,
  visit: VisitRequestWithLead,
  lead: Lead,
  slot: ParsedVisitSlot
): Promise<string> {
  const calendar = getAuthorizedCalendarClient(profile);
  const calendarId = getCalendarId(profile);
  const propertyTitle =
    visit.property_title?.trim() ||
    visit.leads.property_type ||
    "Imóvel";

  const descriptionLines = [
    `Cliente: ${lead.client_name}`,
    lead.phone ? `Telefone: ${lead.phone}` : null,
    visit.requested_datetime_text
      ? `Pedido original: ${visit.requested_datetime_text}`
      : null,
    visit.notes ? `Notas: ${visit.notes}` : null,
    `Lead ID: ${lead.id}`,
  ].filter(Boolean);

  const event: calendar_v3.Schema$Event = {
    summary: `Visita — ${lead.client_name} · ${propertyTitle}`,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: slot.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: slot.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  const eventId = response.data.id;
  if (!eventId) {
    throw new Error("Google Calendar did not return an event ID.");
  }

  return eventId;
}

export async function deleteVisitCalendarEvent(
  profile: Profile,
  eventId: string
): Promise<void> {
  const calendar = getAuthorizedCalendarClient(profile);
  const calendarId = getCalendarId(profile);

  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (error) {
    console.warn("[Google Calendar] Failed to delete event", {
      eventId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
