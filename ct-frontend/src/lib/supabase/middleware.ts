import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE, isDemoMode } from "@/lib/demo";
import { checkSubscriptionFromProfile } from "@/lib/subscription";

function isProtectedPath(pathname: string): boolean {
  const protectedPaths = ["/ringkasan", "/dashboard", "/settings"];
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isPaymentReturnPath(pathname: string): boolean {
  return pathname === "/payment/return";
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isDemoMode()) {
    const demoSession =
      request.cookies.get(DEMO_SESSION_COOKIE)?.value === "1";
    const isProtected = isProtectedPath(pathname);
    const isAuth = isAuthPath(pathname);

    if (isProtected && !demoSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    if ((isAuth || pathname === "/") && demoSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/ringkasan";
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = isProtectedPath(pathname);
  const isAuth = isAuthPath(pathname);
  const isSubscriptionExpiredPage = pathname === "/subscription-expired";
  const isPaymentReturn = isPaymentReturnPath(pathname);

  if (isPaymentReturn && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isSubscriptionExpiredPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPaymentReturn) {
    return supabaseResponse;
  }

  if (user && (isProtected || isSubscriptionExpiredPage || pathname === "/")) {
    const sub = await checkSubscriptionFromProfile(supabase, user.id);

    if (!sub.allowed && !isSubscriptionExpiredPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/subscription-expired";
      return NextResponse.redirect(url);
    }

    if (sub.allowed && isSubscriptionExpiredPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/ringkasan";
      return NextResponse.redirect(url);
    }

    if (sub.allowed && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/ringkasan";
      return NextResponse.redirect(url);
    }
  }

  if (isAuth && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ringkasan";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
