// app/user/reset-password/page.tsx
import * as React from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[100dvh] grid place-items-center bg-slate-950 text-white">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              <span className="text-sm text-white/80">Verifying reset link…</span>
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordClient />
    </React.Suspense>
  );
}