const WEEKDAYS_PT: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  terça: 2,
  "terça-feira": 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
  sábado: 6,
  "sabado-feira": 6,
};

export type ParsedVisitSlot = {
  start: Date;
  end: Date;
  displayText: string;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function nextWeekday(reference: Date, weekday: number): Date {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const current = date.getDay();
  let delta = weekday - current;
  if (delta <= 0) delta += 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function applyTime(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function formatDisplayText(date: Date): string {
  const weekday = date.toLocaleDateString("pt-PT", { weekday: "long" });
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const time =
    minutes === 0
      ? `${hours}h`
      : `${hours}:${String(minutes).padStart(2, "0")}`;
  return `${weekday} às ${time}`;
}

export function parseRequestedVisitDatetime(
  text: string | null | undefined,
  durationMinutes: number,
  referenceDate = new Date()
): ParsedVisitSlot | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const normalized = normalizeText(raw);

  const isoMatch = raw.match(
    /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/
  );
  if (isoMatch) {
    const start = new Date(isoMatch[0].replace(" ", "T"));
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      return { start, end, displayText: formatDisplayText(start) };
    }
  }

  const dateMatch = normalized.match(
    /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/
  );
  let baseDate = new Date(referenceDate);
  baseDate.setHours(0, 0, 0, 0);

  if (normalized.includes("amanha")) {
    baseDate.setDate(baseDate.getDate() + 1);
  } else if (normalized.includes("depois de amanha")) {
    baseDate.setDate(baseDate.getDate() + 2);
  } else {
    for (const [name, weekday] of Object.entries(WEEKDAYS_PT)) {
      if (normalized.includes(name)) {
        baseDate = nextWeekday(referenceDate, weekday);
        break;
      }
    }
  }

  if (dateMatch) {
    const day = Number.parseInt(dateMatch[1], 10);
    const month = Number.parseInt(dateMatch[2], 10) - 1;
    const year = dateMatch[3]
      ? Number.parseInt(
          dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3],
          10
        )
      : referenceDate.getFullYear();
    baseDate = new Date(year, month, day);
  }

  const timeMatch = normalized.match(
    /(?:as|às|a)\s*(\d{1,2})(?::(\d{2}))?\s*(h|horas)?/
  );
  const bareTimeMatch = normalized.match(/\b(\d{1,2})[:h](\d{2})?\b/);

  let hours: number | null = null;
  let minutes = 0;

  if (timeMatch) {
    hours = Number.parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? Number.parseInt(timeMatch[2], 10) : 0;
  } else if (bareTimeMatch) {
    hours = Number.parseInt(bareTimeMatch[1], 10);
    minutes = bareTimeMatch[2] ? Number.parseInt(bareTimeMatch[2], 10) : 0;
  }

  if (hours == null || hours > 23 || minutes > 59) {
    return null;
  }

  const start = applyTime(baseDate, hours, minutes);
  if (start.getTime() <= referenceDate.getTime() - 60 * 60_000) {
    start.setDate(start.getDate() + 7);
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start,
    end,
    displayText: formatDisplayText(start),
  };
}

export function formatSlotForWhatsApp(slot: ParsedVisitSlot): string {
  return slot.displayText;
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes ?? 0);
}

export function isWithinWorkingHours(
  slot: ParsedVisitSlot,
  workStart: string,
  workEnd: string
): boolean {
  const startMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
  const endMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();
  const workStartMinutes = parseTimeToMinutes(workStart);
  const workEndMinutes = parseTimeToMinutes(workEnd);
  return startMinutes >= workStartMinutes && endMinutes <= workEndMinutes;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatSuggestedSlot(slot: ParsedVisitSlot): string {
  return formatDisplayText(slot.start);
}
