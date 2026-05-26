"use server";

import { revalidatePath } from "next/cache";
import { updateLeadStatus } from "@/lib/data/leads";
import { updateVisitRequestStatus } from "@/lib/data/visit-requests";
import { createClient } from "@/lib/supabase/server";
import type { VisitRequestStatus } from "@/types/database";

export type UpdateVisitStatusState = {
  error?: string;
  success?: boolean;
};

export async function updateVisitStatus(
  visitId: string,
  status: VisitRequestStatus
): Promise<UpdateVisitStatusState> {
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  try {
    const updated = await updateVisitRequestStatus(
      supabase,
      user.id,
      visitId,
      status
    );

    if (status === "confirmed") {
      await updateLeadStatus(supabase, user.id, updated.lead_id, "scheduled");
    }

    revalidatePath("/visits");
    revalidatePath("/dashboard");
    revalidatePath(`/leads/${updated.lead_id}`);

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update visit.",
    };
  }
}
