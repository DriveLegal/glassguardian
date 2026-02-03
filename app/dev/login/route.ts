// app/dev/login/route.ts
import { NextResponse } from "next/server";
import type { DevRole } from "@/lib/devSim";

function normalizeRole(raw?: string | null): DevRole | null {
  const v = (raw || "").toLowerCase().trim();
  if (v === "user" || v === "tech" || v === "admin") return v;
  if (v === "devuser") return "user";
  if (v === "devtech") return "tech";
  if (v === "devadmin") return "admin";
  return null;
}

function routeForRole(role: DevRole): string {
  switch (role) {
    case "admin":
      return "/admin/portal";
    case "tech":
      return "/tech/dashboard";   // ← no parentheses
    default:
      return "/user/dashboard";   // ← no parentheses
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roleParam = url.searchParams.get("role");
  const keyParam = url.searchParams.get("key");

  const role = normalizeRole(roleParam);
  if (!role) {
    return NextResponse.json(
      { error: "Invalid role. Use devuser | devtech | devadmin (or user|tech|admin)." },
      { status: 400 }
    );
  }

  const envKey =
    process.env.DEV_MASTER_KEY ||
    (process.env as any).dev_master_key ||
    "";

  if (!envKey) {
    return NextResponse.json(
      { error: "DEV_MASTER_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  if (keyParam !== envKey) {
    return NextResponse.json({ error: "Invalid key." }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL(routeForRole(role), url.origin));
  res.cookies.set({
    name: "gg_dev_role",
    value: role,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(req),
    path: "/",
    maxAge: 60 * 60 * 6, // 6 hours
  });
  return res;
}

function shouldUseSecureCookies(req: Request): boolean | undefined {
  throw new Error("Function not implemented.");
}
