// app/deposit/success/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Calendar, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DepositSuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-50">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 text-center shadow-[0_40px_140px_rgba(2,6,23,0.95)] backdrop-blur-2xl md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-sky-400/12 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/35 bg-emerald-400/12 shadow-[0_0_55px_rgba(16,185,129,0.35)]">
              <CheckCircle2 className="h-10 w-10 text-emerald-200" />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
              Deposit Confirmed
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Thank you for your deposit.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              Your deposit has been received and applied toward your windshield repair.
              We’ll see you at your appointment.
            </p>

            <div className="mt-7 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-emerald-200" />
                  Payment secured
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Stripe confirmed the deposit payment.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Calendar className="h-4 w-4 text-sky-200" />
                  Appointment ready
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Your tech will arrive at the scheduled time.
                </p>
              </div>
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