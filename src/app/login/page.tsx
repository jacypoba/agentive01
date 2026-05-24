import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Agentive01",
  description: "Sign in to your Agentive01 dashboard.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your AI employees and WhatsApp automations."
    >
      <LoginForm />
    </AuthShell>
  );
}
