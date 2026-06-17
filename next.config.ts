import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server actions cap request bodies at 1 MB by default, which silently
      // rejected feedback screenshots before the action's own 5 MB check ran.
      // Allow a little headroom above that 5 MB cap for form-field overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
