export type SendTextResult = {
  success: boolean;
  status?: number;
};

export type SendMediaPayload = {
  mediatype: "image" | "video" | "document";
  media: string;
  caption?: string;
  mimetype?: string;
  fileName?: string;
};

function getEvolutionConfig(instance?: string) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName =
    instance ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";

  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error(
      "Evolution API is not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME."
    );
  }

  return { baseUrl, apiKey, instanceName };
}

export async function sendWhatsAppText(
  phoneDigits: string,
  text: string,
  instance?: string
): Promise<SendTextResult> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(instance);

  const response = await fetch(
    `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: phoneDigits,
        text,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Evolution API send failed (${response.status}): ${body}`
    );
  }

  return { success: true, status: response.status };
}

export async function sendWhatsAppMedia(
  phoneDigits: string,
  payload: SendMediaPayload,
  instance?: string
): Promise<SendTextResult> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(instance);
  const endpoint = `${baseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
  const requestBody = {
    number: phoneDigits,
    mediatype: payload.mediatype,
    mimetype: payload.mimetype,
    caption: payload.caption,
    media: payload.media,
    fileName: payload.fileName,
  };

  console.log("[EVOLUTION MEDIA REQUEST] endpoint:", endpoint);
  console.log("[EVOLUTION MEDIA REQUEST] payload:", requestBody);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const rawData = await response.text();
      let responseData: unknown = rawData;

      try {
        responseData = JSON.parse(rawData);
      } catch {
        // Keep raw text when the body is not JSON.
      }

      console.error("[EVOLUTION MEDIA ERROR] response.status:", response.status);
      console.error("[EVOLUTION MEDIA ERROR] response.data:", responseData);
      console.error("[EVOLUTION MEDIA ERROR] endpoint URL:", endpoint);
      console.error("[EVOLUTION MEDIA ERROR] payload:", requestBody);

      throw new Error(
        `Evolution API media send failed (${response.status}): ${rawData}`
      );
    }

    return { success: true, status: response.status };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Evolution API media send failed")
    ) {
      throw error;
    }

    console.error("[EVOLUTION MEDIA ERROR] response.status:", "fetch_failed");
    console.error("[EVOLUTION MEDIA ERROR] response.data:", error);
    console.error("[EVOLUTION MEDIA ERROR] endpoint URL:", endpoint);
    console.error("[EVOLUTION MEDIA ERROR] payload:", requestBody);

    throw error;
  }
}
