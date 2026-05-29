export type ParsedEvolutionSendResponse = {
  messageId: string | null;
  deliveryKey: string | null;
  deliveryStatus: string | null;
  rawStatus: unknown;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readKeyRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Map Baileys numeric ACK codes and Evolution string statuses to readable labels. */
export function mapEvolutionDeliveryStatus(status: unknown): string | null {
  if (typeof status === "string") {
    const normalized = status.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof status === "number" && Number.isFinite(status)) {
    const numericMap: Record<number, string> = {
      0: "ERROR",
      1: "PENDING",
      2: "SERVER_ACK",
      3: "DELIVERED",
      4: "READ",
      5: "PLAYED",
    };
    return numericMap[status] ?? `STATUS_${status}`;
  }

  return null;
}

/** Extract message id / delivery key / status from Evolution send or update payloads. */
export function parseEvolutionSendResponse(body: string): ParsedEvolutionSendResponse {
  if (!body.trim()) {
    return {
      messageId: null,
      deliveryKey: null,
      deliveryStatus: null,
      rawStatus: null,
    };
  }

  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const rootKey = readKeyRecord(json.key);
    const nestedMessage = readKeyRecord(json.message);
    const nestedKey = nestedMessage ? readKeyRecord(nestedMessage.key) : null;
    const key = rootKey ?? nestedKey;

    const messageId =
      readString(key?.id) ??
      readString(json.messageId) ??
      readString(json.id) ??
      readString(nestedMessage?.id);

    const deliveryKey =
      readString(key?.remoteJid) ??
      readString(json.remoteJid) ??
      readString(json.to) ??
      readString(json.number);

    const rawStatus =
      json.status ??
      json.messageStatus ??
      json.ack ??
      (json.update && typeof json.update === "object"
        ? (json.update as Record<string, unknown>).status
        : null);

    return {
      messageId,
      deliveryKey,
      deliveryStatus: mapEvolutionDeliveryStatus(rawStatus),
      rawStatus,
    };
  } catch {
    return {
      messageId: null,
      deliveryKey: null,
      deliveryStatus: null,
      rawStatus: null,
    };
  }
}
