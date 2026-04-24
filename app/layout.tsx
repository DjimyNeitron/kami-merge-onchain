import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "Kami Merge 神マージ",
  description: "A Suika Game-style yokai merge puzzle.",
  // app/favicon.ico handles the classic .ico via Next.js file-based
  // convention. metadata.icons below adds the Apple touch icon and
  // the two Android/PWA sizes (pulled from public/ which is served
  // statically at the site root). All four images are Kodama the
  // first-tier yokai — bright green, readable at 16px.
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Pair the modern standardised `mobile-web-app-capable` with the
  // legacy `apple-mobile-web-app-capable`. Chrome / WebKit now emit a
  // deprecation warning when only the Apple-prefixed tag is present;
  // the new form is the spec'd replacement. Both are kept because
  // older iOS versions still honour the Apple tag only.
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0f0f1e" />
        {/* mobile-web-app-capable / apple-mobile-web-app-capable are
         * emitted by metadata.other above so we get the modern tag
         * plus the legacy iOS tag without duplicating them here. */}
      </head>
      <body className="min-h-full bg-[#0f0f1e] text-white">
        {/* Web3Provider is a client component nested inside this server
         * component — valid in the Next.js App Router. Everything below
         * (game canvas, settings, dev panel) can freely use wagmi hooks. */}
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
