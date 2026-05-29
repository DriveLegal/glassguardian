// app/user/(protected)/layout.tsx
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createSupabaseServer } from "@/lib/supabase/server";
import UserProtectedShell from "./UserProtectedShell";

/**
 * ✅ Key change:
 * - Keep this layout STRICTLY auth-gated for most protected user routes.
 * - BUT allow Stripe return / invoice-detail pages through without hard server auth,
 *   because Stripe return can race with Supabase cookie/session availability.
 *
 * Those pages already do client-side auth recovery / redirect logic.
 */

function buildLoginRedirect(
  pathname: string,
  search: string,
  extra?: Record<string, string>
) {
  const full = `${pathname}${search || ""}`;
  const qp = new URLSearchParams();
  qp.set("redirect", full);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) qp.set(k, v);
  }
  return `/user/login?${qp.toString()}`;
}

function isSoftProtectedUserPayPath(pathname: string) {
  if (pathname === "/user/dashboard/pay/success") return true;
  if (pathname === "/user/dashboard/pay/cancel") return true;

  // /user/dashboard/pay/[id]
  if (/^\/user\/dashboard\/pay\/[^/]+$/.test(pathname)) return true;

  // /user/dashboard/pay/[id]/receipt
  if (/^\/user\/dashboard\/pay\/[^/]+\/receipt$/.test(pathname)) return true;

  return false;
}

export default async function UserProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/user/dashboard";
  const search = h.get("x-search") || "";

  // ✅ Let Stripe return / invoice-detail pages render without hard server auth.
  // Their page-level logic will recover or redirect on the client side.
  if (isSoftProtectedUserPayPath(pathname)) {
    return <UserProtectedShell>{children}</UserProtectedShell>;
  }

  const supabase = await createSupabaseServer();

  // 1) Must have a session user (this is the only hard gate here)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    redirect(
      buildLoginRedirect(pathname, search, {
        err: userErr ? "auth_user_failed" : "no_session",
      })
    );
  }

  // 2) Optional soft-check: if email is missing, still fail closed (should never happen)
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    redirect(buildLoginRedirect(pathname, search, { err: "email_missing" }));
  }

  // 3) Render the (client) shell
  // NOTE: app_users linking/creation is handled by /api/user/bootstrap (service role) after login.
  // Keeping this layout free of app_users gating prevents redirect loops.
  return <UserProtectedShell>{children}</UserProtectedShell>;
}