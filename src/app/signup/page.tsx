import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account — Agentive01",
  description: "Start your free trial and deploy AI employees for your agency.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Start your free trial"
      subtitle="Create your account and deploy AI employees in under 15 minutes."
    >
      <SignupForm />
    </AuthShell>
  );
}
