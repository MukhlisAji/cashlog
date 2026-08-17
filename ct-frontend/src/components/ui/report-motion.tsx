"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface ReportRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms */
  delay?: number;
}

/** Fade + slide up on mount (report page sections). */
export function ReportReveal({
  children,
  className,
  delay = 0,
}: ReportRevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ReportInteractiveCardProps {
  children: ReactNode;
  className?: string;
  /** Subtle scale on hover for metric tiles */
  lift?: boolean;
}

/** Card wrapper with hover feedback — lift, shadow, border glow. */
export function ReportInteractiveCard({
  children,
  className,
  lift = true,
}: ReportInteractiveCardProps) {
  return (
    <div
      className={cn(
        "rounded-[inherit] transition-[transform,box-shadow,border-color] duration-300 ease-out",
        lift && "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
        "hover:border-primary/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ReportHoverRowProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** List row with entrance + hover highlight. */
export function ReportHoverRow({ children, className, delay = 0 }: ReportHoverRowProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        "hover:bg-muted/40 hover:pl-1",
        visible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
