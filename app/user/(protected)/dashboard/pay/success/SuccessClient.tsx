"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, LayoutDashboard } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

export function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");

  // On success page load, mark the invoice as paid in tech_invoices
  React.useEffect(() => {
    if (!invoiceId) return;

    (async () => {
      try {
        const { error } = await supabaseClient
          .from("tech_invoices")
          .update({ status: "paid" })
          .eq("id", invoiceId);

        if (error) {
          console.warn(
            "Failed to mark invoice as paid on success page:",
            error.message
          );
        }
      } catch (err) {
        console.warn("Unexpected error marking invoice paid:", err);
      }
    })();
  }, [invoiceId]);

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden">
      {/* BG */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-cyan-500/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.85),transparent_55%)]" />
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="border border-emerald-500/60 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-950/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(16,185,129,0.6)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-slate-50">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/80">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                </span>
                <span>
                  <div className="text-xs tracking-[0.2em] uppercase text-emerald-200">
                    Payment received
                  </div>
                  <div className="text-lg font-semibold">
                    Thank you for your payment
                  </div>
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <p className="text-sm text-slate-200">
                Your Glass Guardian invoice has been marked as{" "}
                <span className="font-semibold text-emerald-300">paid</span>.
                You&apos;ll see this reflected in your Invoices &amp; Payments
                section.
              </p>

              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                Keep this invoice email for your records. If your windshield
                repair includes a warranty, it will remain attached to this
                invoice in your account.
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  className="flex-1 bg-slate-900/90 hover:bg-slate-900 border border-slate-600 text-slate-50 flex items-center justify-center"
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
                  <LayoutDashboard className="w-4 h-4 mr-2" />
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