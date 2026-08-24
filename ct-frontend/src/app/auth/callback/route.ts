import { NextResponse } from "next/server";

import { getSiteUrl } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { withNotice } from "@/lib/notice";
import { triggerWelcomeEmail } from "@/services/notification.service";
import { connectGoogleTokenFromSession } from "@/services/sheets-connect.server";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function needsAppAccess(path: string): boolean {
  return (
    path.startsWith("/trial") ||
    path.startsWith("/ringkasan") ||
    path.startsWith("/settings") ||
    path.startsWith("/dashboard")
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteUrl().replace(/\/$/, "");
  const redirect = safeRedirectPath(searchParams.get("redirect"));
  const phase = searchParams.get("phase");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const isGoogle = data.session.user.app_metadata?.provider === "google";

      if (phase === "sheets" && data.session.provider_refresh_token) {
        await connectGoogleTokenFromSession(
          data.session.access_token,
          data.session.provider_refresh_token,
          data.session.provider_token,
        );
      }

      void triggerWelcomeEmail(data.session.access_token);

      if (isGoogle && phase !== "sheets" && needsAppAccess(redirect)) {
        return NextResponse.redirect(
          `${origin}/auth/connect-sheets?redirect=${encodeURIComponent(redirect)}`,
        );
      }

      const destination =
        phase === "sheets" ? withNotice(redirect, "sheet_connected") : redirect;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
