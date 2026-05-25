export type SendTextResult = {
  success: boolean;
  status?: number;
};

export async function sendWhatsAppText(
  phoneDigits: string,
  text: string,
  instance?: string
): Promise<SendTextResult> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName =
    instance ?? process.env.EVOLUTION_INSTANCE_NAME ?? "";

  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error(
      "Evolution API is not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME."
    );
  }

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
