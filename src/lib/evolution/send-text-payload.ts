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

/** Build Evolution v2 sendText payload variants for diagnostics and fallback selection. */
export function buildSendTextPayloadVariants(input: {
  phoneDigits: string;
  text: string;
  remoteJid?: string | null;
}): SendTextPayloadVariant[] {
  const digits = normalizePhoneDigits(input.phoneDigits);
  const jid =
    input.remoteJid?.includes("@")
      ? input.remoteJid.trim()
      : digits
        ? `${digits}@s.whatsapp.net`
        : "";

  const variants: SendTextPayloadVariant[] = [];

  // Production order: digits first, then JID, then nested textMessage variants.
  if (digits) {
    variants.push({
      format: "digits",
      description: "Digits-only number field (Evolution v2 SendTextDto default)",
      payload: { number: digits, text: input.text },
    });
  }

  if (jid) {
    variants.push({
      format: "jid",
      description: "Full remoteJid in number field (Evolution reply pattern)",
      payload: { number: jid, text: input.text },
    });
  }

  if (digits) {
    variants.push({
      format: "textMessage",
      description: "Nested textMessage wrapper with digits",
      payload: {
        number: digits,
        textMessage: { text: input.text },
      },
    });
  }

  if (jid) {
    variants.push({
      format: "jid_textMessage",
      description: "Full JID with nested textMessage wrapper",
      payload: {
        number: jid,
        textMessage: { text: input.text },
      },
    });
  }

  return variants;
}

/** Ordered formats for production fallback when delivery stays PENDING. */
export function getProductionSendTextFormatOrder(
  _remoteJid?: string | null
): SendTextFormat[] {
  const envFormat = process.env.EVOLUTION_SEND_NUMBER_FORMAT?.trim().toLowerCase();

  if (envFormat === "digits") return ["digits"];
  if (envFormat === "jid") return ["jid"];
  if (envFormat === "textmessage") return ["textMessage"];
  if (envFormat === "jid_textmessage") return ["jid_textMessage"];

  return ["digits", "jid", "textMessage", "jid_textMessage"];
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

  // auto: digits first; production fallback tries jid next when PENDING persists.
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

  return match ?? variants[0] ?? {
    format: "digits",
    description: "Fallback digits payload",
    payload: {
      number: normalizePhoneDigits(input.phoneDigits),
      text: input.text,
    },
  };
}
