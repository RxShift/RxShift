import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  try {
    const { name, pharmacy, state, email, message } = await request.json();

    if (!name || !pharmacy || !state || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await resend.emails.send({
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
      `,
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
