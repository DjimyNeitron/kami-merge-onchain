import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "Kami Merge 神マージ",
  description: "A Suika Game-style yokai merge puzzle.",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
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
