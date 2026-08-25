import { BrandLink } from "@/components/layout/brand-link";

export function AuthBrandHeader() {
  return (
    <div className="mb-8 flex flex-col items-center gap-2 text-center">
      <BrandLink href="/" className="justify-center [&_img]:h-9 [&_img]:max-w-[12rem]" />
      <p className="text-sm text-muted-foreground">
        Pencatatan keuangan via WhatsApp
      </p>
    </div>
  );
}
