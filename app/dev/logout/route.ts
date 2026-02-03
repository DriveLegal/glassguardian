// app/dev/logout/route.ts
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("gg_dev_role", "", { path: "/", maxAge: 0 });
  return res;
}