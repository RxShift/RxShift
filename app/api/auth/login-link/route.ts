import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendLoginLinkEmail } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rate-limit-db";

// Login-alias delivery: when the typed email is a registered alias, generate
// a magic link for the account's PRIMARY auth identity and deliver it to the
// inbox the user actually has open right now. The link uses token_hash
// verification (see /app/auth/confirm), so it works on any device.
//
// Unknown emails return { handled: false } and the login form falls back to
// the standard Supabase signInWithOtp flow — today's exact behavior.
//
// Rate limiting is shared across serverless instances via the Postgres
// rate_limit table (lib/rate-limit-db): per-IP blunts probing/enumeration,
// per-email stops a single inbox being flooded with sign-in links.

export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    // fall through to the validation error below
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  // Shared rate limits (replace the old per-instance Map). 429 stops the client
  // here — the login form shows the message and does NOT fall through to a
  // second send (see app/app/login/page.tsx).
  const ip = clientIp(request);
  const allowed =
    (await checkRateLimit("login-link:ip", ip, 20, 900)) &&
    (await checkRateLimit("login-link:email", email, 5, 900));
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Check your inbox, or try again in a few minutes." },
      { status: 429 }
    );
  }

  const service = createServiceClient();

  // 1) Registered alias → deliver the PRIMARY account's link to this inbox
  // 2) Existing auth user's own email → branded link to themselves
  //    (this keeps EVERY known-user login on our branded sender + the
  //    scanner-proof interstitial; Supabase's template only ever touches
  //    brand-new signups via the client fallback)
  let primaryEmail: string | null = null;

  const { data: alias } = await service
    .from("login_alias")
    .select("app_user_id")
    .eq("alias_email", email)
    .maybeSingle();

  if (alias) {
    const { data: appUser } = await service
      .from("app_user")
      .select("supabase_user_id")
      .eq("id", alias.app_user_id)
      .maybeSingle();
    if (appUser) {
      const { data: userData } = await service.auth.admin.getUserById(
        appUser.supabase_user_id
      );
      primaryEmail = userData?.user?.email ?? null;
    }
  } else {
    // Indexed existence check (migration 0036) — replaces an O(users) page
    // scan that was both slow and a timing oracle for account enumeration.
    const { data: exists } = await service.rpc("auth_user_email_exists", {
      p_email: email,
    });
    if (exists) primaryEmail = email;
  }

  if (!primaryEmail) return NextResponse.json({ handled: false });

  const { data: linkData, error: linkErr } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: primaryEmail,
    });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[login-link] generateLink failed:", linkErr?.message);
    return NextResponse.json(
      { error: "Couldn't send a sign-in link. Try again shortly." },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const confirmUrl =
    `${origin}/app/auth/confirm` +
    `?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
    `&type=${encodeURIComponent(linkData.properties.verification_type)}`;

  try {
    await sendLoginLinkEmail(email, confirmUrl);
  } catch (e) {
    console.error("[login-link] send failed:", e);
    return NextResponse.json(
      { error: "Couldn't send a sign-in link. Try again shortly." },
      { status: 500 }
    );
  }

  return NextResponse.json({ handled: true });
}
