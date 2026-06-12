import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  try {
    const { name, pharmacy, state, email, message, source } =
      await request.json();

    if (!name || !pharmacy || !state || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
      subject: `Demo Request: ${pharmacy} — ${state}`,
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Pharmacy:</strong> ${escapeHtml(pharmacy)}</p>
        <p><strong>State:</strong> ${escapeHtml(state)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ""}
        <p><strong>Source:</strong> ${escapeHtml(source || "unknown")}</p>
      `,
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
