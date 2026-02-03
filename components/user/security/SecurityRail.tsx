// components/user/security/SecurityRail.tsx
"use client";

import * as React from "react";
import SecurityBadge from "./SecurityBadge";

/**
 * Bottom-of-page badge (NOT fixed).
 * Mobile-tuned so it sits cleaner above the bottom tabs + safe-area,
 * and avoids the “cramped” feeling on small screens.
 */
export default function SecurityRail() {
  return (
    <div className="mt-6">
      <div className="mx-auto w-[min(620px,calc(100vw-1.5rem))]">
        {/* Dock wrapper */}
        <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.02] backdrop-blur-[14px] shadow-[0_18px_90px_rgba(0,0,0,0.65)]">
          <div className="pointer-events-none absolute -inset-24 bg-[radial-gradient(circle_at_20%_20%,rgba(96,220,255,0.14),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(255,110,220,0.10),transparent_58%)]" />
          <div className="relative p-3 sm:p-3.5">
            {/* Slightly compact on mobile so it looks “organized” */}
            <SecurityBadge compact className="w-full" />
          </div>
        </div>
      </div>

      {/* spacing that respects iOS tabbar + safe-area (so it doesn’t feel glued to tabs) */}
      <div className="h-[calc(env(safe-area-inset-bottom)+96px)]" />
    </div>
  );
}