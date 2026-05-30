export type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

export type MetaWebhookEntry = {
  id?: string;
  changes?: MetaWebhookChange[];
};

export type MetaWebhookChange = {
  field?: string;
  value?: MetaWebhookValue;
};

export type MetaWebhookValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>;
  messages?: MetaInboundMessage[];
  statuses?: MetaMessageStatus[];
};

export type MetaInboundMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string };
  };
};

export type MetaMessageStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};
