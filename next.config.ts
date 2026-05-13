import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 (Turbopack) blocks cross-origin requests for dev
  // resources (HMR socket, /_next/webpack-hmr, etc) unless the
  // requesting host is in this list. The previous "*" wildcard
  // turned out NOT to match against bare IPs like 172.20.10.4 —
  // iPhone on local hotspot was getting served HTML but blocked
  // from JS bundle updates, which silently broke every mobile
  // verification of Stage 3.3 PRs #18–#24.
  //
  // We list explicit IPs + CIDR ranges instead. The CIDR entries
  // (192.168.0.0/16, 10.0.0.0/8, 172.20.10.0/24) cover the three
  // common dev networks — home WiFi, corporate / mesh, iPhone
  // hotspot — so the config keeps working as the local IP rolls
  // between sessions without forcing a config edit each time.
  // localhost / 127.0.0.1 are kept so desktop dev paths still
  // work when explicitly addressed (some browsers do that on
  // page reload from bookmarks).
  allowedDevOrigins: [
    "172.20.10.4", // current iPhone hotspot IP
    "172.20.10.0/24", // iPhone hotspot range
    "192.168.0.0/16", // home WiFi LAN
    "10.0.0.0/8", // corporate / mesh networks
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
