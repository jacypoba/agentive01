/** Detect and repair truncated WhatsApp / AI text before sending. */

const INCOMPLETE_TAIL_WORDS =
  /\b(both|and|but|however|although|while|also|plus|or|nor|yet|so|because|since|though|whereas|por[eé]m|entretanto|mas|tamb[eé]m|ou|e|y|ma|per[oò]|anche|und|oder|denn|weil|sin|pero|adem[aá]s)\s*[\.\…]*$/i;

const TRAILING_CUT_ELLIPSIS = /(?:\.{2,}|…)\s*$/;

const ALL_CAPS_FRAGMENT = /^[A-Z0-9\s,'"()\-–—]+(?:\.{2,}|…)\s*$/;

export function isIncompleteResponse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (INCOMPLETE_TAIL_WORDS.test(trimmed)) {
    return true;
  }

  if (TRAILING_CUT_ELLIPSIS.test(trimmed)) {
    const withoutEllipsis = trimmed.replace(/(?:\.{2,}|…)+$/g, "").trim();
    const lastWord = withoutEllipsis.split(/\s+/).pop() ?? "";
    if (
      INCOMPLETE_TAIL_WORDS.test(`${lastWord}...`) ||
      lastWord.length <= 4 ||
      ALL_CAPS_FRAGMENT.test(trimmed)
    ) {
      return true;
    }
  }

  if (ALL_CAPS_FRAGMENT.test(trimmed)) {
    return true;
  }

  const withoutEmoji = trimmed
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}👌🙂😊]+$/gu, "")
    .trim();

  if (withoutEmoji.length >= 48 && !/[.!?]$/.test(withoutEmoji)) {
    const wordCount = withoutEmoji.split(/\s+/).length;
    if (wordCount >= 8) {
      return true;
    }
  }

  return false;
}

export function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/[.!?…]$/.test(trimmed) || /[\p{Emoji_Presentation}\p{Extended_Pictographic}👌🙂]$/u.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

export function truncateAtSentenceBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return ensureTerminalPunctuation(trimmed);
  }

  let chunk = trimmed.slice(0, maxLength);
  const sentenceEnd = Math.max(
    chunk.lastIndexOf("."),
    chunk.lastIndexOf("!"),
    chunk.lastIndexOf("?")
  );

  if (sentenceEnd >= Math.floor(maxLength * 0.45)) {
    return chunk.slice(0, sentenceEnd + 1).trim();
  }

  const lastSpace = chunk.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxLength * 0.55)) {
    return ensureTerminalPunctuation(chunk.slice(0, lastSpace).trim());
  }

  return ensureTerminalPunctuation(chunk.trim());
}

export function finalizeWhatsAppLines(
  text: string,
  options: { maxLines?: number; maxLineLength?: number } = {}
): string | null {
  const maxLines = options.maxLines ?? 2;
  const maxLineLength = options.maxLineLength ?? 100;

  const cleaned = text
    .replace(/^[•·]\s*/gm, "")
    .replace(/\n{3,}/g, "\n")
    .trim();

  if (!cleaned || isIncompleteResponse(cleaned)) {
    return null;
  }

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => truncateAtSentenceBoundary(line, maxLineLength))
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  const joined = lines.join("\n");
  return isIncompleteResponse(joined) ? null : joined;
}

export function finalizeWhatsAppText(text: string): string | null {
  const singleLine = text.replace(/\s*\n+\s*/g, " ").trim();
  if (!singleLine) {
    return null;
  }

  const finalized = finalizeWhatsAppLines(singleLine, {
    maxLines: 1,
    maxLineLength: 220,
  });

  if (finalized) {
    return finalized;
  }

  const bounded = truncateAtSentenceBoundary(singleLine, 220);
  return isIncompleteResponse(bounded) ? null : bounded;
}

export function wasCutByTokenLimit(
  finishReason: string | null | undefined
): boolean {
  return finishReason === "length";
}
