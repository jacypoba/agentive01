import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Create account — Agentive01",
  description: "Start your free trial and deploy AI employees for your agency.",
};

type SignupPageProps = {
  searchParams: Promise<{ redirect?: string; email?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(params.redirect);
  const defaultEmail = params.email?.trim() ?? "";

  return (
    <AuthShell
      title="Start your free trial"
      subtitle="Create your account and deploy AI employees in under 15 minutes."
    >
      <SignupForm redirectTo={redirectTo} defaultEmail={defaultEmail} />
    </AuthShell>
  );
}
