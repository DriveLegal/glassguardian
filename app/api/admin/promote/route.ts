// app/api/admin/promote/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHARED_SECRET = process.env.ADMIN_PROMOTE_SECRET!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BodySchema = z.object({
  email: z.string().email(),
  action: z.enum(["set", "remove"]).default("set"),
  role: z.enum(["admin", "support"]).optional(),
});

function requireSecret(request: Request) {
  const h =
    request.headers.get("x-admin-secret") || request.headers.get("authorization");
  if (!h) return false;
  const token = h.startsWith("Bearer ") ? h.slice(7) : h;
  return token === SHARED_SECRET;
}

function nextAppMeta(
  current: any,
  action: "set" | "remove",
  role?: "admin" | "support"
) {
  const base = typeof current === "object" && current ? { ...current } : {};
  if (action === "remove") delete base.role;
  else base.role = role;
  return base;
}

async function findAuthUserByEmail(email: string) {
  // listUsers is the official admin approach; we filter in code
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(error.message);

  const user =
    data?.users?.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase()
    ) ?? null;

  return user;
}

/** GET: /api/admin/promote?email=you@x.com */
export async function GET(req: Request) {
  try {
    if (!requireSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const user = await findAuthUserByEmail(email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = (user.app_metadata?.role ?? user.user_metadata?.role ?? null) as
      | string
      | null;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role,
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/** POST: set/remove role */
export async function POST(req: Request) {
  try {
    if (!requireSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => ({}));
    const payload = BodySchema.parse(json);

    const { email, action, role } = payload;
    if (action === "set" && !role) {
      return NextResponse.json(
        { error: 'role is required when action is "set"' },
        { status: 400 }
      );
    }

    const user = await findAuthUserByEmail(email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const newAppMeta = nextAppMeta(user.app_metadata, action, role);

    const { data: updated, error: upErr } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: newAppMeta,
      });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      id: updated.user?.id,
      email: updated.user?.email,
      app_metadata: updated.user?.app_metadata ?? {},
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}