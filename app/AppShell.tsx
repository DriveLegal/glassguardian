// app/AppShell.tsx
"use client";

import * as React from "react";

import Providers from "./providers";
import GlobalBackgroundGate from "@/components/GlobalBackgroundGate";
import ReferralCapture from "@/components/referrals/ReferralCapture";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <body className="min-h-screen bg-slate-950 text-slate-50">
      {/* Client-only utilities */}
      <ReferralCapture />

      {/* Background (z-0) */}
      <GlobalBackgroundGate />

      {/* App content (z-10) */}
      <div className="relative z-10">
        <Providers>{children}</Providers>
      </div>

      <Analytics />
      <SpeedInsights />
    </body>
  );
}