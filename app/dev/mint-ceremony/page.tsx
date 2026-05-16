// Internal dev-only MintCeremony demo route.
//
// URL: /dev/mint-ceremony
//
// Same gating pattern as /dev/inventory and /dev/nft-cards: the path
// prefix `dev/` is naming convention only; the runtime `notFound()`
// check is what actually blocks the route in a production build
// (Vercel sets NODE_ENV=production). `dynamic = 'force-dynamic'`
// keeps the gate at request time. The scroll override + dark backdrop
// come from app/dev/layout.tsx, which wraps the whole /dev/* segment.

import { notFound } from "next/navigation";
import DemoClient from "./DemoClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mint Ceremony — Dev",
  robots: { index: false, follow: false },
};

export default function MintCeremonyDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DemoClient />;
}
