"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { Capacitor } from "@capacitor/core";

const WebHome = dynamic(() => import("@/components/home/web/WebHome"), {
  ssr: true,
});

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

  return (
    <>
      {/* 🔥 Preload logo for faster LCP */}
      <Head>
        <link
          rel="preload"
          href="/branding/glass-guardian-gold.png"
          as="image"
        />
      </Head>

      {isNativeApp ? <AppEliteHome /> : <WebHome />}
    </>
  );
}