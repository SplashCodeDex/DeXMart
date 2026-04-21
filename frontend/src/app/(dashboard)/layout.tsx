import { DashboardShell } from "@/components/layouts/DashboardShell";
import { ClientGatewayProvider } from "@/components/providers/client-gateway-provider";
import { requireAuth } from "@/server/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireAuth();

  return (
    <ClientGatewayProvider>
      <DashboardShell>{children}</DashboardShell>
    </ClientGatewayProvider>
  );
}
