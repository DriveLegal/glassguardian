// app/deposit/cancel/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { XCircle, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DepositCancelPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-50">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 text-center shadow-[0_40px_140px_rgba(2,6,23,0.95)] backdrop-blur-2xl md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-400/12 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-rose-400/10 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-300/30 bg-rose-400/10 shadow-[0_0_55px_rgba(244,63,94,0.22)]">
              <XCircle className="h-10 w-10 text-rose-200" />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-rose-200/80">
              Deposit Not Completed
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Your deposit was not submitted.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              No worries — your card was not charged through this canceled checkout.
              Please use the deposit link again or contact Glass Guardian if you need help.
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <CreditCard className="h-4 w-4 text-sky-200" />
                Want to complete it?
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Reopen the deposit link your technician sent and complete the secure Stripe checkout.
              </p>
            </div>

            <div className="mt-8">
              <Link href="/">
                <Button className="bg-sky-600 text-white hover:bg-sky-700">
                  Back to Glass Guardian
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}