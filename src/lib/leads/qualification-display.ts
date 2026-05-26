import type { IntentStatus, Lead } from "@/types/database";

export function getIntentStatusLabel(status: IntentStatus | null): string {
  switch (status) {
    case "browsing":
      return "A explorar";
    case "interested":
      return "Interessado";
    case "qualified":
      return "Qualificado";
    case "ready_to_visit":
      return "Pronto p/ visita";
    case "not_interested":
      return "Sem interesse";
    default:
      return "Desconhecido";
  }
}

export function getIntentStatusColor(status: IntentStatus | null): string {
  switch (status) {
    case "interested":
      return "border-[#0066FF]/30 bg-[#0066FF]/10 text-[#0066FF]";
    case "qualified":
      return "border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#00D4FF]";
    case "ready_to_visit":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "not_interested":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "browsing":
      return "border-white/15 bg-white/5 text-white/50";
    default:
      return "border-white/10 bg-white/5 text-white/40";
  }
}

export function hasQualificationData(lead: Lead): boolean {
  return Boolean(
    lead.budget ||
      lead.preferred_area ||
      lead.property_type ||
      lead.timeline ||
      lead.visit_requested ||
      (lead.intent_status && lead.intent_status !== "unknown")
  );
}

export type QualificationItem = {
  label: string;
  value: string;
};

export function getQualificationItems(lead: Lead): QualificationItem[] {
  const items: QualificationItem[] = [];

  if (lead.property_type) {
    items.push({ label: "Tipo", value: lead.property_type });
  }
  if (lead.preferred_area) {
    items.push({ label: "Zona", value: lead.preferred_area });
  }
  if (lead.budget) {
    items.push({ label: "Orçamento", value: lead.budget });
  }
  if (lead.timeline) {
    items.push({ label: "Prazo", value: lead.timeline });
  }
  if (lead.visit_requested && lead.visit_datetime_text) {
    items.push({ label: "Visita", value: lead.visit_datetime_text });
  } else if (lead.visit_requested) {
    items.push({ label: "Visita", value: "Solicitada" });
  }

  return items;
}
