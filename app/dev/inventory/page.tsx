// Internal dev-only Inventory demo route.
//
// URL: /dev/inventory
//
// Same gating pattern as /dev/nft-cards (see app/dev/nft-cards/page.tsx):
// path prefix `dev/` is naming convention only, the runtime
// `notFound()` check is what blocks the route in production.
//
// `dynamic = 'force-dynamic'` keeps the gate at request time. The
// scroll override + dark backdrop come from app/dev/layout.tsx
// which wraps the whole /dev/* segment.

import { notFound } from "next/navigation";
import DemoClient from "./DemoClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Inventory — Dev",
  robots: { index: false, follow: false },
};

export default function InventoryDemoPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DemoClient />;
}
