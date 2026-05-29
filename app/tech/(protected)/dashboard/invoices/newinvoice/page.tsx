// app/tech/(protected)/dashboard/invoices/newinvoice/page.tsx

import * as React from "react";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import NewInvoiceClient from "./NewInvoiceClient";

export default function TechNewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/40 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-sky-600/40 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-300" />
            <p className="text-sm tracking-[0.25em] uppercase text-slate-400">
              Loading invoice builder
            </p>
          </div>
        </div>
      }
    >
      <NewInvoiceClient />
    </Suspense>
  );
}