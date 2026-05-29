"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import Providers from "./providers";
import GlobalBackgroundGate from "@/components/GlobalBackgroundGate";
import ReferralCapture from "@/components/referrals/ReferralCapture";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const isStableDashboardArea =
    pathname?.startsWith("/tech") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/user");

  return (
    <>
      <ReferralCapture />
      <GlobalBackgroundGate />

      <div className="relative z-10 min-h-[100dvh] overflow-x-hidden">
        <Providers>
          {isStableDashboardArea ? (
            <>{children}</>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 1,
                        transition: {
                          duration: 0.28,
                          ease: "easeOut",
                        },
                      }
                }
                exit={
                  reduceMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        transition: {
                          duration: 0.18,
                          ease: "easeOut",
                        },
                      }
                }
                className="min-h-[100dvh]"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </Providers>
      </div>

      <Analytics />
      <SpeedInsights />
    </>
  );
}