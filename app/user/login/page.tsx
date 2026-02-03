// app/user/(protected)/login/page.tsx  (Server Component)
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-600">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}