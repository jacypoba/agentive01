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
