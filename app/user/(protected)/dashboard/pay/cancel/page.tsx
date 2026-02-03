// app/user/(protected)/dashboard/pay/cancel/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export default function UserPayCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden">
      {/* BG */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-950/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.95)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-slate-50">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 border border-red-400/60">
                  <XCircle className="w-5 h-5 text-red-300" />
                </span>
                <span>
                  <div className="text-xs tracking-[0.2em] uppercase text-slate-400">
                    Payment canceled
                  </div>
                  <div className="text-lg font-semibold">
                    No charge was made
                  </div>
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <p className="text-sm text-slate-300">
                You exited the Stripe checkout flow, so this invoice is still
                marked as <span className="font-semibold">unpaid</span>.
                You can restart payment from your invoices list whenever
                you&apos;re ready.
              </p>

              <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 flex items-start gap-2">
                <CreditCard className="w-4 h-4 mt-0.5 text-cyan-300" />
                <div>
                  <p className="font-medium text-slate-100">
                    How to try again
                  </p>
                  <p className="mt-0.5">
                    Go back to your{" "}
                    <span className="font-semibold">
                      Invoices &amp; Payments
                    </span>{" "}
                    page and click <span className="font-semibold">Pay w/ Stripe</span> on the invoice you want to complete.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-50 flex items-center justify-center"
                  variant="outline"
                  onClick={() => router.push("/user/dashboard/pay")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Invoices
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_14px_35px_rgba(45,212,191,0.65)]"
                  onClick={() => router.push("/user/dashboard")}
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}