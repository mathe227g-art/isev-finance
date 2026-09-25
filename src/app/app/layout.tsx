import { AppShell } from "@/components/app-shell";
import { getProfileContext } from "@/services/financial-profiles";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getProfileContext();
  return <AppShell key={context.active?.id??'no-profile'} {...context}>{children}</AppShell>;
}
