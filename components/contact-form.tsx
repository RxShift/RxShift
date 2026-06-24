"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";

// Cloudflare Turnstile (free CAPTCHA). The site key is PUBLIC — it's embedded in
// the page for every visitor — so it's safe to commit. The env var overrides it;
// the literal is the activation default so the widget works in production without
// also depending on a NEXT_PUBLIC build-time var. Server-side verification still
// requires the secret (TURNSTILE_SECRET_KEY) to be set, or it stays dormant.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADp6afU4uDyrw1GU";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

const LABEL_CLASS =
  "block font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-amber mb-1.5";
const INPUT_CLASS =
  "w-full rounded-md border-[1.5px] border-line bg-white px-3 py-2.5 font-body text-sm text-navy placeholder:text-[#9BAABB] focus:border-navy focus:outline-none focus:ring-[3px] focus:ring-navy/10";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactForm({
  source,
  heading = "See RxShift working in your pharmacy.",
  body = "We’ll walk through your current scheduling process and show you how RxShift handles it — ratios, documentation, and all. About 20 minutes.",
  id = "demo",
}: {
  /** Which page the form lives on — recorded on the lead (e.g. "nevada-page") */
  source: string;
  heading?: string;
  body?: string;
  id?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [firstName, setFirstName] = useState("");

  // Turnstile (only active when a site key is configured)
  const [tsToken, setTsToken] = useState("");
  const [tsScriptReady, setTsScriptReady] = useState(false);
  const tsRef = useRef<HTMLDivElement>(null);
  const tsWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !tsScriptReady || !tsRef.current) return;
    if (tsWidgetId.current || !window.turnstile) return;
    tsWidgetId.current = window.turnstile.render(tsRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (t: string) => setTsToken(t),
      "error-callback": () => setTsToken(""),
      "expired-callback": () => setTsToken(""),
    });
  }, [tsScriptReady]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // If Turnstile is active, require a token before sending.
    if (TURNSTILE_SITE_KEY && !tsToken) {
      setErrMsg("Please complete the verification below and try again.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "");
    setFirstName(name.split(" ")[0]);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          pharmacy: data.get("pharmacy"),
          state: data.get("state"),
          email: data.get("email"),
          message: data.get("message"),
          source,
          // Honeypot — humans never see or fill this field
          website: data.get("website"),
          // Cloudflare Turnstile token (empty string when disabled)
          turnstileToken: tsToken,
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setErrMsg("");
        setStatus("error");
        // Let the visitor try again with a fresh challenge.
        if (TURNSTILE_SITE_KEY) {
          window.turnstile?.reset(tsWidgetId.current ?? undefined);
          setTsToken("");
        }
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id={id} className="scroll-mt-16 bg-navy px-6 py-16 sm:py-24">
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTsScriptReady(true)}
        />
      )}
      <div className="mx-auto max-w-[560px] text-center">
        <h2 className="font-brand text-[26px] font-bold leading-snug text-white sm:text-[32px]">
          {heading}
        </h2>
        <p className="mt-4 font-body text-base leading-[1.7] text-white/70">
          {body}
        </p>

        {status === "success" ? (
          <div className="mt-8 rounded-xl bg-white/[0.06] px-8 py-12 sm:py-16">
            <svg
              className="mx-auto"
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="24" cy="24" r="22" stroke="#F07C30" strokeWidth="2.5" />
              <path
                d="M15 24.5l6 6 12-13"
                stroke="#F07C30"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-6 font-brand text-lg font-semibold text-white">
              Thanks, {firstName}. We&rsquo;ll be in touch within one business
              day.
            </p>
            <p className="mt-3 font-body text-sm leading-[1.7] text-white/60">
              Your demo request is in. We&rsquo;ll reach out from
              hello@rxshift.io — keep an eye on your inbox.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-xl bg-white/[0.06] p-6 text-left sm:p-8"
          >
            {/* Honeypot: hidden from humans, irresistible to bots */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="space-y-5">
              <div>
                <label htmlFor="name" className={LABEL_CLASS}>
                  First name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="pharmacy" className={LABEL_CLASS}>
                  Pharmacy name
                </label>
                <input
                  id="pharmacy"
                  name="pharmacy"
                  type="text"
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="state" className={LABEL_CLASS}>
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  required
                  defaultValue=""
                  className={INPUT_CLASS}
                >
                  <option value="" disabled>
                    Select your state
                  </option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="message" className={LABEL_CLASS}>
                  Message (optional)
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  placeholder="Anything specific you'd like to see?"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Cloudflare Turnstile — renders only when a site key is set */}
            {TURNSTILE_SITE_KEY && <div ref={tsRef} className="mt-5" />}

            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-6 w-full rounded-md bg-amber px-5 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark disabled:opacity-40"
            >
              {status === "sending" ? "Sending…" : "Schedule a Demo"}
            </button>

            {status === "error" && (
              <p className="mt-4 text-center font-body text-sm text-white">
                {errMsg || (
                  <>
                    Something went wrong. Email us directly at{" "}
                    <a href="mailto:info@rxshift.io" className="text-amber">
                      info@rxshift.io
                    </a>
                  </>
                )}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
