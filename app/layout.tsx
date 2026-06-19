import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rxshift.io"),
  title: "RxShift — Compliance-ready pharmacy scheduling",
  description:
    "RxShift generates compliant pharmacy schedules automatically — enforcing pharmacist-to-tech ratios and producing an inspection-ready hourly compliance record.",
  openGraph: {
    title: "RxShift — Compliance-ready pharmacy scheduling",
    description:
      "Ratio-aware schedules and an automated hourly Compliance Record for pharmacies with 1–25 locations.",
    url: "https://rxshift.io",
    siteName: "RxShift",
  },
  // Home-screen install (iOS uses apple-touch-icon; the manifest covers Android).
  appleWebApp: { capable: true, title: "RxShift", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1C2F5E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full`}
    >
      {/* No-flash script: sets .dark on <html> before first paint — APP ONLY.
          Marketing (rxshift.io root paths) always renders light; the hostname
          check covers production (app.rxshift.io), the pathname check covers
          local dev (localhost:3200/app). */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isApp=location.hostname.indexOf('app.')===0||location.pathname.indexOf('/app')===0;if(!isApp)return;var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* No-flash script: applies .sidebar-collapsed to <html> before first
            paint if the user collapsed the nav last time — APP ONLY (same guard
            as the theme script). Mirrors the dark-mode preference pattern. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isApp=location.hostname.indexOf('app.')===0||location.pathname.indexOf('/app')===0;if(!isApp)return;if(localStorage.getItem('rx-sidebar-collapsed')==='1'){document.documentElement.classList.add('sidebar-collapsed')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
