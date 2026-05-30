import type { WhatsAppProviderId } from "@/lib/whatsapp/types";

export type WhatsAppProviderMode = "meta" | "evolution" | "auto";

export function getWhatsAppProviderMode(): WhatsAppProviderMode {
  const raw = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (raw === "meta" || raw === "evolution" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function isMetaWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

export function isEvolutionWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.EVOLUTION_API_URL?.trim() &&
      process.env.EVOLUTION_API_KEY?.trim() &&
      process.env.EVOLUTION_INSTANCE_NAME?.trim()
  );
}

export function isEvolutionFallbackEnabled(): boolean {
  const raw = process.env.WHATSAPP_FALLBACK_EVOLUTION?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") {
    return false;
  }
  return isEvolutionWhatsAppConfigured();
}

/** Primary outbound/inbound provider for production. */
export function resolvePrimaryWhatsAppProvider(): WhatsAppProviderId {
  const mode = getWhatsAppProviderMode();

  if (mode === "meta") {
    if (!isMetaWhatsAppConfigured()) {
      throw new Error(
        "WHATSAPP_PROVIDER=meta but Meta Cloud API env vars are missing."
      );
    }
    return "meta";
  }

  if (mode === "evolution") {
    if (!isEvolutionWhatsAppConfigured()) {
      throw new Error(
        "WHATSAPP_PROVIDER=evolution but Evolution env vars are missing."
      );
    }
    return "evolution";
  }

  if (isMetaWhatsAppConfigured()) {
    return "meta";
  }

  if (isEvolutionWhatsAppConfigured()) {
    return "evolution";
  }

  throw new Error(
    "No WhatsApp provider configured. Set Meta Cloud API or Evolution env vars."
  );
}

export function getMetaInstanceId(): string {
  return process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "meta-cloud";
}
