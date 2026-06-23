import type { NextConfig } from "next";

// Baseline security headers on every response. NOTE: a Content-Security-Policy
// is intentionally NOT set here yet — a strict CSP needs per-page testing
// (inline styles, Supabase/Resend/OpenAI origins) and is tracked as a follow-up.
// X-Frame-Options: DENY is safe today (the app is never iframed; relax to
// frame-ancestors if an interactive marketing embed is added later).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server actions cap request bodies at 1 MB by default, which silently
      // rejected feedback screenshots before the action's own 5 MB check ran.
      // Allow a little headroom above that 5 MB cap for form-field overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
