import { DemoAuthGuard } from "@/components/auth/demo-auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoAuthGuard>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </DemoAuthGuard>
  );
}
