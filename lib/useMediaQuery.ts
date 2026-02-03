// lib/useMediaQuery.ts
"use client";

import { useEffect, useState } from "react";

/**
 * useMediaQuery
 * - SSR-safe (no window on server)
 * - Uses addEventListener('change') when available
 * - Falls back to addListener/removeListener for older Safari
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return; // ✅ return void, not false
    }

    const mql = window.matchMedia(query);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // set initial
    setMatches(mql.matches);

    // add listener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onChange);
    }

    // cleanup
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(onChange);
      }
    };
  }, [query]);

  return matches;
}