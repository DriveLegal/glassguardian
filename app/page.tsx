// app/page.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Capacitor } from "@capacitor/core";

// ✅ Web home (SSR ok)
const WebHome = dynamic(() => import("@/components/home/web/WebHome"), {
  ssr: true,
});

// ✅ App home (heavy visuals → client-only)
const AppEliteHome = dynamic(() => import("@/components/home/app/AppEliteHome"), {
  ssr: false,
});

function useIsNativeApp() {
  const [isNative, setIsNative] = React.useState(false);

  React.useEffect(() => {
    setIsNative(!!Capacitor?.isNativePlatform?.());
  }, []);

  return isNative;
}

export default function Page() {
  const isNativeApp = useIsNativeApp();
  return isNativeApp ? <AppEliteHome /> : <WebHome />;
}