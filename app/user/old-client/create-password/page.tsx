// app/user/old-client/create-password/page.tsx

import { Suspense } from "react";
import OldClientCreatePasswordClient from "./OldClientCreatePasswordClient";

export default function OldClientCreatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-6 py-4 text-sm text-slate-300 shadow-xl">
            Preparing your secure Glass Guardian portal…
          </div>
        </div>
      }
    >
      <OldClientCreatePasswordClient />
    </Suspense>
  );
}