// lib/resolveRole.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "user" | "tech" | "admin";

/** Resolve role from profiles.role, with fallback to metadata.role, finally 'user'. */
export async function resolveRole(
  supabaseClient: SupabaseClient,
  userId?: string | null,
  metaRole?: string | null
): Promise<AppRole> {
  // 1) Try DB first (authoritative)
  if (userId) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const dbRole = (data as any)?.role as string | undefined;
    const dbr = (dbRole ?? "").toLowerCase();
    if (!error && (dbr === "admin" || dbr === "tech" || dbr === "user")) {
      return dbr as AppRole;
    }
  }

  // 2) Fall back to metadata
  const r = (metaRole ?? "").toLowerCase();
  if (r === "admin" || r === "tech" || r === "user") return r as AppRole;

  // 3) Default
  return "user";
}

/** Public, real URLs (no parentheses segments, no shared /dashboard). */
export function routeForRole(role: AppRole): string {
  if (role === "admin") return "/admin/portal";
  if (role === "tech")  return "/tech/dashboard";
  return "/user/dashboard";
}

/** Optional: only honor safe, absolute app-internal redirects. */
export function sanitizeRedirect(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null; // block externals
  if (raw.startsWith("//")) return null; // block protocol-relative
  return raw;
}