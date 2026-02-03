// app/user/(protected)/layout.tsx
// ✅ USE YOUR EXACT CODE (NO CHANGE NEEDED)
// It stays server-only + nodejs runtime.
// The badge is mounted in UserProtectedShell client-side.

import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createSupabaseServer } from "@/lib/supabase/server";
import UserProtectedShell from "./UserProtectedShell";

function buildLoginRedirect(pathname: string, search: string) {
  const full = `${pathname}${search || ""}`;
  const qp = new URLSearchParams();
  qp.set("redirect", full);
  return `/user/login?${qp.toString()}`;
}

export default async function UserProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();

  // 1) Must have a session user
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const h = await headers();
  const pathname = h.get("x-pathname") || "/user/dashboard";
  const search = h.get("x-search") || "";

  if (!user) {
    redirect(buildLoginRedirect(pathname, search));
  }

  // 2) Must have an app_users row (RLS-safe check)
  // Use OR: auth_user_id = auth.uid OR email = auth.email (your policy supports this)
  const authUid = user.id;
  const email = (user.email ?? "").trim().toLowerCase();

  // If email missing somehow, fail closed
  if (!email) {
    redirect(buildLoginRedirect(pathname, search));
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id")
    .or(`auth_user_id.eq.${authUid},email.ilike.${email}`)
    .maybeSingle();

  // If app_users row is missing, bounce to login (bootstrap should fix on next sign-in)
  if (!appUser?.id) {
    const qp = new URLSearchParams();
    qp.set("redirect", `${pathname}${search || ""}`);
    qp.set("err", "profile_missing");
    redirect(`/user/login?${qp.toString()}`);
  }

  // 3) Render the (client) shell
  // NOTE: To make the security badge "truly bottom of each page" (not fixed),
  // mount <SecurityRail /> inside UserProtectedShell *below* the page content.
  return <UserProtectedShell>{children}</UserProtectedShell>;
}