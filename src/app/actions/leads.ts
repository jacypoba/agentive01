"use server";

import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/data/leads";
import {
  buildClearMemorySuccessMessage,
  clearLeadMemory,
} from "@/lib/leads/clear-memory";
import { createClient } from "@/lib/supabase/server";

export type CreateTestLeadState = {
  error?: string;
  success?: string;
};

export type ClearLeadMemoryState = {
  error?: string;
  success?: string;
};

export async function clearLeadMemoryAction(
  leadId: string,
  resetQualificationFields = false
): Promise<ClearLeadMemoryState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  try {
    const result = await clearLeadMemory(supabase, user.id, leadId, {
      resetQualificationFields,
    });

    revalidatePath("/dashboard");
    revalidatePath("/follow-ups");
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);

    return { success: buildClearMemorySuccessMessage(result) };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to clear lead memory.",
    };
  }
}

const TEST_LEAD = {
  client_name: "Marco Rossi",
  phone: "+39 333 123 4567",
  interest: "3-bedroom apartment in Florence",
  status: "new" as const,
};

export async function createTestLead(): Promise<CreateTestLeadState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a lead." };
  }

  try {
    await createLead(supabase, {
      user_id: user.id,
      ...TEST_LEAD,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create test lead.",
    };
  }

  revalidatePath("/dashboard");
  return { success: "Test lead created for Marco Rossi." };
}
