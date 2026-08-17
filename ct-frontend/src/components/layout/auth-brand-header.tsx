import { BrandLink } from "@/components/layout/brand-link";

export function AuthBrandHeader() {
  return (
    <div className="mb-8 flex flex-col items-center gap-2 text-center">
      <BrandLink
        href="/"
        iconClassName="size-10 rounded-xl [&_svg]:size-5"
        nameClassName="text-xl"
        className="flex-col gap-2"
      />
      <p className="text-sm text-muted-foreground">
        Pencatatan keuangan via WhatsApp
      </p>
    </div>
  );
}
