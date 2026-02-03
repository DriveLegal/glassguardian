"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { isNativeApp } from "@/lib/isNativeApp";

// Keep web home normal (your existing one)
const WebHome = dynamic(() => import("@/components/home/web/WebHome"), { ssr: true });

// App home is heavy → client-only so it doesn’t affect web SEO/perf
const AppEliteHome = dynamic(() => import("./AppEliteHome"), { ssr: false });

export default function HomeGate() {
  const [mode, setMode] = React.useState<"web" | "app">("web");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const native = await isNativeApp();
      if (!alive) return;
      setMode(native ? "app" : "web");
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Prevent a flash of web-home inside app
  if (!ready && typeof window !== "undefined") {
    return <div className="min-h-screen bg-black" />;
  }

  return mode === "app" ? <AppEliteHome /> : <WebHome />;
}
