import { AppShell } from "@/components/layout/app-shell";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
