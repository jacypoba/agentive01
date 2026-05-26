import type { VisitRequestStatus } from "@/types/database";

export function getVisitStatusColor(status: VisitRequestStatus): string {
  switch (status) {
    case "confirmed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "cancelled":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

export function getVisitStatusLabel(status: VisitRequestStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmada";
    case "cancelled":
      return "Cancelada";
    default:
      return "Pendente";
  }
}
