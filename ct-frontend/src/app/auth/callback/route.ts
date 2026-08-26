import { NextResponse } from "next/server";

import { getSiteUrl } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { triggerWelcomeEmail } from "@/services/notification.service";
import { connectGoogleTokenFromSession } from "@/services/sheets-connect.server";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteUrl().replace(/\/$/, "");
  const redirect = safeRedirectPath(searchParams.get("redirect"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      if (data.session.provider_refresh_token) {
        await connectGoogleTokenFromSession(
          data.session.access_token,
          data.session.provider_refresh_token,
          data.session.provider_token,
        );
      }

      void triggerWelcomeEmail(data.session.access_token);

      if (searchParams.get("phase") === "sheets") {
        const next = new URL(`${origin}/auth/connect-sheets`);
        next.searchParams.set("redirect", redirect);
        next.searchParams.set("provision", "1");
        return NextResponse.redirect(next);
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
