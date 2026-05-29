// proxy.ts
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
  // Public marketing/legal
  if (pathname === "/") return true;
  if (pathname === "/home") return true;
  if (pathname.startsWith("/legal")) return true;

  // Public referral landing pages
  if (pathname.startsWith("/referral")) return true;

  // User auth
  if (pathname === "/user/login") return true;
  if (pathname === "/user/signup") return true;
  if (pathname.startsWith("/user/old-client")) return true;

  // Tech/admin auth
  if (pathname === "/tech/login") return true;
  if (pathname === "/admin/login") return true;

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

/**
 * Stripe return / invoice-detail pages should NOT be hard-blocked by server auth,
 * because Stripe return can race with Supabase cookie/session rehydration.
 *
 * We let these routes through proxy/layout and let the page-level auth logic
 * recover/redirect on the client side.
 */
function isSoftProtectedUserPayPath(pathname: string) {
  if (pathname === "/user/dashboard/pay/success") return true;
  if (pathname === "/user/dashboard/pay/cancel") return true;

  // /user/dashboard/pay/[id]
  if (/^\/user\/dashboard\/pay\/[^/]+$/.test(pathname)) return true;

  // /user/dashboard/pay/[id]/receipt
  if (/^\/user\/dashboard\/pay\/[^/]+\/receipt$/.test(pathname)) return true;

  return false;
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
  const all = from.cookies.getAll();
  for (const c of all) {
    to.cookies.set(c.name, c.value, c);
  }
}

function redirectToLogin(
  req: NextRequest,
  pathname: string,
  cookieSource?: NextResponse
) {
  const login = loginPathFor(pathname);
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = login;

  const fullPath = req.nextUrl.pathname + (req.nextUrl.search || "");
  redirectUrl.searchParams.set("redirect", fullPath);

  const redirectRes = NextResponse.redirect(redirectUrl);

  if (cookieSource) copyResponseCookies(cookieSource, redirectRes);

  return redirectRes;
}

/* ---------------------------------------------
   Referral helpers
--------------------------------------------- */

function buildReferralRedirect(req: NextRequest, code: string) {
  const url = req.nextUrl.clone();
  url.pathname = `/referral/${encodeURIComponent(code)}`;
  url.search = "";

  const redirectRes = NextResponse.redirect(url);

  redirectRes.cookies.set("gg_ref", code, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: shouldUseSecureCookies(req),
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return redirectRes;
}

/* ---------------------------------------------
   Proxy (formerly middleware)
--------------------------------------------- */

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (isPublicAsset(pathname)) return NextResponse.next();

  // Support legacy referral links like:
  // https://domain.com?ref=CODE
  if (pathname === "/") {
    const ref = searchParams.get("ref")?.trim();
    if (ref) {
      return buildReferralRedirect(req, ref);
    }
  }

  if (isPublicPath(pathname)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", req.nextUrl.pathname);
    requestHeaders.set("x-search", req.nextUrl.search || "");

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  // ✅ Allow Stripe return / pay-detail pages to render without hard server auth.
  if (isSoftProtectedUserPayPath(pathname)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", req.nextUrl.pathname);
    requestHeaders.set("x-search", req.nextUrl.search || "");

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToLogin(req, pathname);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  requestHeaders.set("x-search", req.nextUrl.search || "");

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        const secureDefault = shouldUseSecureCookies(req);

        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...(options ?? {}),
            secure: options?.secure ?? secureDefault,
            sameSite: options?.sameSite ?? "lax",
            path: options?.path ?? "/",
          });
        });
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return redirectToLogin(req, pathname, res);
  }

  const area = requiredArea(pathname);

  const r = metaRole(user);
  if (area === "admin" && (r === "admin" || r === "support")) return res;
  if (area === "tech" && (r === "tech" || r === "technician")) return res;

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

  /**
   * USER AREA FIX:
   * Do not hard-gate /user routes on app_users in proxy.
   * Authenticated session is enough here; bootstrap can attach/create app_users later.
   */
  return res;
}

export const config = {
  matcher: ["/", "/referral/:path*", "/tech/:path*", "/user/:path*", "/admin/:path*"],
};