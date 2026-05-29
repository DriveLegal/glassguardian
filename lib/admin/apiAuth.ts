import { createClient } from "@supabase/supabase-js";

type AnyObj = Record<string, any>;

export function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase env not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readBearerToken(req: Request) {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  return authz?.startsWith("Bearer ") ? authz.slice(7).trim() : "";
}

function hasAdminMetadata(user: AnyObj) {
  const role =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    "";

  const normalized = String(role).trim().toLowerCase();
  return normalized === "admin" || normalized === "support";
}

export async function assertAdminRequest(req: Request, admin: any) {
  const workerToken = process.env.SAFELITE_WORKER_TOKEN?.trim();
  const suppliedWorkerToken = req.headers.get("x-safelite-worker-token")?.trim();
  if (workerToken && suppliedWorkerToken && suppliedWorkerToken === workerToken) {
    return {
      ok: true as const,
      email: "safelite-worker@glassguardian.local",
      user: null,
      worker: true as const,
    };
  }

  const token = readBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: "Missing admin session." };
  }

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    return { ok: false as const, status: 401, error: "Invalid admin session." };
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) {
    return { ok: false as const, status: 401, error: "Admin email is missing." };
  }

  if (hasAdminMetadata(user as AnyObj)) {
    return { ok: true as const, email, user };
  }

  const { data: adminRow, error: adminErr } = await admin
    .from("admins")
    .select("role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (adminErr) {
    return { ok: false as const, status: 500, error: adminErr.message };
  }

  const role = String(adminRow?.role || "").trim().toLowerCase();
  const allowed = adminRow?.is_active === true && (role === "admin" || role === "support");
  if (!allowed) {
    return { ok: false as const, status: 403, error: "Admin access required." };
  }

  return { ok: true as const, email, user };
}
