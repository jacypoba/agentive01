import { normalizePhoneDigits } from "@/lib/phone/normalize";

export type SendTextFormat =
  | "digits"
  | "jid"
  | "textMessage"
  | "jid_textMessage";

export type SendTextPayloadVariant = {
  format: SendTextFormat;
  payload: Record<string, unknown>;
  description: string;
};

/** Evolution API SendTextDto (Metadata + text): { number, text } */
export function buildCanonicalEvolutionSendTextPayload(input: {
  number: string;
  text: string;
}): Record<string, unknown> {
  const number = input.number.trim();
  const text = input.text.trim();

  return {
    number,
    text,
  };
}

export function normalizeEvolutionSendTextPayload(
  payload: Record<string, unknown>,
  fallbackText: string
): Record<string, unknown> {
  const textFromRoot =
    typeof payload.text === "string" && payload.text.trim()
      ? payload.text.trim()
      : null;

  const nested = payload.textMessage;
  const textFromNested =
    nested &&
    typeof nested === "object" &&
    typeof (nested as { text?: unknown }).text === "string" &&
    (nested as { text: string }).text.trim()
      ? (nested as { text: string }).text.trim()
      : null;

  const text = textFromRoot ?? textFromNested ?? fallbackText.trim();
  const number =
    typeof payload.number === "string" && payload.number.trim()
      ? payload.number.trim()
      : "";

  return buildCanonicalEvolutionSendTextPayload({ number, text });
}

export function isEvolutionMissingTextError(responseBody: string | undefined): boolean {
  if (!responseBody) {
    return false;
  }

  const normalized = responseBody.toLowerCase();
  return (
    normalized.includes('requires property "text"') ||
    normalized.includes("requires property 'text'") ||
    (normalized.includes("text") && normalized.includes("required"))
  );
}

/** Build Evolution sendText payload variants for diagnostics. */
export function buildSendTextPayloadVariants(input: {
  phoneDigits: string;
  text: string;
  remoteJid?: string | null;
}): SendTextPayloadVariant[] {
  const messageText = input.text.trim();
  const digits = normalizePhoneDigits(input.phoneDigits);
  const jid =
    input.remoteJid?.includes("@")
      ? input.remoteJid.trim()
      : digits
        ? `${digits}@s.whatsapp.net`
        : "";

  const variants: SendTextPayloadVariant[] = [];

  if (digits) {
    variants.push({
      format: "digits",
      description: "Evolution SendTextDto: { number: E.164 digits, text }",
      payload: buildCanonicalEvolutionSendTextPayload({
        number: digits,
        text: messageText,
      }),
    });
  }

  if (jid) {
    variants.push({
      format: "jid",
      description: "Evolution SendTextDto with full remoteJid in number field",
      payload: buildCanonicalEvolutionSendTextPayload({
        number: jid,
        text: messageText,
      }),
    });
  }

  if (digits) {
    variants.push({
      format: "textMessage",
      description: "Legacy nested textMessage (includes root text for compatibility)",
      payload: {
        number: digits,
        text: messageText,
        textMessage: { text: messageText },
      },
    });
  }

  if (jid) {
    variants.push({
      format: "jid_textMessage",
      description: "Legacy JID + nested textMessage (includes root text)",
      payload: {
        number: jid,
        text: messageText,
        textMessage: { text: messageText },
      },
    });
  }

  return variants;
}

/** Production formats — only SendTextDto-compatible payloads with top-level text. */
export function getProductionSendTextFormatOrder(
  _remoteJid?: string | null
): SendTextFormat[] {
  const envFormat = process.env.EVOLUTION_SEND_NUMBER_FORMAT?.trim().toLowerCase();

  if (envFormat === "digits") return ["digits"];
  if (envFormat === "jid") return ["jid"];
  if (envFormat === "textmessage") return ["textMessage", "digits"];
  if (envFormat === "jid_textmessage") return ["jid_textMessage", "jid", "digits"];

  return ["digits", "jid"];
}

export function resolvePreferredSendTextFormat(
  remoteJid?: string | null
): SendTextFormat {
  const envFormat = process.env.EVOLUTION_SEND_NUMBER_FORMAT?.trim().toLowerCase();

  if (
    envFormat === "digits" ||
    envFormat === "jid" ||
    envFormat === "textmessage" ||
    envFormat === "jid_textmessage"
  ) {
    if (envFormat === "textmessage") return "textMessage";
    if (envFormat === "jid_textmessage") return "jid_textMessage";
    return envFormat;
  }

  if (remoteJid?.includes("@")) {
    return "jid";
  }

  return "digits";
}

export function selectSendTextPayloadVariant(input: {
  phoneDigits: string;
  text: string;
  remoteJid?: string | null;
  format?: SendTextFormat;
}): SendTextPayloadVariant {
  const variants = buildSendTextPayloadVariants(input);
  const preferred = input.format ?? resolvePreferredSendTextFormat(input.remoteJid);
  const match = variants.find((variant) => variant.format === preferred);

  const selected =
    match ??
    variants[0] ?? {
      format: "digits" as const,
      description: "Fallback digits payload",
      payload: buildCanonicalEvolutionSendTextPayload({
        number: normalizePhoneDigits(input.phoneDigits),
        text: input.text.trim(),
      }),
    };

  return {
    ...selected,
    payload: normalizeEvolutionSendTextPayload(selected.payload, input.text),
  };
}
