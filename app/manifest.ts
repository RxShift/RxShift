import type { MetadataRoute } from "next";

// Web app manifest → installable as a home-screen app ("standalone", no browser
// bar). Next auto-links this at /manifest.webmanifest. Staff install it from
// app.rxshift.io after signing in (see the "Using RxShift on your phone" help).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RxShift",
    short_name: "RxShift",
    description: "Compliance-ready pharmacy scheduling",
    start_url: "/app/me",
    scope: "/app",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#1C2F5E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
