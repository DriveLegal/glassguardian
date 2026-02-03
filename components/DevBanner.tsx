// components/DevBanner.tsx
"use client";

import Link from "next/link";

/** Lightweight DEV banner that shows when gg_dev_role cookie is present. */
export default function DevBanner() {
  if (typeof document === "undefined") return null;

  const hasCookie = /(?:^|;\s*)gg_dev_role=/.test(document.cookie);
  if (!hasCookie) return null;

  const role =
    document.cookie.match(/(?:^|;\s*)gg_dev_role=([^;]+)/)?.[1] ?? "user";

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm">
      <strong>DEV SIMULATION ACTIVE:</strong> acting as{" "}
      <span className="uppercase font-semibold">{role}</span> — mock data only.
      <Link href="/dev/logout" className="ml-3 underline">
        Exit dev
      </Link>
    </div>
  );
}