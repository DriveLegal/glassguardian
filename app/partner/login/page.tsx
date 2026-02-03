// app/partner/login/page.tsx  (Server Component)
import { Suspense } from "react";
import PartnerLoginClient from "./PartnerLoginClient";

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-200">Loading…</div>}>
      <PartnerLoginClient />
    </Suspense>
  );
}