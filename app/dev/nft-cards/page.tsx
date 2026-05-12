// Internal dev-only demo route for the NFTCard component.
//
// URL: /dev/nft-cards
//
// Gated by `notFound()` at request time when NODE_ENV is production —
// Vercel builds with NODE_ENV=production, so the public deployment
// serves a 404 here regardless of how the URL is discovered. The path
// prefix `dev/` is naming convention only, not a Next.js skip rule
// (we originally tried `_dev/`, but Next.js treats underscore-prefixed
// app-router directories as PRIVATE folders, so the route would have
// been invisible in dev too. `dev/` keeps the route addressable while
// the runtime gate handles the production block).
//
// The page is rendered as a thin Server Component shell so the gate
// runs at request time (before any client bundle ships). All the
// interactive controls (size selector, toggles, grid) live in the
// `./DemoClient.tsx` client component, which only mounts after the
// gate decides we're in a non-prod environment.

import { notFound } from "next/navigation";
import DemoClient from "./DemoClient";

export const dynamic = "force-dynamic"; // skip prerender for the gate
export const metadata = {
  title: "NFT Cards — Dev",
  robots: { index: false, follow: false },
};

export default function NFTCardsDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DemoClient />;
}
