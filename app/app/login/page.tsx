"use client";

import { useState } from "react";
import RxShiftMark from "@/components/rxshift-mark";
import Button from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    // Alias path first: if this address is a registered extra sign-in email
    // for an account, the server delivers the link to it directly.
    try {
      const res = await fetch("/api/auth/login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.handled) {
        setStatus("sent");
        return;
      }
      if (!res.ok && data.error) {
        setErrorMsg(data.error);
        setStatus("error");
        return;
      }
    } catch {
      // Endpoint unreachable — fall through to the standard flow
    }

    // Standard flow: Supabase sends the magic link to this address
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/app/auth/callback`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <RxShiftMark size={64} />
          <h1 className="mt-6 font-brand text-2xl font-bold text-navy">
            Sign in to RxShift
          </h1>
          <p className="mt-2 font-body text-sm text-steel">
            We&rsquo;ll email you a sign-in link. No password needed.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-[10px] border border-line bg-white p-8 text-center shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
            <p className="font-brand text-base font-semibold text-navy">
              Check your email
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed text-steel">
              We sent a sign-in link to <strong>{email}</strong>. It expires in
              an hour. Check spam if it doesn&rsquo;t arrive in a minute.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-[10px] border border-line bg-white p-8 shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
          >
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourpharmacy.com"
            />
            <Button
              type="submit"
              disabled={status === "sending"}
              className="mt-4 w-full"
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </Button>
            {status === "error" && (
              <p className="mt-3 font-body text-xs text-[#C0392B]">
                {errorMsg || "Something went wrong. Try again."}
              </p>
            )}
          </form>
        )}

        <p className="mt-6 text-center font-body text-xs text-steel">
          New to RxShift? Signing in for the first time starts your setup.
        </p>
      </div>
    </main>
  );
}
