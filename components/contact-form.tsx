"use client";

import { useState } from "react";

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

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [firstName, setFirstName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

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
        }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="demo" className="bg-navy px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-[560px] text-center">
        <h2 className="font-brand text-[26px] font-bold leading-snug text-white sm:text-[32px]">
          See RxShift working in your pharmacy.
        </h2>
        <p className="mt-4 font-body text-base leading-[1.7] text-white/70">
          We&rsquo;ll walk through your current scheduling process and show you
          how RxShift handles it — ratios, documentation, and all. About 20
          minutes.
        </p>

        {status === "success" ? (
          <p className="mt-12 font-brand text-lg font-semibold text-white">
            Thanks, {firstName}. We&rsquo;ll be in touch within one business
            day.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-xl bg-white/[0.06] p-6 text-left sm:p-8"
          >
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

            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-6 w-full rounded-md bg-amber px-5 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark disabled:opacity-40"
            >
              {status === "sending" ? "Sending…" : "Schedule a Demo"}
            </button>

            {status === "error" && (
              <p className="mt-4 text-center font-body text-sm text-white">
                Something went wrong. Email us directly at{" "}
                <a href="mailto:info@rxshift.io" className="text-amber">
                  info@rxshift.io
                </a>
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
