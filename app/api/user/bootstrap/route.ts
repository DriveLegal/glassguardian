// app/api/user/bootstrap/route.ts
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/* ---------------------------------------------
   Cookie security helper (match middleware)
--------------------------------------------- */
function shouldUseSecureCookies(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").toLowerCase();

  // localhost + common LAN dev hosts => NEVER secure
  if (
    host.includes("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.16.") ||
    host.startsWith("172.17.") ||
    host.startsWith("172.18.") ||
    host.startsWith("172.19.") ||
    host.startsWith("172.2") || // covers 172.20-172.31 too
    host.endsWith(".local")
  ) {
    return false;
  }

  const xfProto = req.headers.get("x-forwarded-proto");
  if (xfProto) return xfProto === "https";

  return req.nextUrl.protocol === "https:";
}

/* ---------------------------------------------
   Name helpers
--------------------------------------------- */
function safeNameFromEmail(email: string) {
  const left = (email.split("@")[0] || "").trim();
  if (!left) return "Customer";
  const pretty = left
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || "Customer";
}

function metaFullName(meta: any) {
  const full =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (typeof meta?.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta?.first_name === "string" || typeof meta?.last_name === "string"
      ? [meta?.first_name, meta?.last_name].filter(Boolean).join(" ").trim()
      : "");

  return full || "";
}

/* ---------------------------------------------
   Response builder that preserves cookies
--------------------------------------------- */
type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

function buildJsonResponse(
  req: NextRequest,
  payload: any,
  status: number,
  cookiesToSet: CookieToSet[]
) {
  const res = NextResponse.json(payload, { status });

  const secure = shouldUseSecureCookies(req);

  for (const c of cookiesToSet) {
    res.cookies.set(c.name, c.value, {
      ...(c.options ?? {}),
      // ✅ do NOT force httpOnly=true (breaks JS cookie strategy in dev)
      httpOnly: c.options?.httpOnly ?? false,
      secure: c.options?.secure ?? secure,
      sameSite: c.options?.sameSite ?? "lax",
      path: c.options?.path ?? "/",
    });
  }

  return res;
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Collect cookies Supabase wants to set, then attach to *every* response.
  const cookiesToSet: CookieToSet[] = [];

  if (!supabaseUrl || !anon) {
    return buildJsonResponse(
      req,
      { ok: false, error: "Missing Supabase public env vars." },
      500,
      cookiesToSet
    );
  }
  if (!service) {
    return buildJsonResponse(
      req,
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      500,
      cookiesToSet
    );
  }

  // Cookie-aware SSR client: identifies current user from cookies
  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(nextCookies) {
        nextCookies.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  const { data: u } = await supabase.auth.getUser();
  const user = u?.user ?? null;

  if (!user) {
    return buildJsonResponse(req, { ok: false, error: "Not authenticated." }, 401, cookiesToSet);
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return buildJsonResponse(req, { ok: false, error: "Auth email missing." }, 400, cookiesToSet);
  }

  // Service role client bypasses RLS
  const admin = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();
  const meta = user.user_metadata ?? {};
  const resolvedName = metaFullName(meta) || safeNameFromEmail(email);

  // 1) Find by auth_user_id
  const { data: byAuth, error: e1 } = await admin
    .from("app_users")
    .select("id,email,auth_user_id,full_name,portal_activated_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (e1) {
    return buildJsonResponse(req, { ok: false, error: e1.message }, 400, cookiesToSet);
  }

  if (byAuth?.id) {
    const patch: any = {};

    if ((byAuth.email ?? "").toLowerCase() !== email) patch.email = email;
    if (!byAuth.full_name || String(byAuth.full_name).trim() === "") patch.full_name = resolvedName;
    if (!byAuth.portal_activated_at) patch.portal_activated_at = nowIso;

    if (Object.keys(patch).length) {
      const { error: upErr } = await admin.from("app_users").update(patch).eq("id", byAuth.id);
      if (upErr) {
        return buildJsonResponse(req, { ok: false, error: upErr.message }, 400, cookiesToSet);
      }
    }

    return buildJsonResponse(
      req,
      { ok: true, action: "exists", app_user_id: byAuth.id },
      200,
      cookiesToSet
    );
  }

  // 2) Find by email
  const { data: byEmail, error: e2 } = await admin
    .from("app_users")
    .select("id,email,auth_user_id,full_name,portal_activated_at")
    .ilike("email", email)
    .maybeSingle();

  if (e2) {
    return buildJsonResponse(req, { ok: false, error: e2.message }, 400, cookiesToSet);
  }

  if (byEmail?.id) {
    const patch: any = { auth_user_id: user.id };

    if (!byEmail.full_name || String(byEmail.full_name).trim() === "") patch.full_name = resolvedName;
    if (!byEmail.portal_activated_at) patch.portal_activated_at = nowIso;

    const { error: upErr } = await admin.from("app_users").update(patch).eq("id", byEmail.id);
    if (upErr) {
      return buildJsonResponse(req, { ok: false, error: upErr.message }, 400, cookiesToSet);
    }

    return buildJsonResponse(
      req,
      { ok: true, action: "attached_auth_user_id", app_user_id: byEmail.id },
      200,
      cookiesToSet
    );
  }

  // 3) Create brand new row
  const { data: created, error: insErr } = await admin
    .from("app_users")
    .insert({
      email,
      auth_user_id: user.id,
      full_name: resolvedName,
      portal_activated_at: nowIso,
    })
    .select("id")
    .single();

  if (insErr || !created?.id) {
    return buildJsonResponse(
      req,
      { ok: false, error: insErr?.message || "Insert failed" },
      400,
      cookiesToSet
    );
  }

  return buildJsonResponse(
    req,
    { ok: true, action: "created", app_user_id: created.id },
    200,
    cookiesToSet
  );
}