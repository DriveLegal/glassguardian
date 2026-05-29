// app/deposit/[token]/page.tsx
"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type DepositRequest = {
  id: string;
  token: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  amount_cents: number;
  status: string;
  appointment_id?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

function money(cents: number) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function DepositPage() {
  const params = useParams();
  const search = useSearchParams();
  const token = String(params?.token || "");

  const [deposit, setDeposit] = React.useState<DepositRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const success = search.get("success") === "1";

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/payments/deposits/${token}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!mounted) return;

        if (!res.ok || !json?.deposit) {
          setErr(json?.error || "This deposit link was not found.");
          setDeposit(null);
        } else {
          setDeposit(json.deposit as DepositRequest);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "This deposit link was not found.");
        setDeposit(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (token) {
      load();
    } else {
      setErr("Missing deposit token.");
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [token, success]);

  async function payDeposit() {
    try {
      setPaying(true);
      setErr(null);

      const res = await fetch("/api/stripe/deposit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Could not start checkout.");
      }

      if (!json?.url) {
        throw new Error("No checkout URL returned.");
      }

      window.location.href = json.url;
    } catch (e: any) {
      setErr(e?.message || "Could not start checkout.");
      setPaying(false);
    }
  }

  const status = String(deposit?.status || "").toLowerCase();
  const isPaid = status === "paid" || success;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-lg">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
                Glass Guardian
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                Appointment Deposit
              </h1>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading deposit link…
            </div>
          ) : err ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100">
              {err}
            </div>
          ) : deposit ? (
            <div className="space-y-5">
              {isPaid && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    Deposit received
                  </div>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    Your deposit has been recorded and will be applied toward your
                    final repair total.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-slate-400">Customer</p>
                <p className="mt-1 text-lg font-semibold">
                  {deposit.customer_name}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                    <p className="text-xs text-slate-400">Deposit</p>
                    <p className="text-xl font-bold text-emerald-200">
                      {money(deposit.amount_cents)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="text-xl font-bold capitalize">
                      {isPaid ? "paid" : deposit.status}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-300">
                This deposit locks your appointment and is applied toward your
                final windshield repair invoice.
              </p>

              {status === "pending" && !success && (
                <Button
                  onClick={payDeposit}
                  disabled={paying}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay {money(deposit.amount_cents)} Deposit
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}