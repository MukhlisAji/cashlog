import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { triggerWelcomeEmail } from "@/services/notification.service";
import { connectGoogleTokenFromSession } from "@/services/sheets-connect.server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? "/ringkasan";

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

      // Backend deduplicates via welcome_email_sent_at on profile
      void triggerWelcomeEmail(data.session.access_token);
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
