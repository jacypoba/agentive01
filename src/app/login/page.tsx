import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign in — Agentive01",
  description: "Sign in to your Agentive01 dashboard.",
};

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(params.redirect);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your AI employees and WhatsApp automations."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
