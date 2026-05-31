import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcceptInvitationPanel } from "@/components/auth/accept-invitation-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { getInvitationPreview } from "@/app/actions/team";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Accept invitation — Agentive01",
};

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);

  if (!preview) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectPath = `/invite/${encodeURIComponent(token)}`;

  return (
    <AuthShell
      title="Join workspace"
      subtitle="Accept your invitation to collaborate on Agentive01."
    >
      <AcceptInvitationPanel
        token={token}
        preview={preview}
        isAuthenticated={Boolean(user)}
        userEmail={user?.email ?? null}
        redirectPath={redirectPath}
      />
    </AuthShell>
  );
}
