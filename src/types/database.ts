export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "scheduled"
  | "closed"
  | "lost";

export type ConversationSender = "client" | "ai" | "agent";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  user_id: string;
  client_name: string;
  phone: string | null;
  phone_normalized: string | null;
  interest: string | null;
  status: LeadStatus;
  created_at: string;
};

export type Conversation = {
  id: string;
  lead_id: string;
  message: string;
  sender: ConversationSender;
  created_at: string;
};

export type ProfileInsert = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  created_at?: string;
};

export type ProfileUpdate = {
  full_name?: string | null;
  email?: string | null;
};

export type LeadInsert = {
  id?: string;
  user_id: string;
  client_name: string;
  phone?: string | null;
  phone_normalized?: string | null;
  interest?: string | null;
  status?: LeadStatus;
  created_at?: string;
};

export type LeadUpdate = {
  client_name?: string;
  phone?: string | null;
  interest?: string | null;
  status?: LeadStatus;
};

export type ConversationInsert = {
  id?: string;
  lead_id: string;
  message: string;
  sender: ConversationSender;
  created_at?: string;
};

export type ConversationWithLead = Conversation & {
  leads: Pick<Lead, "id" | "client_name" | "interest" | "status" | "user_id">;
};

export type ProcessedWhatsAppMessage = {
  id: string;
  message_id: string;
  instance: string;
  remote_jid: string | null;
  created_at: string;
};

export type ProcessedWhatsAppMessageInsert = {
  id?: string;
  message_id: string;
  instance: string;
  remote_jid?: string | null;
  created_at?: string;
};

export type DashboardStats = {
  totalLeads: number;
  qualifiedLeads: number;
  scheduledLeads: number;
  recentConversations: number;
};

export type RecentActivity = {
  id: string;
  lead_id: string;
  message: string;
  sender: ConversationSender;
  created_at: string;
  client_name: string;
  interest: string | null;
  status: LeadStatus;
  kind: "lead" | "conversation";
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: ConversationInsert;
        Update: Partial<ConversationInsert>;
        Relationships: [];
      };
      processed_whatsapp_messages: {
        Row: ProcessedWhatsAppMessage;
        Insert: ProcessedWhatsAppMessageInsert;
        Update: Partial<ProcessedWhatsAppMessageInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
