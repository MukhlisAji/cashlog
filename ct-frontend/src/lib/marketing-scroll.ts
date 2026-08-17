import { ROUTES } from "@/lib/constants";

export const MARKETING_SECTION_IDS = [
  "fitur",
  "cara-kerja",
  "harga",
  "faq",
] as const;

export type MarketingSectionId = (typeof MARKETING_SECTION_IDS)[number];

/** Align section top border flush under the sticky navbar (no extra gap). */
const SCROLL_GAP_PX = 0;

export function isMarketingLandingPage(pathname: string): boolean {
  return (
    pathname === ROUTES.home ||
    pathname === ROUTES.privacy ||
    pathname === ROUTES.terms
  );
}

export function marketingSectionHref(id: string): string {
  return `/#${id}`;
}

export function getMarketingScrollOffsetPx(): number {
  if (typeof document === "undefined") return 57;

  const header = document.querySelector("header");
  const headerHeight = header?.getBoundingClientRect().height ?? 57;
  return headerHeight + SCROLL_GAP_PX;
}

export function scrollToMarketingSection(
  id: string,
  options?: { behavior?: ScrollBehavior },
) {
  const el = document.getElementById(id);
  if (!el) return;

  const offset = getMarketingScrollOffsetPx();
  const top = el.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top: Math.max(0, top),
    behavior:
      options?.behavior ??
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth"),
  });

  const hash = `#${id}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

/** Scroll after layout is stable — for hash on first paint or cross-page navigation. */
export function scrollToMarketingSectionWhenReady(id: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToMarketingSection(id);
    });
  });
}

export function getActiveMarketingSection(sectionIds: readonly string[]): string {
  const threshold = getMarketingScrollOffsetPx() + 4;
  let current = sectionIds[0] ?? "";

  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= threshold) {
      current = id;
    }
  }

  return current;
}

/** Scroll on home; navigate to /#section from other marketing pages */
export function goToMarketingSection(id: string, pathname: string) {
  if (pathname === ROUTES.home) {
    scrollToMarketingSection(id);
    return;
  }

  window.location.href = marketingSectionHref(id);
}

export function isMarketingSectionId(id: string): id is MarketingSectionId {
  return (MARKETING_SECTION_IDS as readonly string[]).includes(id);
}
