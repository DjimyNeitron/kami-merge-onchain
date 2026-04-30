import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import FarcasterUserBadge from "@/components/FarcasterUserBadge";

// Canonical site origin — used by every absolute URL in the embed
// metadata below. Exposing it as a const keeps the four occurrences
// (fc:miniapp action.url, fc:miniapp imageUrl, fc:miniapp
// splashImageUrl, openGraph.url, twitter image, og image) in lockstep.
const SITE_URL = "https://kami-merge.vercel.app";
const EMBED_IMAGE = `${SITE_URL}/image.png`;
const SOCIAL_TITLE = "Kami Merge - Yokai Puzzle";
const SOCIAL_DESC =
  "Merge mythical Japanese yokai in a serene physics puzzle. Climb the kami leaderboard on Soneium.";

// Farcaster Mini App embed payload — read by the Warpcast cast
// composer and other Farcaster clients to render the rich preview
// + Play button when this URL is shared in a cast. Schema is the
// official "fc:miniapp" v1 shape (also accepted under the legacy
// "fc:frame" name; we ship the modern key only). The matching
// public/.well-known/farcaster.json manifest is already signed —
// this just exposes the in-page tag the composer reads first.
const FC_MINIAPP = JSON.stringify({
  version: "1",
  imageUrl: EMBED_IMAGE,
  button: {
    title: "Play",
    action: {
      type: "launch_miniapp",
      name: "Kami Merge",
      url: SITE_URL,
      splashImageUrl: `${SITE_URL}/splash.png`,
      splashBackgroundColor: "#0F1626",
    },
  },
});

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
  // OpenGraph preview for Twitter/X, Discord, Telegram, Slack, and any
  // other client that scrapes og:* tags. Image URL is absolute because
  // most scrapers do not resolve relative paths.
  openGraph: {
    title: SOCIAL_TITLE,
    description: SOCIAL_DESC,
    url: SITE_URL,
    siteName: "Kami Merge",
    images: [EMBED_IMAGE],
    type: "website",
  },
  // Twitter / X large-image card. Twitter does not fall back to og:*
  // alone; it requires the twitter:card hint to upgrade from the
  // default summary card to summary_large_image.
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: SOCIAL_DESC,
    images: [EMBED_IMAGE],
  },
  // Pair the modern standardised `mobile-web-app-capable` with the
  // legacy `apple-mobile-web-app-capable`. Chrome / WebKit now emit a
  // deprecation warning when only the Apple-prefixed tag is present;
  // the new form is the spec'd replacement. Both are kept because
  // older iOS versions still honour the Apple tag only. The
  // `fc:miniapp` tag is the Farcaster cast-composer hook — it must
  // be a string-stringified JSON payload conforming to the
  // fc:miniapp v1 schema (see FC_MINIAPP above).
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "fc:miniapp": FC_MINIAPP,
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
        <Web3Provider>
          {/* FarcasterUserBadge sits as a sibling of {children} so it
           * floats above the game canvas regardless of game state, but
           * still inside Web3Provider — the hook it uses (useConnect)
           * needs the wagmi context. Component is fully self-gating:
           * returns null in standalone web / SSR / no-user cases, so
           * mounting it unconditionally here is safe. */}
          <FarcasterUserBadge />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
