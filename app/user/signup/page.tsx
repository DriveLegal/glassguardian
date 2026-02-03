// app/signup/page.tsx  (Server Component)
import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
      <SignupClient />
    </Suspense>
  );
}