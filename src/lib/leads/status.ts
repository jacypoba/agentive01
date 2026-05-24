import type { LeadStatus } from "@/types/database";

export function getStatusBadgeColor(status: LeadStatus): string {
  switch (status) {
    case "qualified":
      return "border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#00D4FF]";
    case "scheduled":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "contacted":
      return "border-[#0066FF]/30 bg-[#0066FF]/10 text-[#0066FF]";
    case "closed":
      return "border-white/20 bg-white/5 text-white/60";
    case "lost":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    default:
      return "border-white/10 bg-white/5 text-white/50";
  }
}

export function formatLeadDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
