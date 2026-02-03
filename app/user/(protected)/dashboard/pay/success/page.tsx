import { Suspense } from "react";
import { SuccessClient } from "./SuccessClient";

export default function UserPaySuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
          Finalizing your payment...
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}