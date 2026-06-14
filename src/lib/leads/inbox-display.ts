import type { ConversationSender, LeadForInbox } from "@/types/database";

export function formatInboxSenderLabel(
  sender: ConversationSender | null
): string | null {
  if (!sender) {
    return null;
  }

  switch (sender) {
    case "client":
      return "Client";
    case "ai":
      return "AI";
    case "agent":
      return "You";
    default:
      return null;
  }
}

export function formatInboxMessagePreview(text: string | null): string {
  const trimmed = text?.trim();
  return trimmed ? trimmed : "No messages yet";
}

export function shouldShowUnreadBadge(unreadCount: number): boolean {
  return unreadCount > 0;
}

export function formatUnreadBadgeCount(unreadCount: number): string {
  if (unreadCount <= 0) {
    return "";
  }

  return unreadCount > 99 ? "99+" : String(unreadCount);
}

export function buildLeadInboxSearchHaystack(
  lead: Pick<
    LeadForInbox,
    | "client_name"
    | "phone"
    | "interest"
    | "status"
    | "last_message_text"
    | "budget"
    | "preferred_area"
    | "property_type"
    | "timeline"
    | "intent_status"
    | "visit_datetime_text"
  >,
  assigneeLabel: string
): string {
  return [
    lead.client_name,
    lead.phone ?? "",
    lead.interest ?? "",
    lead.status,
    lead.last_message_text ?? "",
    assigneeLabel,
    lead.budget ?? "",
    lead.preferred_area ?? "",
    lead.property_type ?? "",
    lead.timeline ?? "",
    lead.intent_status ?? "",
    lead.visit_datetime_text ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function leadMatchesInboxSearch(
  lead: Pick<
    LeadForInbox,
    | "client_name"
    | "phone"
    | "interest"
    | "status"
    | "last_message_text"
    | "budget"
    | "preferred_area"
    | "property_type"
    | "timeline"
    | "intent_status"
    | "visit_datetime_text"
  >,
  assigneeLabel: string,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return buildLeadInboxSearchHaystack(lead, assigneeLabel).includes(normalized);
}
