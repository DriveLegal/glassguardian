"use client";

export async function isNativeApp(): Promise<boolean> {
  // 1) Capacitor global (best)
  try {
    const cap = (await import("@capacitor/core")).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
  } catch {
    // ignore
  }

  // 2) Fallback: user agent checks (rough backup)
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    // WKWebView/Capacitor often includes these patterns depending on config
    if (/Capacitor|wv|WKWebView/i.test(ua)) return true;
  }

  return false;
}
