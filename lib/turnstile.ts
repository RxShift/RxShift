import "server-only";

// Cloudflare Turnstile (free, unlimited) verification for public forms.
//
// Gated on TURNSTILE_SECRET_KEY: if the secret isn't set, verification is a
// no-op that returns true — so this integration deploys DORMANT and activates
// automatically the moment the keys are added to the environment.
//
// When configured: a present-and-valid token passes; an invalid/missing token
// is blocked. On a network error reaching Cloudflare we FAIL OPEN (return true)
// so a Cloudflare outage can't silently swallow real demo requests — the shared
// rate limiter remains as the second layer of abuse protection.
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dormant until configured
  if (!token) return false; // configured but no token => block

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip && ip !== "unknown") body.set("remoteip", ip);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("[turnstile] verify request failed (allowing):", e);
    return true; // fail open on infrastructure error; rate limiter still applies
  }
}
