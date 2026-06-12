import { describe, expect, it } from "vitest";
import {
  isRecipientAllowed,
  resolveEmailDelivery,
  type EmailTenant,
} from "../email-policy";

const tenant = (over: Partial<EmailTenant> = {}): EmailTenant => ({
  id: "t-1",
  outbound_email_enabled: true,
  status: "trial",
  email_allowlist: [],
  ...over,
});

describe("isRecipientAllowed — the email-safety gate", () => {
  it("kill switch off blocks everything, even allowlisted addresses", () => {
    const t = tenant({
      outbound_email_enabled: false,
      status: "live",
      email_allowlist: ["susie@example.com"],
    });
    expect(isRecipientAllowed(t, "susie@example.com")).toBe(false);
  });

  it("trial with empty allowlist sends nothing", () => {
    expect(isRecipientAllowed(tenant(), "anyone@example.com")).toBe(false);
  });

  it("setup with empty allowlist sends nothing", () => {
    expect(isRecipientAllowed(tenant({ status: "setup" }), "anyone@example.com")).toBe(false);
  });

  it("trial allowlist hit sends; miss is dropped", () => {
    const t = tenant({ email_allowlist: ["susie@optum.com", "susie@yahoo.com"] });
    expect(isRecipientAllowed(t, "susie@optum.com")).toBe(true);
    expect(isRecipientAllowed(t, "susie@yahoo.com")).toBe(true);
    expect(isRecipientAllowed(t, "real.staffer@gmail.com")).toBe(false);
  });

  it("allowlist comparison ignores case and whitespace on both sides", () => {
    const t = tenant({ email_allowlist: [" Susie@Optum.COM "] });
    expect(isRecipientAllowed(t, "susie@optum.com")).toBe(true);
    expect(isRecipientAllowed(t, "  SUSIE@OPTUM.COM  ")).toBe(true);
  });

  it("allowlist restricts LIVE tenants too (rule 2 beats rule 4)", () => {
    const t = tenant({ status: "live", email_allowlist: ["only@example.com"] });
    expect(isRecipientAllowed(t, "only@example.com")).toBe(true);
    expect(isRecipientAllowed(t, "someone.else@example.com")).toBe(false);
  });

  it("live with empty allowlist sends normally (production unaffected)", () => {
    const t = tenant({ status: "live" });
    expect(isRecipientAllowed(t, "staff@pharmacy.com")).toBe(true);
  });

  it("null allowlist behaves like empty", () => {
    expect(isRecipientAllowed(tenant({ email_allowlist: null }), "a@b.com")).toBe(false);
    expect(
      isRecipientAllowed(tenant({ status: "live", email_allowlist: null }), "a@b.com")
    ).toBe(true);
  });

  it("blank entries in the allowlist are ignored, not wildcards", () => {
    const t = tenant({ email_allowlist: ["", "  "] });
    // Only blanks = effectively empty list = trial sends nothing
    expect(isRecipientAllowed(t, "anyone@example.com")).toBe(false);
  });
});

describe("resolveEmailDelivery — demo tenant mode", () => {
  it("demo with a redirect address rewrites EVERY send to it", () => {
    const t = tenant({
      is_demo: true,
      demo_redirect_email: "Jamison@Example.com ",
      status: "trial",
    });
    const d = resolveEmailDelivery(t, "carlos.rivera@mesavistarx.com");
    expect(d).toEqual({ send: true, to: "jamison@example.com", redirected: true });
  });

  it("demo redirect beats the allowlist — fictional roster addresses never win", () => {
    const t = tenant({
      is_demo: true,
      demo_redirect_email: "demo-inbox@example.com",
      email_allowlist: ["carlos.rivera@mesavistarx.com"],
    });
    const d = resolveEmailDelivery(t, "carlos.rivera@mesavistarx.com");
    expect(d).toEqual({
      send: true,
      to: "demo-inbox@example.com",
      redirected: true,
    });
  });

  it("demo WITHOUT a redirect address sends nothing at all", () => {
    const t = tenant({ is_demo: true, demo_redirect_email: null, status: "live" });
    expect(resolveEmailDelivery(t, "anyone@example.com")).toEqual({ send: false });
    const blank = tenant({ is_demo: true, demo_redirect_email: "  " });
    expect(resolveEmailDelivery(blank, "anyone@example.com")).toEqual({ send: false });
  });

  it("kill switch still beats demo redirect", () => {
    const t = tenant({
      is_demo: true,
      demo_redirect_email: "demo-inbox@example.com",
      outbound_email_enabled: false,
    });
    expect(resolveEmailDelivery(t, "x@y.com")).toEqual({ send: false });
  });

  it("non-demo tenants are completely unaffected by demo fields", () => {
    const live = tenant({ status: "live", is_demo: false });
    expect(resolveEmailDelivery(live, "staff@pharmacy.com")).toEqual({
      send: true,
      to: "staff@pharmacy.com",
      redirected: false,
    });
  });
});
