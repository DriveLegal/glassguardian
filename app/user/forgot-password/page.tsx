// app/user/forgot-password/page.tsx
import * as React from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[100dvh] grid place-items-center bg-slate-950 text-slate-100">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              <span className="text-sm text-white/80">Loading…</span>
            </div>
          </div>
        </div>
      }
    >
      <ForgotPasswordClient />
    </React.Suspense>
  );
}