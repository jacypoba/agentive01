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

  if (jid) {
    variants.push({
      format: "jid",
      description: "Evolution recommended: full remoteJid in number field",
      payload: { number: jid, text: input.text },
    });
  }

  if (digits) {
    variants.push({
      format: "digits",
      description: "Digits-only number field (legacy/simple)",
      payload: { number: digits, text: input.text },
    });
  }

  if (digits) {
    variants.push({
      format: "textMessage",
      description: "Foundation/OpenAPI nested textMessage wrapper with digits",
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

  // auto: prefer JID when we know the inbound chat JID (Evolution issue #1247 pattern).
  return remoteJid?.includes("@") ? "jid" : "digits";
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
