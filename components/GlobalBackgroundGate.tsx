"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * ✅ Dynamically import the heavy animated Background
 * - Not included in every route bundle
 * - Mounted only when we decide to show it
 */
const Background = dynamic(() => import("@/components/home/Background"), {
  ssr: false,
  loading: () => null,
});

// ✅ Only show the animated background on these routes (edit as you like)
const BG_ROUTES = new Set<string>([
  "/", // homepage
  // "/home",
  // "/pricing",
  // "/book",
]);

function useIdleMount(delayMs = 250) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const mount = () => {
      if (!cancelled) setReady(true);
    };

    // Prefer idle time so the page paints fast
    // Fallback to a short timeout for Safari / older browsers
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;

    let idleId: number | null = null;
    let t: number | null = null;

    if (typeof ric === "function") {
      idleId = ric(mount, { timeout: 1200 });
    } else {
      t = window.setTimeout(mount, delayMs);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (t !== null) window.clearTimeout(t);
    };
  }, [delayMs]);

  return ready;
}

const GlobalBackgroundGate = React.memo(function GlobalBackgroundGate() {
  const pathname = usePathname() || "/";
  const shouldShow = BG_ROUTES.has(pathname);

  // Don’t mount at all on most pages (dashboards, admin, tech, user, etc)
  if (!shouldShow) return null;

  // Defer mount until idle to avoid blocking route paint
  const ready = useIdleMount(250);
  if (!ready) return null;

  return <Background />;
});

export default GlobalBackgroundGate;