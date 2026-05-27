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

export type IntentStatus =
  | "unknown"
  | "browsing"
  | "interested"
  | "qualified"
  | "ready_to_visit"
  | "not_interested";

export type Lead = {
  id: string;
  user_id: string;
  client_name: string;
  phone: string | null;
  phone_normalized: string | null;
  interest: string | null;
  status: LeadStatus;
  budget: string | null;
  preferred_area: string | null;
  property_type: string | null;
  timeline: string | null;
  intent_status: IntentStatus | null;
  visit_requested: boolean;
  visit_datetime_text: string | null;
  created_at: string;
};

export type LeadQualificationFields = {
  budget?: string | null;
  preferred_area?: string | null;
  property_type?: string | null;
  timeline?: string | null;
  intent_status?: IntentStatus | null;
  visit_requested?: boolean;
  visit_datetime_text?: string | null;
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
  budget?: string | null;
  preferred_area?: string | null;
  property_type?: string | null;
  timeline?: string | null;
  intent_status?: IntentStatus | null;
  visit_requested?: boolean;
  visit_datetime_text?: string | null;
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

export type VisitRequestStatus = "pending" | "confirmed" | "cancelled";

export type VisitRequest = {
  id: string;
  lead_id: string;
  user_id: string;
  requested_datetime_text: string | null;
  status: VisitRequestStatus;
  notes: string | null;
  created_at: string;
};

export type VisitRequestInsert = {
  id?: string;
  lead_id: string;
  user_id: string;
  requested_datetime_text?: string | null;
  status?: VisitRequestStatus;
  notes?: string | null;
  created_at?: string;
};

export type VisitRequestUpdate = {
  requested_datetime_text?: string | null;
  status?: VisitRequestStatus;
  notes?: string | null;
};

export type VisitRequestWithLead = VisitRequest & {
  leads: Pick<
    Lead,
    | "id"
    | "client_name"
    | "phone"
    | "preferred_area"
    | "property_type"
    | "budget"
    | "status"
  >;
};

export type Property = {
  id: string;
  user_id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  property_type: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  image_url: string | null;
  listing_url: string | null;
  created_at: string;
};

export type PropertyInsert = {
  id?: string;
  user_id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
  property_type: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  image_url?: string | null;
  listing_url?: string | null;
  created_at?: string;
};

export type PropertyUpdate = {
  title?: string;
  city?: string;
  neighborhood?: string | null;
  property_type?: string;
  price?: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  image_url?: string | null;
  listing_url?: string | null;
};

export type PropertySearchCriteria = {
  city: string;
  propertyType: string;
  maxBudget?: number | null;
};

export type DashboardStats = {
  totalLeads: number;
  qualifiedLeads: number;
  scheduledLeads: number;
  recentConversations: number;
  pendingVisitRequests: number;
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
      visit_requests: {
        Row: VisitRequest;
        Insert: VisitRequestInsert;
        Update: VisitRequestUpdate;
        Relationships: [];
      };
      properties: {
        Row: Property;
        Insert: PropertyInsert;
        Update: PropertyUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
