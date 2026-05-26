import { AppShell } from "@/components/layout/app-shell";

export default function VisitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
