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
    console.error("[EVOLUTION MEDIA ERROR] response.status:", response.status);
    console.error("[EVOLUTION MEDIA ERROR] response.data:", rawData);
    console.error("[EVOLUTION MEDIA ERROR] endpoint URL:", endpoint);
    console.error("[EVOLUTION MEDIA ERROR] payload:", requestBody);
    throw new Error(
      `Evolution API media send failed (${response.status}): ${rawData}`
    );
  }

  return { success: true, status: response.status };
}
