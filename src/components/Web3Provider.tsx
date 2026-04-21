"use client";

// Web3 provider stack for the whole app. Three nested providers are
// required by wagmi v2 + RainbowKit v2:
//
//   WagmiProvider          — chain config, transports, connector registry
//     QueryClientProvider  — wagmi v2 data layer is tanstack/react-query
//       RainbowKitProvider — modal UI + ConnectButton
//
// The QueryClient is created inside a useState initializer so React's
// Strict Mode double-invoke in dev doesn't spawn two clients.
//
// Mount gate: RainbowKit's wagmi connector library reaches into
// localStorage during module init (syncStorage in the cookie-to-storage
// hydration path). Next.js prerender of `/_not-found` runs in a Node
// worker with no DOM and no localStorage shim, which throws. Gating
// the provider tree on a mounted flag keeps SSR rendering plain HTML
// and only hydrates the wagmi tree after the first browser-side effect.
// `children` are still rendered on the server for SEO/fast paint — they
// just don't see any wagmi hooks until after hydration, which is fine
// for this app (the ConnectButton is the only wagmi consumer today).
//
// Theme colours pull from the game's warm-gold HUD palette so the modal
// and ConnectButton read as part of the game, not as a bolt-on widget.

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState } from "react";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR + first client paint: bypass wagmi entirely. Children still
    // render; hooks like useWallet() return their disconnected defaults.
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="en-US"
          theme={darkTheme({
            accentColor: "#c8a04a", // warm gold — matches HUD + buttons
            accentColorForeground: "#1a1a2e",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {/* locale is pinned to en-US so the RainbowKit modal UI (labels,
           * status messages, error text) always renders in English
           * regardless of the browser's Accept-Language header. The rest
           * of the app's user-facing strings are also hard-coded English. */}
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
