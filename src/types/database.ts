export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "scheduled"
  | "closed"
  | "lost";

export type ConversationSender = "client" | "ai" | "agent";

export type FollowUpType =
  | "property_recommended"
  | "silent_lead"
  | "visit_pending"
  | "visit_completed"
  | "new_match";

export type FollowUpStatus = "pending" | "sent" | "failed" | "cancelled";

export type FollowUpContextSnapshot = {
  city?: string | null;
  budget?: string | null;
  property_type?: string | null;
  lead_status?: string | null;
  intent_status?: string | null;
  shown_property_titles?: string[];
  visit_status?: string | null;
  property_title?: string | null;
  new_property_title?: string | null;
  client_name?: string | null;
  preferred_language?: string | null;
};

export type FollowUp = {
  id: string;
  lead_id: string;
  user_id: string;
  workspace_id: string | null;
  type: FollowUpType;
  status: FollowUpStatus;
  scheduled_for: string;
  sent_at: string | null;
  message: string | null;
  context_snapshot: FollowUpContextSnapshot | null;
  created_at: string;
};

export type FollowUpInsert = {
  id?: string;
  lead_id: string;
  user_id: string;
  workspace_id?: string | null;
  type: FollowUpType;
  status?: FollowUpStatus;
  scheduled_for: string;
  sent_at?: string | null;
  message?: string | null;
  context_snapshot?: FollowUpContextSnapshot | null;
  created_at?: string;
};

export type FollowUpWithLead = FollowUp & {
  leads: Pick<
    Lead,
    | "id"
    | "client_name"
    | "phone"
    | "phone_normalized"
    | "status"
    | "intent_status"
    | "preferred_area"
    | "property_type"
    | "budget"
    | "user_id"
    | "preferred_language"
  >;
};

export type FollowUpBuckets = {
  pending: FollowUpWithLead[];
  sent: FollowUpWithLead[];
  failed: FollowUpWithLead[];
};

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  default_workspace_id: string | null;
  created_at: string;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires_at: string | null;
  google_calendar_id: string | null;
  google_calendar_connected_at: string | null;
  calendar_work_start: string | null;
  calendar_work_end: string | null;
  calendar_visit_duration_minutes: number | null;
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
  workspace_id: string | null;
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
  preferred_language: string | null;
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
  user_id?: string;
  full_name?: string | null;
  email?: string | null;
  default_workspace_id?: string | null;
  created_at?: string;
  google_refresh_token?: string | null;
  google_access_token?: string | null;
  google_token_expires_at?: string | null;
  google_calendar_id?: string | null;
  google_calendar_connected_at?: string | null;
  calendar_work_start?: string | null;
  calendar_work_end?: string | null;
  calendar_visit_duration_minutes?: number | null;
};

export type ProfileUpdate = {
  full_name?: string | null;
  email?: string | null;
  default_workspace_id?: string | null;
  google_refresh_token?: string | null;
  google_access_token?: string | null;
  google_token_expires_at?: string | null;
  google_calendar_id?: string | null;
  google_calendar_connected_at?: string | null;
  calendar_work_start?: string | null;
  calendar_work_end?: string | null;
  calendar_visit_duration_minutes?: number | null;
};

export type LeadInsert = {
  id?: string;
  user_id: string;
  workspace_id?: string | null;
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
  preferred_language?: string | null;
};

export type ConversationInsert = {
  id?: string;
  lead_id: string;
  message: string;
  sender: ConversationSender;
  created_at?: string;
};

export type ConversationWithLead = Conversation & {
  leads: Pick<
    Lead,
    "id" | "client_name" | "interest" | "status" | "user_id" | "preferred_language"
  >;
};

export type ProcessedWhatsAppMessage = {
  id: string;
  message_id: string;
  instance: string;
  remote_jid: string | null;
  workspace_id: string | null;
  created_at: string;
};

export type ProcessedWhatsAppMessageInsert = {
  id?: string;
  message_id: string;
  instance: string;
  remote_jid?: string | null;
  workspace_id?: string | null;
  created_at?: string;
};

export type WorkspaceRole = "owner" | "admin" | "member";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
};

export type WorkspaceInsert = {
  id?: string;
  name: string;
  slug: string;
  created_by: string;
  created_at?: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type WorkspaceMemberInsert = {
  id?: string;
  workspace_id: string;
  user_id: string;
  role?: WorkspaceRole;
  created_at?: string;
};

export type VisitRequestStatus = "pending" | "confirmed" | "cancelled";

export type VisitRequest = {
  id: string;
  lead_id: string;
  user_id: string;
  workspace_id: string | null;
  requested_datetime_text: string | null;
  status: VisitRequestStatus;
  notes: string | null;
  property_title: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
};

export type VisitRequestInsert = {
  id?: string;
  lead_id: string;
  user_id: string;
  workspace_id?: string | null;
  requested_datetime_text?: string | null;
  status?: VisitRequestStatus;
  notes?: string | null;
  property_title?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  google_calendar_event_id?: string | null;
  created_at?: string;
};

export type VisitRequestUpdate = {
  requested_datetime_text?: string | null;
  status?: VisitRequestStatus;
  notes?: string | null;
  property_title?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  google_calendar_event_id?: string | null;
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
  workspace_id: string | null;
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
  workspace_id?: string | null;
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

export type CalendarVisitBuckets = {
  today: VisitRequestWithLead[];
  upcoming: VisitRequestWithLead[];
  pending: VisitRequestWithLead[];
};

export type DashboardStats = {
  totalLeads: number;
  qualifiedLeads: number;
  scheduledLeads: number;
  recentConversations: number;
  pendingVisitRequests: number;
  pendingFollowUps: number;
  sentFollowUpsToday: number;
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
  preferred_language: string | null;
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
      follow_ups: {
        Row: FollowUp;
        Insert: FollowUpInsert;
        Update: Partial<FollowUpInsert> & { status?: FollowUpStatus };
        Relationships: [];
      };
      workspaces: {
        Row: Workspace;
        Insert: WorkspaceInsert;
        Update: Partial<WorkspaceInsert>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: WorkspaceMemberInsert;
        Update: Partial<WorkspaceMemberInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
