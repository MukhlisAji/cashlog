import Link from "next/link";
import type { ComponentProps } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = ComponentProps<typeof Button> & {
  href: string;
};

/** Button styled link — sets nativeButton=false for Base UI + Next.js Link */
export function ButtonLink({ href, className, ...props }: ButtonLinkProps) {
  return (
    <Button
      nativeButton={false}
      className={className}
      render={<Link href={href} />}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> &
  Parameters<typeof buttonVariants>[0];

/** Link with button styles (alternative pattern) */
export function LinkButton({
  className,
  variant,
  size,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
