// components/GlobalBackgroundGate.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * ✅ Route-aware, lazy background gate
 * - Keeps heavy visuals OUT of most route bundles
 * - Mounts only on allowed routes
 * - Defers mounting until idle so first paint stays fast
 *
 * Updated:
 * ✅ Adds "after sunset starry sky + comet" background option
 * ✅ Keeps your existing Background as a fallback / alternate
 * ✅ Lets you pick which background shows per-route
 */

/** --- Background options (client-only) --- */
const Background = dynamic(() => import("@/components/home/Background"), {
  ssr: false,
  loading: () => null,
});

const AfterSunsetStarfield = dynamic(
  () => import("@/components/home/web/backgrounds/AfterSunsetStarfield"),
  { ssr: false, loading: () => null }
);

/**
 * ✅ Only show ANY animated background on these routes
 * (You can add more routes later)
 */
const BG_ROUTES = new Set<string>([
  "/", // homepage
  // "/home",
  // "/pricing",
  // "/book",
]);

/**
 * ✅ Choose which background to use per-route
 * - If a route isn't listed here, it falls back to "Background"
 * - Right now: "/" uses AfterSunsetStarfield
 */
function pickBackground(pathname: string) {
  if (pathname === "/") return "after-sunset";
  return "default";
}

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

  const mode = pickBackground(pathname);

  if (mode === "after-sunset") {
    return <AfterSunsetStarfield density={1.15} />;
  }

  return <Background />;
});

export default GlobalBackgroundGate;