import type { Conversation } from "@/types/database";

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

export function normalizeForDedupe(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

export function isPropertyPayloadMessage(message: string): boolean {
  return (
    message.startsWith("🏡") ||
    message.includes("[property:") ||
    message.startsWith("🔗 ")
  );
}

export function getLastAiTextMessage(history: Conversation[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (
      (item.sender === "ai" || item.sender === "agent") &&
      !isPropertyPayloadMessage(item.message)
    ) {
      return item.message.trim();
    }
  }
  return null;
}

export function getRecentAiTexts(history: Conversation[], limit = 8): string[] {
  return history
    .filter((item) => item.sender === "ai" || item.sender === "agent")
    .filter((item) => !isPropertyPayloadMessage(item.message))
    .slice(-limit)
    .map((item) => normalizeForDedupe(item.message));
}

export function wasRecentlyUsed(text: string, history: Conversation[]): boolean {
  const normalized = normalizeForDedupe(text);
  return getRecentAiTexts(history).includes(normalized);
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeForDedupe(text)
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

/** Jaccard similarity between two strings (0–1). */
export function replySimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 && tokensB.size === 0) {
    return 1;
  }
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const NEAR_DUPLICATE_THRESHOLD = 0.82;

export function isNearDuplicateReply(
  text: string,
  history: Conversation[],
  threshold = NEAR_DUPLICATE_THRESHOLD
): boolean {
  const last = getLastAiTextMessage(history);
  if (!last) {
    return false;
  }

  const normalized = normalizeForDedupe(text);
  const lastNormalized = normalizeForDedupe(last);

  if (normalized === lastNormalized) {
    return true;
  }

  return replySimilarity(text, last) >= threshold;
}

export function pickUnusedVariant(
  variants: string[],
  history: Conversation[],
  seed: string
): string {
  if (variants.length === 0) {
    return "";
  }

  const recent = new Set(getRecentAiTexts(history));
  const start = hashPick(seed, variants.length);

  for (let i = 0; i < variants.length; i += 1) {
    const candidate = variants[(start + i) % variants.length];
    const normalized = normalizeForDedupe(candidate);
    if (!recent.has(normalized) && !isNearDuplicateReply(candidate, history)) {
      return candidate;
    }
  }

  return variants[start];
}

export function dedupeAiReply(text: string, history: Conversation[]): string {
  const trimmed = text.trim();
  if (!trimmed || isNearDuplicateReply(trimmed, history)) {
    return "";
  }

  if (!wasRecentlyUsed(trimmed, history)) {
    return trimmed;
  }

  const alternatives = [
    trimmed.endsWith("👌") ? trimmed : `${trimmed} 👌`,
    trimmed.replace(/[.!?]+$/, ""),
  ].filter(
    (item) =>
      item && !wasRecentlyUsed(item, history) && !isNearDuplicateReply(item, history)
  );

  return alternatives[0] ?? "";
}
