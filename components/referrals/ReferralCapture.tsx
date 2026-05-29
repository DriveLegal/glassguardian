//app/components/referrals/ReferralCapture.tsx
"use client";

import * as React from "react";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export default function ReferralCapture() {
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = (url.searchParams.get("ref") || "").trim();

      // Allow only simple uppercase/numbers codes (your codes look like GGXXXX)
      if (ref && /^[A-Za-z0-9_-]{4,64}$/.test(ref)) {
        // keep it for 14 days
        setCookie("gg_ref", ref, 60 * 60 * 24 * 14);

        // optional: clean the URL
        url.searchParams.delete("ref");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // ignore
    }
  }, []);

  return null;
}