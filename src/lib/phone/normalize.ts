/** Strip to digits only for phone matching. */
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/** Extract digits from Evolution remoteJid (e.g. 5516999999999@s.whatsapp.net). */
export function phoneFromRemoteJid(remoteJid: string): string {
  return normalizePhoneDigits(remoteJid.split("@")[0] ?? remoteJid);
}

/** Display format for stored phone numbers. */
export function formatPhoneDisplay(digits: string): string {
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/** Returns true for individual WhatsApp chats (not groups). */
export function isIndividualChat(remoteJid: string): boolean {
  return remoteJid.endsWith("@s.whatsapp.net");
}

export type WhatsAppPhoneContext = {
  remoteJid: string | null;
  inboundPhoneDigits: string | null;
  outboundPhoneDigits: string;
  outboundDestination: string;
  phonesMatch: boolean | null;
};

/** Compare inbound remoteJid digits with the outbound Evolution send number. */
export function describeWhatsAppPhoneRouting(input: {
  remoteJid?: string | null;
  inboundPhoneDigits?: string | null;
  outboundPhoneInput: string;
}): WhatsAppPhoneContext {
  const remoteJid = input.remoteJid?.trim() || null;
  const inboundPhoneDigits =
    input.inboundPhoneDigits?.trim() ||
    (remoteJid ? phoneFromRemoteJid(remoteJid) : null);
  const outboundPhoneDigits = normalizePhoneDigits(input.outboundPhoneInput);
  const outboundDestination = outboundPhoneDigits;

  const phonesMatch =
    inboundPhoneDigits && outboundPhoneDigits
      ? inboundPhoneDigits === outboundPhoneDigits
      : null;

  return {
    remoteJid,
    inboundPhoneDigits,
    outboundPhoneDigits,
    outboundDestination,
    phonesMatch,
  };
}

export function logWhatsAppPhoneRouting(
  label: string,
  context: WhatsAppPhoneContext
): void {
  console.log("[WHATSAPP PHONE]", {
    label,
    remoteJid: context.remoteJid,
    inboundPhoneDigits: context.inboundPhoneDigits,
    outboundPhoneDigits: context.outboundPhoneDigits,
    outboundDestination: context.outboundDestination,
    phonesMatch: context.phonesMatch,
  });
}
