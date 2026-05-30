import {
  sendWhatsAppMediaSafe as sendEvolutionWhatsAppMediaSafe,
  sendWhatsAppTextSafe as sendEvolutionWhatsAppTextSafe,
  type SendWhatsAppOptions as EvolutionSendOptions,
} from "@/lib/evolution/client";
import {
  sendMetaWhatsAppMediaSafe,
  sendMetaWhatsAppTextSafe,
} from "@/lib/meta/client";
import {
  getWhatsAppProviderMode,
  isEvolutionFallbackEnabled,
  isEvolutionWhatsAppConfigured,
  isMetaWhatsAppConfigured,
  resolvePrimaryWhatsAppProvider,
} from "@/lib/whatsapp/config";
import type {
  SendWhatsAppOptions,
  WhatsAppMediaPayload,
  WhatsAppSendResult,
} from "@/lib/whatsapp/types";

export type { SendWhatsAppOptions, WhatsAppMediaPayload, WhatsAppSendResult };

function mergeResultWithFallback(
  primary: WhatsAppSendResult,
  fallback: WhatsAppSendResult
): WhatsAppSendResult {
  return {
    ...fallback,
    fallbackUsed: true,
    fallbackProvider: fallback.provider,
    warning:
      primary.error ??
      primary.warning ??
      "Primary Meta send failed; Evolution fallback was used.",
  };
}

function shouldUseEvolutionFallback(primary: WhatsAppSendResult): boolean {
  return !primary.sentToWhatsApp && !primary.success;
}

function mapEvolutionResult(
  result: Awaited<ReturnType<typeof sendEvolutionWhatsAppTextSafe>>
): WhatsAppSendResult {
  return {
    ...result,
    provider: "evolution",
    providerMessageId: result.evolutionMessageId,
  };
}

export function isWhatsAppConfigured(): boolean {
  return isMetaWhatsAppConfigured() || isEvolutionWhatsAppConfigured();
}

export function getWhatsAppProviderSummary() {
  return {
    mode: getWhatsAppProviderMode(),
    primary: isMetaWhatsAppConfigured()
      ? "meta"
      : isEvolutionWhatsAppConfigured()
        ? "evolution"
        : null,
    metaConfigured: isMetaWhatsAppConfigured(),
    evolutionConfigured: isEvolutionWhatsAppConfigured(),
    evolutionFallbackEnabled: isEvolutionFallbackEnabled(),
  };
}

export async function sendWhatsAppTextSafe(
  phoneDigits: string,
  text: string,
  options?: string | SendWhatsAppOptions
): Promise<WhatsAppSendResult> {
  const resolvedOptions: SendWhatsAppOptions =
    typeof options === "string" ? { instance: options } : (options ?? {});

  let primaryProvider: "meta" | "evolution";
  try {
    primaryProvider = resolvePrimaryWhatsAppProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp not configured.";
    return { success: false, error: message };
  }

  if (primaryProvider === "meta") {
    const metaResult = await sendMetaWhatsAppTextSafe(phoneDigits, text);

    if (
      !resolvedOptions.metaOnly &&
      isEvolutionFallbackEnabled() &&
      shouldUseEvolutionFallback(metaResult)
    ) {
      console.warn("[WHATSAPP PROVIDER FALLBACK]", {
        from: "meta",
        to: "evolution",
        reason: metaResult.error ?? metaResult.warning ?? "Meta send not delivered",
      });

      const evolutionOptions: EvolutionSendOptions = {
        instance: resolvedOptions.instance,
        remoteJid: resolvedOptions.remoteJid,
        disableFallback: true,
      };
      const fallbackResult = mapEvolutionResult(
        await sendEvolutionWhatsAppTextSafe(phoneDigits, text, evolutionOptions)
      );
      return mergeResultWithFallback(metaResult, fallbackResult);
    }

    return metaResult;
  }

  const evolutionOptions: EvolutionSendOptions = {
    instance: resolvedOptions.instance,
    remoteJid: resolvedOptions.remoteJid,
  };
  return mapEvolutionResult(
    await sendEvolutionWhatsAppTextSafe(phoneDigits, text, evolutionOptions)
  );
}

export async function sendWhatsAppText(
  phoneDigits: string,
  text: string,
  options?: string | SendWhatsAppOptions
): Promise<{ success: boolean; status?: number }> {
  const result = await sendWhatsAppTextSafe(phoneDigits, text, options);
  if (!result.success || !result.sentToWhatsApp) {
    throw new Error(
      result.error ??
        result.warning ??
        "WhatsApp text send failed on all configured providers."
    );
  }
  return { success: true, status: result.status };
}

export async function sendWhatsAppMediaSafe(
  phoneDigits: string,
  payload: WhatsAppMediaPayload,
  options?: string | SendWhatsAppOptions
): Promise<WhatsAppSendResult> {
  const resolvedOptions: SendWhatsAppOptions =
    typeof options === "string" ? { instance: options } : (options ?? {});

  let primaryProvider: "meta" | "evolution";
  try {
    primaryProvider = resolvePrimaryWhatsAppProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp not configured.";
    return { success: false, error: message };
  }

  if (primaryProvider === "meta") {
    const metaResult = await sendMetaWhatsAppMediaSafe(phoneDigits, payload);

    if (
      !resolvedOptions.metaOnly &&
      isEvolutionFallbackEnabled() &&
      shouldUseEvolutionFallback(metaResult)
    ) {
      console.warn("[WHATSAPP PROVIDER FALLBACK]", {
        from: "meta",
        to: "evolution",
        kind: payload.mediatype,
        reason: metaResult.error ?? metaResult.warning ?? "Meta media send not delivered",
      });

      const evolutionOptions: EvolutionSendOptions = {
        instance: resolvedOptions.instance,
        remoteJid: resolvedOptions.remoteJid,
        disableFallback: true,
      };
      const fallbackResult = mapEvolutionResult(
        await sendEvolutionWhatsAppMediaSafe(phoneDigits, payload, evolutionOptions)
      );
      return mergeResultWithFallback(metaResult, fallbackResult);
    }

    return metaResult;
  }

  const evolutionOptions: EvolutionSendOptions = {
    instance: resolvedOptions.instance,
    remoteJid: resolvedOptions.remoteJid,
  };
  return mapEvolutionResult(
    await sendEvolutionWhatsAppMediaSafe(phoneDigits, payload, evolutionOptions)
  );
}

export async function sendWhatsAppMedia(
  phoneDigits: string,
  payload: WhatsAppMediaPayload,
  options?: string | SendWhatsAppOptions
): Promise<{ success: boolean; status?: number }> {
  const result = await sendWhatsAppMediaSafe(phoneDigits, payload, options);
  if (!result.success || !result.sentToWhatsApp) {
    throw new Error(
      result.error ??
        result.warning ??
        "WhatsApp media send failed on all configured providers."
    );
  }
  return { success: true, status: result.status };
}
