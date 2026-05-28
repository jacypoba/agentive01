import type { FollowUpStatus, FollowUpType } from "@/types/database";

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  property_recommended: "Property recommended",
  silent_lead: "Silent lead",
  visit_pending: "Visit pending",
  visit_completed: "Visit completed",
  new_match: "New match",
};

export function getFollowUpTypeLabel(type: FollowUpType): string {
  return FOLLOW_UP_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

export function getFollowUpStatusColor(status: FollowUpStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "sent":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "cancelled":
      return "border-white/10 bg-white/5 text-white/40";
    default:
      return "border-white/10 bg-white/5 text-white/50";
  }
}

export function formatFollowUpDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
