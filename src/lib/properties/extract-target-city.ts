/** Target city extraction — resolves pivot/rejection messages with multiple city mentions. */

import {
  CITY_ALIAS_KEYS,
  CITY_ALIASES,
  escapeRegex,
  foldKey,
  isPropertyTypeToken,
  normalizeCity,
} from "@/lib/properties/city-aliases";

export type CityMention = {
  city: string;
  start: number;
  end: number;
  source: "alias" | "preposition" | "pivot_phrase";
};

export type TargetCityConfidence = "high" | "medium" | "low";

export type TargetCityExtraction = {
  targetCity: string | null;
  rejectedCities: string[];
  confidence: TargetCityConfidence;
  evidence: string[];
};

const REJECTION_BEFORE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "nao_quero", pattern: /\bnao quero\b/ },
  { id: "nao_gosto", pattern: /\bnao gosto\b/ },
  { id: "dont_want", pattern: /\bdon'?t want\b/ },
  { id: "do_not_want", pattern: /\bdo not want\b/ },
  { id: "not_interested", pattern: /\bnot interested\b/ },
  { id: "non_mi_piace", pattern: /\bnon mi piace\b/ },
  { id: "non_voglio", pattern: /\bnon voglio\b/ },
  { id: "ne_veux_pas", pattern: /\bne veux pas\b/ },
  { id: "je_ne_veux_pas", pattern: /\bje ne veux pas\b/ },
  { id: "no_quiero", pattern: /\bno quiero\b/ },
  { id: "no_me_gusta", pattern: /\bno me gusta\b/ },
  { id: "not_for_me", pattern: /\bnot for me\b/ },
];

const REJECTION_AFTER_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "fica_longe", pattern: /\bfica longe\b/ },
  { id: "e_longe", pattern: /\be longe\b/ },
  { id: "doesnt_work", pattern: /\bdoesn'?t work\b/ },
  { id: "does_not_work", pattern: /\bdoes not work\b/ },
  { id: "dont_work", pattern: /\bdon'?t work\b/ },
  { id: "troppo_lontano", pattern: /\btroppo lontan[oa]\b/ },
  { id: "too_far", pattern: /\btoo far\b/ },
  { id: "is_too_far", pattern: /\bis too far\b/ },
];

const PREFERENCE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "prefiro", pattern: /\bprefiro\b/ },
  { id: "prefer", pattern: /\bprefer\b/ },
  { id: "prefere", pattern: /\bprefere\b/ },
  { id: "instead", pattern: /\binstead\b/ },
  { id: "rather", pattern: /\brather\b/ },
  { id: "meglio", pattern: /\bmeglio\b/ },
  { id: "show_me", pattern: /\bshow me\b/ },
  { id: "tens_algo_em", pattern: /\btens algo em\b/ },
  { id: "tem_algo_em", pattern: /\btem algo em\b/ },
  { id: "avete_qualcosa_a", pattern: /\bavete qualcosa a\b/ },
  { id: "avete_qualcosa_in", pattern: /\bavete qualcosa in\b/ },
  { id: "do_you_have_anything_in", pattern: /\bdo you have anything in\b/ },
  { id: "anything_in", pattern: /\banything in\b/ },
  { id: "something_in", pattern: /\bsomething in\b/ },
  { id: "looking_for", pattern: /\blooking for\b/ },
];

const PREPOSITION_PATTERN =
  /\b(?:em|in|en|a|at|near|around)\s+([a-z]+)\b/g;

const PIVOT_PHRASE_PATTERN =
  /\b(?:tens algo em|tem algo em|avete qualcosa a|avete qualcosa in|do you have anything in|show me|something in|anything in)\s+([a-z]+)\b/g;

const REJECTION_WINDOW_BEFORE = 50;
const REJECTION_WINDOW_AFTER = 45;
const PREFERENCE_WINDOW_BEFORE = 55;
const PREFERENCE_WINDOW_AFTER = 15;

function dedupeMentions(mentions: CityMention[]): CityMention[] {
  const sorted = [...mentions].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );
  const kept: CityMention[] = [];

  for (const mention of sorted) {
    const overlapIndex = kept.findIndex(
      (existing) => mention.start < existing.end && mention.end > existing.start
    );
    if (overlapIndex === -1) {
      kept.push(mention);
      continue;
    }

    const existing = kept[overlapIndex];
    const mentionSpan = mention.end - mention.start;
    const existingSpan = existing.end - existing.start;
    if (mentionSpan > existingSpan) {
      kept[overlapIndex] = mention;
    } else if (
      mentionSpan === existingSpan &&
      mention.source === "pivot_phrase" &&
      existing.source !== "pivot_phrase"
    ) {
      kept[overlapIndex] = mention;
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}

function findAliasMentions(folded: string): CityMention[] {
  const mentions: CityMention[] = [];

  for (const key of CITY_ALIAS_KEYS) {
    const pattern = new RegExp(`\\b${escapeRegex(foldKey(key))}\\b`, "g");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(folded)) !== null) {
      mentions.push({
        city: CITY_ALIASES[key],
        start: match.index,
        end: match.index + match[0].length,
        source: "alias",
      });
    }
  }

  return mentions;
}

function findPrepositionMentions(
  folded: string,
  pattern: RegExp,
  source: CityMention["source"],
  useCityTokenPosition = false
): CityMention[] {
  const mentions: CityMention[] = [];
  const re = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(folded)) !== null) {
    const candidate = match[1]?.trim();
    if (!candidate || isPropertyTypeToken(candidate)) continue;

    const city = normalizeCity(candidate);
    if (!city) continue;

    let start = match.index;
    let end = match.index + match[0].length;

    if (useCityTokenPosition) {
      const cityOffset = match[0].lastIndexOf(candidate);
      if (cityOffset >= 0) {
        start = match.index + cityOffset;
        end = start + candidate.length;
      }
    }

    mentions.push({
      city,
      start,
      end,
      source,
    });
  }

  return mentions;
}

export function extractAllCityMentions(text: string): CityMention[] {
  if (!text.trim()) return [];

  const folded = foldKey(text);
  const mentions = dedupeMentions([
    ...findAliasMentions(folded),
    ...findPrepositionMentions(folded, PREPOSITION_PATTERN, "preposition", true),
    ...findPrepositionMentions(
      folded,
      PIVOT_PHRASE_PATTERN,
      "pivot_phrase",
      true
    ),
  ]);

  return mentions;
}

function lastPatternIndex(text: string, pattern: RegExp): number {
  let last = -1;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    last = match.index;
  }
  return last;
}

function collectWindowEvidence(
  slice: string,
  patterns: Array<{ id: string; pattern: RegExp }>,
  prefix: string,
  position: "before" | "after"
): string[] {
  const evidence: string[] = [];
  for (const { id, pattern } of patterns) {
    if (pattern.test(slice)) {
      evidence.push(`${prefix}:${position}:${id}`);
    }
  }
  return evidence;
}

function shouldSkipRejectionBefore(folded: string, mentionStart: number): boolean {
  const beforeFull = folded.slice(0, mentionStart);

  let lastRejection = -1;
  for (const { pattern } of REJECTION_BEFORE_PATTERNS) {
    lastRejection = Math.max(lastRejection, lastPatternIndex(beforeFull, pattern));
  }

  let lastPreference = -1;
  for (const { pattern } of PREFERENCE_PATTERNS) {
    lastPreference = Math.max(lastPreference, lastPatternIndex(beforeFull, pattern));
  }

  return lastRejection >= 0 && lastPreference > lastRejection;
}

function scoreMention(
  folded: string,
  mention: CityMention
): { rejected: boolean; preferred: boolean; evidence: string[] } {
  const before = folded.slice(
    Math.max(0, mention.start - REJECTION_WINDOW_BEFORE),
    mention.start
  );
  const after = folded.slice(
    mention.start,
    Math.min(folded.length, mention.end + REJECTION_WINDOW_AFTER)
  );
  const preferenceBefore = folded.slice(
    Math.max(0, mention.start - PREFERENCE_WINDOW_BEFORE),
    mention.start
  );
  const preferenceAfter = folded.slice(
    mention.start,
    Math.min(folded.length, mention.end + PREFERENCE_WINDOW_AFTER)
  );

  const rejectionEvidence = [
    ...(shouldSkipRejectionBefore(folded, mention.start)
      ? []
      : collectWindowEvidence(before, REJECTION_BEFORE_PATTERNS, "rejection", "before")),
    ...collectWindowEvidence(after, REJECTION_AFTER_PATTERNS, "rejection", "after"),
  ];

  const preferenceEvidence = [
    ...collectWindowEvidence(
      preferenceBefore,
      PREFERENCE_PATTERNS,
      "preference",
      "before"
    ),
    ...collectWindowEvidence(
      preferenceAfter,
      PREFERENCE_PATTERNS,
      "preference",
      "after"
    ),
  ];

  if (mention.source === "pivot_phrase") {
    preferenceEvidence.push("preference:pivot_phrase");
  }

  const evidence = [...rejectionEvidence, ...preferenceEvidence];

  return {
    rejected: rejectionEvidence.length > 0,
    preferred: preferenceEvidence.length > 0,
    evidence,
  };
}

function pickLatest(mentions: CityMention[]): CityMention | null {
  if (mentions.length === 0) return null;
  return mentions.reduce((latest, current) =>
    current.start > latest.start ? current : latest
  );
}

function latestScoreByCity<T extends { mention: CityMention }>(scored: T[]): T[] {
  const byCity = new Map<string, T>();
  for (const item of scored) {
    const existing = byCity.get(item.mention.city);
    if (!existing || item.mention.start > existing.mention.start) {
      byCity.set(item.mention.city, item);
    }
  }
  return [...byCity.values()];
}

export function extractTargetCityFromMessage(text: string): TargetCityExtraction {
  if (!text.trim()) {
    return {
      targetCity: null,
      rejectedCities: [],
      confidence: "low",
      evidence: ["empty_message"],
    };
  }

  const folded = foldKey(text);
  const mentions = extractAllCityMentions(text);

  if (mentions.length === 0) {
    return {
      targetCity: null,
      rejectedCities: [],
      confidence: "low",
      evidence: ["no_city_mentions"],
    };
  }

  const scored = mentions.map((mention) => {
    const score = scoreMention(folded, mention);
    return { mention, ...score };
  });
  const cityScores = latestScoreByCity(scored);

  const rejectedCities = cityScores
    .filter((item) => item.rejected)
    .map((item) => item.mention.city);

  const evidence = [
    ...scored.flatMap((item) =>
      item.evidence.map((entry) => `${item.mention.city}:${entry}`)
    ),
    `mentions:${mentions.map((m) => m.city).join(",")}`,
  ];

  if (mentions.length === 1) {
    const only = cityScores[0];
    return {
      targetCity: only.mention.city,
      rejectedCities: only.rejected ? [only.mention.city] : [],
      confidence: only.rejected ? "low" : "high",
      evidence,
    };
  }

  const preferredCandidates = cityScores.filter(
    (item) => !item.rejected && item.preferred
  );
  const preferredWinner = pickLatest(preferredCandidates.map((item) => item.mention));
  if (preferredWinner) {
    return {
      targetCity: preferredWinner.city,
      rejectedCities,
      confidence: "high",
      evidence: [...evidence, "resolution:preferred_latest"],
    };
  }

  const nonRejected = cityScores.filter((item) => !item.rejected);
  const nonRejectedWinner = pickLatest(nonRejected.map((item) => item.mention));
  if (nonRejectedWinner) {
    return {
      targetCity: nonRejectedWinner.city,
      rejectedCities,
      confidence: rejectedCities.length > 0 ? "high" : "medium",
      evidence: [...evidence, "resolution:latest_non_rejected"],
    };
  }

  const fallbackWinner = pickLatest(cityScores.map((item) => item.mention));
  return {
    targetCity: fallbackWinner?.city ?? null,
    rejectedCities,
    confidence: "low",
    evidence: [...evidence, "resolution:all_rejected_latest_fallback"],
  };
}
