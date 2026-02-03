// app/dev/[role]/route.ts
import { NextResponse, NextRequest } from "next/server";

function routeFor(role: string) {
  if (role === "admin") return "/admin/portal";
  if (role === "tech") return "/tech/dashboard";
  return "/user/dashboard";
}

/**
 * Next.js 16 changes: `params` is now a Promise you must await.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  // Only allow in dev or when you hold a master key
  const isDev = process.env.NODE_ENV !== "production";
  const hasKey = !!process.env.DEV_MASTER_KEY;
  if (!isDev && !hasKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { role: rawRole } = await params;
  const role = (rawRole || "").toLowerCase();

  if (!["user", "tech", "admin"].includes(role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const res = NextResponse.redirect(new URL(routeFor(role), req.url));
  res.cookies.set("gg_dev_role", role, {
    httpOnly: false,
    sameSite: "lax",
    secure: !isDev,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

export const runtime = "edge";