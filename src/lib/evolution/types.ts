import type { ParsedIncomingMessage } from "@/lib/whatsapp/types";

export type { ParsedIncomingMessage };

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
