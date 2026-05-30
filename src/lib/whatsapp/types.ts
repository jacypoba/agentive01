export type WhatsAppProviderId = "meta" | "evolution";

export type ParsedIncomingMessage = {
  provider: WhatsAppProviderId;
  /** Meta phone_number_id or Evolution instance name. */
  instance: string;
  remoteJid: string;
  phoneDigits: string;
  pushName: string;
  text: string;
  messageId: string;
};

export type WhatsAppSendResult = {
  success: boolean;
  status?: number;
  endpoint?: string;
  responseBody?: string;
  error?: string;
  destinationNumber?: string;
  provider?: WhatsAppProviderId;
  providerMessageId?: string;
  deliveryKey?: string;
  deliveryStatus?: string;
  accepted?: boolean;
  pendingOnly?: boolean;
  deliveryConfirmed?: boolean;
  sentToWhatsApp?: boolean;
  warning?: string | null;
  fallbackUsed?: boolean;
  fallbackProvider?: WhatsAppProviderId;
};

export type WhatsAppMediaPayload = {
  mediatype: "image" | "video" | "document";
  media: string;
  caption?: string;
  mimetype?: string;
  fileName?: string;
};

export type SendWhatsAppOptions = {
  instance?: string;
  remoteJid?: string | null;
  /** Skip Evolution fallback even when enabled. */
  metaOnly?: boolean;
};
