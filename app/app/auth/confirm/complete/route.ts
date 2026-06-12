import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// The actual token consumption for alias sign-in links — POST only, so
// mail-scanner prefetches (GET/HEAD) can never burn the one-time token.
// Reached by the button on /app/auth/confirm.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");

  if (typeof tokenHash === "string" && typeof type === "string") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/app`, 303);
    }
  }

  return NextResponse.redirect(`${origin}/app/login?error=link`, 303);
}
