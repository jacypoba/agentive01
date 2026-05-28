import type { Conversation } from "@/types/database";

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

export function normalizeForDedupe(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPropertyPayloadMessage(message: string): boolean {
  return (
    message.startsWith("🏡") ||
    message.includes("[property:") ||
    message.startsWith("🔗 Ver detalhes")
  );
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
    if (!recent.has(normalizeForDedupe(candidate))) {
      return candidate;
    }
  }

  return variants[start];
}

export function dedupeAiReply(text: string, history: Conversation[]): string {
  const trimmed = text.trim();
  if (!trimmed || !wasRecentlyUsed(trimmed, history)) {
    return trimmed;
  }

  const alternatives = [
    trimmed.endsWith("👌") ? trimmed : `${trimmed} 👌`,
    trimmed.replace(/[.!?]+$/, ""),
    `${trimmed.replace(/[.!?]+$/, "")} —`,
  ].filter((item) => item && !wasRecentlyUsed(item, history));

  return alternatives[0] ?? trimmed;
}

export const EXHAUSTED_MATCH_LINES = [
  "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso.",
  "Neste perfil já partilhei o que tenho de melhor — aviso se surgir novidade.",
  "Foi isto que encontrei para o que pediu. Se aparecer algo novo, digo-lhe.",
];
