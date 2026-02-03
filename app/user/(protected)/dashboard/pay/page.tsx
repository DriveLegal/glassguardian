// app/user/(protected)/dashboard/pay/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

type InvoiceSummary = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  status: string;
  total_cents: number;
  customer_email: string | null;
};

const centsToDollars = (c: number | null | undefined) =>
  ((c || 0) / 100).toFixed(2);

export default function UserPayListPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  /* -------------------------------------------------------
     1) Ensure user is logged in
  ------------------------------------------------------- */
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const email = session?.user?.email ?? null;

      if (!email) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent(
            "/user/dashboard/pay"
          )}`
        );
        return;
      }

      setUserEmail(email);
      setAuthChecked(true);
    })();
  }, [router]);

  /* -------------------------------------------------------
     2) Fetch invoices for this user via customer_email
        ONLY AFTER they are actually sent (no drafts/created/null)
  ------------------------------------------------------- */
  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    error,
  } = useQuery<InvoiceSummary[]>({
    queryKey: ["user-tech-invoices", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const normalizedEmail = (userEmail ?? "").trim().toLowerCase();

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          "id, invoice_number, invoice_date, status, total_cents, customer_email"
        )
        // Only invoices associated with this user's email
        .ilike("customer_email", normalizedEmail)
        // 🔐 Only show invoices that have been sent (or later):
        //    - status must NOT be null
        //    - status must NOT be 'draft' or 'created'
        .not("status", "is", null)
        .neq("status", "draft")
        .neq("status", "created")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      return (data as InvoiceSummary[]) ?? [];
    },
    staleTime: 20_000,
  });

  /* -------------------------------------------------------
     3) Deduplicate & compute quick stats
  ------------------------------------------------------- */

  const uniqueInvoices = React.useMemo(() => {
    const seen = new Set<string>();
    const result: InvoiceSummary[] = [];

    for (const inv of invoices) {
      const key = inv.invoice_number || inv.id;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(inv);
    }

    return result;
  }, [invoices]);

  const {
    totalInvoices,
    paidCount,
    unpaidCount,
    unpaidTotalCents,
  } = React.useMemo(() => {
    const totalInvoices = uniqueInvoices.length;

    const paidInvoices = uniqueInvoices.filter(
      (inv) => (inv.status || "").toLowerCase() === "paid"
    );
    const paidCount = paidInvoices.length;

    const unpaidStatuses = [
      "unpaid",
      "open",
      "pending",
      "due",
      "outstanding",
      "awaiting_payment",
      "pending_payment",
      "sent",
    ];

    const unpaidInvoices = uniqueInvoices.filter((inv) => {
      const s = (inv.status || "").toLowerCase();
      if (s === "paid") return false;
      if (unpaidStatuses.includes(s)) return true;
      return false;
    });

    const unpaidCount = unpaidInvoices.length;
    const unpaidTotalCents = unpaidInvoices.reduce(
      (sum, inv) => sum + (inv.total_cents || 0),
      0
    );

    return {
      totalInvoices,
      paidCount,
      unpaidCount,
      unpaidTotalCents,
    };
  }, [uniqueInvoices]);

  const isLoading = !authChecked || loadingInvoices;

  /* -------------------------------------------------------
     4) Render
  ------------------------------------------------------- */

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden text-slate-50">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">

        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)]">
          <CardHeader className="pb-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <CreditCard className="w-5 h-5 text-cyan-300" />
                Invoices &amp; Payments
              </CardTitle>
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Once your technician sends your invoice, it will appear here so
              you can review work, confirm details, and pay securely.
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Loading state */}
            {isLoading && (
              <div className="py-10 flex flex-col items-center gap-3 text-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Loading invoices
                </p>
              </div>
            )}

            {/* Error state (if query failed) */}
            {!isLoading && error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
                <AlertCircle className="w-4 h-4 text-red-300" />
                <span>
                  We had trouble loading your invoices. Please try again.
                </span>
              </div>
            )}

            {/* No invoices (or none have been sent yet) */}
            {!isLoading && !error && uniqueInvoices.length === 0 && (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  You don&apos;t have any sent invoices on file yet.
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  While your technician is building estimates and drafts, those
                  stay on their side. Once an invoice is officially sent to
                  you, it will show up here for review and payment.
                </p>
              </div>
            )}

            {/* Summary + list */}
            {!isLoading && !error && uniqueInvoices.length > 0 && (
              <>
                {/* Summary row */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="uppercase tracking-wide text-[0.65rem] text-slate-500">
                        Total Invoices
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-50">
                        {totalInvoices}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-700/80 bg-emerald-950/40 px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="uppercase tracking-wide text-[0.65rem] text-emerald-200/80">
                        Paid
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-emerald-100">
                        {paidCount}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-600/80 bg-amber-950/40 px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="uppercase tracking-wide text-[0.65rem] text-amber-200/90">
                        Unpaid / Due
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-amber-100">
                        {unpaidCount}{" "}
                        <span className="text-[0.7rem] text-amber-200/80 ml-1">
                          · ${centsToDollars(unpaidTotalCents)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* List of invoices */}
                <div className="space-y-3">
                  {uniqueInvoices.map((inv) => {
                    const status = (inv.status || "").toLowerCase();
                    const isPaid = status === "paid";

                    let badgeClass =
                      "bg-slate-800/70 text-slate-100 border-slate-600/70";
                    if (isPaid) {
                      badgeClass =
                        "bg-emerald-500/15 text-emerald-200 border-emerald-400/70";
                    } else {
                      badgeClass =
                        "bg-amber-500/15 text-amber-200 border-amber-300/70";
                    }

                    let displayDate = inv.invoice_date;
                    const parsed = new Date(inv.invoice_date);
                    if (!Number.isNaN(parsed.getTime())) {
                      displayDate = parsed.toLocaleDateString();
                    }

                    return (
                      <motion.button
                        key={inv.id}
                        type="button"
                        onClick={() =>
                          router.push(`/user/dashboard/pay/${inv.id}`)
                        }
                        whileHover={{ scale: 1.01, y: -2 }}
                        transition={{
                          type: "spring",
                          stiffness: 260,
                          damping: 20,
                        }}
                        className="w-full text-left rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 flex items-center justify-between gap-4 shadow-md shadow-slate-950/50 hover:border-cyan-400/70 hover:bg-slate-900"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-50">
                            Invoice #{inv.invoice_number}
                          </p>
                          <p className="text-xs text-slate-400">
                            Service date: {displayDate}
                          </p>
                          {inv.customer_email && (
                            <p className="mt-0.5 text-[0.7rem] text-slate-500">
                              Sent to: {inv.customer_email}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-emerald-300">
                            ${centsToDollars(inv.total_cents)}
                          </p>
                          <Badge className={badgeClass}>
                            {inv.status.toUpperCase()}
                          </Badge>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}