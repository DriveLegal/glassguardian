// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* ---------------------------------------------
   Route classification
--------------------------------------------- */

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/assets")
  );
}

function isPublicPath(pathname: string) {
  // User auth
  if (pathname === "/user/login") return true;
  if (pathname === "/user/signup") return true;
  if (pathname.startsWith("/user/old-client")) return true;

  // Tech/admin auth
  if (pathname === "/tech/login") return true;
  if (pathname === "/admin/login") return true;

  // Public marketing/legal
  if (pathname === "/") return true;
  if (pathname.startsWith("/legal")) return true;

  // DevSim routes (optional)
  if (pathname.startsWith("/dev")) return true;

  return false;
}

function isProtectedPath(pathname: string) {
  const adminProtected =
    pathname.startsWith("/admin/portal") ||
    pathname.startsWith("/admin/dashboard") ||
    pathname.startsWith("/admin/(protected)");

  const techProtected =
    pathname.startsWith("/tech/dashboard") ||
    pathname.startsWith("/tech/(protected)");

  const userProtected =
    pathname.startsWith("/user/dashboard") ||
    pathname.startsWith("/user/(protected)");

  return adminProtected || techProtected || userProtected;
}

function loginPathFor(pathname: string) {
  if (pathname.startsWith("/tech")) return "/tech/login";
  if (pathname.startsWith("/admin")) return "/admin/login";
  return "/user/login";
}

function requiredArea(pathname: string): "admin" | "tech" | "user" {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/tech")) return "tech";
  return "user";
}

type AnyObj = Record<string, any>;
function metaRole(user: AnyObj | null | undefined): string | null {
  const r = user?.app_metadata?.role ?? user?.user_metadata?.role ?? null;
  return typeof r === "string" ? r : null;
}

/* ---------------------------------------------
   Cookie security helper
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
   Helpers: preserve cookies on redirects
--------------------------------------------- */

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  // NextResponse.cookies.getAll() exists in middleware runtime
  const all = from.cookies.getAll();
  for (const c of all) {
    to.cookies.set(c.name, c.value, c);
  }
}

function redirectToLogin(req: NextRequest, pathname: string, cookieSource?: NextResponse) {
  const login = loginPathFor(pathname);
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = login;

  const fullPath = req.nextUrl.pathname + (req.nextUrl.search || "");
  redirectUrl.searchParams.set("redirect", fullPath);

  const redirectRes = NextResponse.redirect(redirectUrl);

  // ✅ critical: forward any Set-Cookie from the middleware response onto the redirect
  if (cookieSource) copyResponseCookies(cookieSource, redirectRes);

  return redirectRes;
}

/* ---------------------------------------------
   Middleware
--------------------------------------------- */

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow next internals + public assets
  if (isPublicAsset(pathname)) return NextResponse.next();

  // Public routes should pass
  if (isPublicPath(pathname)) return NextResponse.next();

  // Only guard protected areas
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToLogin(req, pathname);
  }

  // ✅ important: pass request headers through
  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        const secure = shouldUseSecureCookies(req);

        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...options,
            // ✅ don't force httpOnly=true for ALL cookies; keep what Supabase asks for
            // (forcing httpOnly can break client-side cookie reads)
            httpOnly: options?.httpOnly ?? false,
            secure: options?.secure ?? secure,
            sameSite: options?.sameSite ?? "lax",
            path: options?.path ?? "/",
          });
        });
      },
    },
  });

  // Auth check (cookie-based)
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  // 🚫 not logged in
  if (!user) {
    return redirectToLogin(req, pathname, res);
  }

  const area = requiredArea(pathname);

  // Fast path if role metadata exists
  const r = metaRole(user);
  if (area === "admin" && (r === "admin" || r === "support")) return res;
  if (area === "tech" && (r === "tech" || r === "technician")) return res;

  // Table-based authorization
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return redirectToLogin(req, pathname, res);

  if (area === "admin") {
    const { data, error } = await supabase
      .from("admins")
      .select("role,is_active")
      .eq("email", email)
      .maybeSingle();

    const ok =
      !error &&
      !!data &&
      data.is_active === true &&
      (data.role === "admin" || data.role === "support");

    if (!ok) return redirectToLogin(req, pathname, res);
    return res;
  }

  if (area === "tech") {
    const { data, error } = await supabase
      .from("technicians")
      .select("is_active")
      .eq("email", email)
      .maybeSingle();

    const ok = !error && !!data && data.is_active === true;
    if (!ok) return redirectToLogin(req, pathname, res);
    return res;
  }

  // user area -> app_users gate
  const { data, error } = await supabase
    .from("app_users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const ok = !error && !!data;
  if (!ok) return redirectToLogin(req, pathname, res);

  return res;
}

export const config = {
  matcher: ["/tech/:path*", "/user/:path*", "/admin/:path*"],
};