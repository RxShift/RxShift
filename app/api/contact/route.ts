import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendEmail, brandedEmailHtml, emailFields, emailLines } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rate-limit-db";

/**
 * Best-effort CRM capture — a failed database write must never block the email
 * notification (the inbox is the operational fallback). Repeat submissions from
 * the same address append a note instead of creating a duplicate. Returns the
 * lead id (existing or new) so the notification email can be tagged to it, or
 * null if capture failed.
 */
async function captureLead(input: {
  name: string;
  pharmacy: string;
  state: string;
  email: string;
  message?: string;
  source: string;
}): Promise<string | null> {
  try {
    const service = createServiceClient();
    const email = input.email.trim().toLowerCase();

    const { data: existing } = await service
      .from("leads")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    if (existing) {
      await service.from("lead_notes").insert({
        lead_id: existing.id,
        author: "System",
        body: `Repeat form submission via ${input.source}.${input.message ? ` Message: "${input.message}"` : ""}`,
      });
      await service
        .from("leads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return existing.id as string;
    }

    const { data: lead, error } = await service
      .from("leads")
      .insert({
        pharmacy_name: input.pharmacy,
        contact_name: input.name,
        contact_email: email,
        state: input.state,
        message: input.message || null,
        source: "inbound",
        source_page: input.source,
      })
      .select("id")
      .single();
    if (error) throw error;

    await service.from("lead_notes").insert({
      lead_id: lead.id,
      author: "System",
      body: `Interest form submitted via ${input.source}.`,
    });
    return lead.id as string;
  } catch (e) {
    console.error("[crm] lead capture failed (email path unaffected):", e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, pharmacy, state, email, message, source, website } =
      await request.json();

    // Honeypot: bots fill the hidden field; pretend success and do nothing
    if (website) {
      return NextResponse.json({ success: true });
    }

    if (!name || !pharmacy || !state || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Shared rate limits (replace the per-instance Map). Silently "succeed" on
    // limit so a spammer gets no signal. Per-IP is the primary control; per-email
    // catches one address hammered from many IPs.
    const ip = clientIp(request);
    const withinLimits =
      (await checkRateLimit("contact:ip", ip, 8, 3600)) &&
      (await checkRateLimit("contact:email", String(email).toLowerCase(), 3, 3600));
    if (!withinLimits) {
      return NextResponse.json({ success: true });
    }

    const src = typeof source === "string" && source ? source : "unknown";
    const leadId = await captureLead({
      name,
      pharmacy,
      state,
      email,
      message,
      source: src,
    });

    // All email goes through the single sendEmail() core: branded, logged to
    // email_log, tagged to the lead, and (on failure) self-reported. Addressed
    // to ourselves (hello@), so it bypasses the tenant gate; replyTo reaches the
    // prospect. throwOnError preserves the original 500-on-failure behavior.
    await sendEmail({
      kind: "demo_request",
      to: process.env.CONTACT_TO_EMAIL || "hello@rxshift.io",
      replyTo: email,
      bypassGate: true,
      throwOnError: true,
      subject: `New Demo Request — ${pharmacy} (${state})`,
      html: brandedEmailHtml({
        bodyHtml:
          emailFields([
            ["Name", String(name)],
            ["Pharmacy", String(pharmacy)],
            ["State", String(state)],
            ["Email", String(email)],
            ["Message", message ? String(message) : "(none)"],
            ["Source", src],
            [
              "Submitted",
              new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
            ],
          ]) +
          emailLines([
            "Reply directly to this email to respond — it goes to the prospect.",
          ]),
      }),
      related: leadId ? { type: "lead", id: leadId } : null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
