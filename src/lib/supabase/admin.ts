import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/url";
import type { Database } from "@/types/database";

/** Service-role client for server-side webhook operations (bypasses RLS). */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
