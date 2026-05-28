import { AppShell } from "@/components/layout/app-shell";

export default function FollowUpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
