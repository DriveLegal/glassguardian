// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Quicksand } from "next/font/google";

import Providers from "./providers";
import GlobalBackgroundGate from "@/components/GlobalBackgroundGate";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glass Guardian – Chip & Crack Repair",
  description:
    "Premium mobile chip & crack repair. Insurance-friendly, fast, guaranteed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={quicksand.variable}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-slate-950 text-slate-50">
        {/* Route-aware, lazy background */}
        <GlobalBackgroundGate />

        {/* Global providers (React Query, etc.) */}
        <Providers>{children}</Providers>

        {/* Vercel telemetry */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}