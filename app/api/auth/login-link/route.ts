import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendLoginLinkEmail } from "@/lib/email";

// Login-alias delivery: when the typed email is a registered alias, generate
// a magic link for the account's PRIMARY auth identity and deliver it to the
// inbox the user actually has open right now. The link uses token_hash
// verification (see /app/auth/confirm), so it works on any device.
//
// Unknown emails return { handled: false } and the login form falls back to
// the standard Supabase signInWithOtp flow — today's exact behavior.

// Per-instance cooldown so an alias can't be spammed from one runtime.
// (Serverless instances don't share this map — acceptable v1; real rate
// limiting needs a shared store before public launch.)
const lastSent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

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

  const service = createServiceClient();
  const { data: alias } = await service
    .from("login_alias")
    .select("app_user_id")
    .eq("alias_email", email)
    .maybeSingle();

  if (!alias) return NextResponse.json({ handled: false });

  const last = lastSent.get(email);
  if (last && Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "A sign-in link was just sent. Check your inbox, or try again in a minute." },
      { status: 429 }
    );
  }

  const { data: appUser } = await service
    .from("app_user")
    .select("supabase_user_id")
    .eq("id", alias.app_user_id)
    .maybeSingle();
  if (!appUser) return NextResponse.json({ handled: false });

  const { data: userData, error: userErr } =
    await service.auth.admin.getUserById(appUser.supabase_user_id);
  const primaryEmail = userData?.user?.email;
  if (userErr || !primaryEmail) {
    console.error("[login-link] primary lookup failed:", userErr?.message);
    return NextResponse.json(
      { error: "Couldn't send a sign-in link. Contact your administrator." },
      { status: 500 }
    );
  }

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

  lastSent.set(email, Date.now());
  return NextResponse.json({ handled: true });
}
