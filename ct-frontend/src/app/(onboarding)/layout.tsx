import { DemoAuthGuard } from "@/components/auth/demo-auth-guard";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoAuthGuard>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:px-6">
        {children}
      </div>
    </DemoAuthGuard>
  );
}
