import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { brandedEmailHtml, emailFields, emailLines } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Per-instance submission throttle (60s per email address)
const lastContact = new Map<string, number>();

/**
 * Best-effort CRM capture — a failed database write must never block the
 * email notification (the inbox is the operational fallback). Repeat
 * submissions from the same address append a note to the existing lead
 * instead of creating a duplicate.
 */
async function captureLead(input: {
  name: string;
  pharmacy: string;
  state: string;
  email: string;
  message?: string;
  source: string;
}): Promise<void> {
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
      return;
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
  } catch (e) {
    console.error("[crm] lead capture failed (email path unaffected):", e);
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

    // Per-address throttle (per server instance — same pattern as login)
    const norm = String(email).toLowerCase();
    const last = lastContact.get(norm);
    if (last && Date.now() - last < 60_000) {
      return NextResponse.json({ success: true }); // already handled moments ago
    }
    lastContact.set(norm, Date.now());

    await captureLead({
      name,
      pharmacy,
      state,
      email,
      message,
      source: typeof source === "string" && source ? source : "unknown",
    });

    // The Resend SDK does not throw on API errors — it returns them in
    // the `error` field, so a failed send must be checked explicitly.
    const { error } = await resend.emails.send({
      from: `RxShift <${process.env.RESEND_FROM_EMAIL || "hello@rxshift.io"}>`,
      to: process.env.CONTACT_TO_EMAIL || "info@rxshift.io",
      replyTo: email,
      subject: `New Demo Request — ${pharmacy} (${state})`,
      html: brandedEmailHtml({
        bodyHtml:
          emailFields([
            ["Name", String(name)],
            ["Pharmacy", String(pharmacy)],
            ["State", String(state)],
            ["Email", String(email)],
            ["Message", message ? String(message) : "(none)"],
            ["Source", String(source || "unknown")],
            ["Submitted", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"],
          ]) +
          emailLines(["Reply directly to this email to respond — it goes to the prospect."]),
      }),
    });

    if (error) {
      console.error("Resend send failed:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
