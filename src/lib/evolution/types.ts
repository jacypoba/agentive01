export type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  apikey?: string;
  data?: EvolutionMessageData;
};

export type EvolutionMessageData = {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean | string | number;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
  };
  messageType?: string;
  messageTimestamp?: number;
};

export type ParsedIncomingMessage = {
  instance: string;
  remoteJid: string;
  phoneDigits: string;
  pushName: string;
  text: string;
  messageId: string;
};
