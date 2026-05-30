import type { Metadata } from "next";
import { PropertiesAdmin } from "@/components/properties/properties-admin";
import { getProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { resolveTenantScope } from "@/lib/workspaces/workspace-access";

export const metadata: Metadata = {
  title: "Properties — Agentive01",
  description: "Manage property listings for AI recommendations.",
};

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let properties = null;
  let dbError: string | null = null;

  if (user) {
    try {
      const { workspaceId } = await resolveTenantScope(supabase, user.id);
      properties = await getProperties(supabase, workspaceId);
    } catch (error) {
      dbError =
        error instanceof Error ? error.message : "Could not load properties.";
    }
  }

  return (
    <main className="px-6 pb-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="animate-fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
            Inventory · Properties
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Property listings
          </h1>
          <p className="mt-3 max-w-xl text-white/50">
            Add real listings manually. When a WhatsApp lead shares city, budget,
            and property type, the AI suggests matching options from this list.
          </p>
        </section>

        <div className="mt-10">
          <PropertiesAdmin properties={properties ?? []} dbError={dbError} />
        </div>
      </div>
    </main>
  );
}
