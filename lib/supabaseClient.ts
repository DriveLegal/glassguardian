// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Browser cookie helpers
 * - Supabase SSR stores session in cookies so Middleware / Server Components can read it.
 * - NOTE: HttpOnly cookies are not readable in JS (by design) — that's OK.
 */
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(
  name: string,
  value: string,
  opts?: {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  }
) {
  if (typeof document === "undefined") return;

  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${opts?.path ?? "/"}`);

  if (opts?.domain) parts.push(`Domain=${opts.domain}`);

  const sameSite = opts?.sameSite ?? "lax";
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);

  // Secure default: true on https, false on http (localhost)
  const secure =
    typeof opts?.secure === "boolean"
      ? opts.secure
      : typeof window !== "undefined"
        ? window.location.protocol === "https:"
        : false;

  // If SameSite=None, Secure MUST be set by browsers
  if (sameSite === "none") {
    parts.push("Secure");
  } else if (secure) {
    parts.push("Secure");
  }

  if (typeof opts?.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts?.expires instanceof Date) parts.push(`Expires=${opts.expires.toUTCString()}`);

  document.cookie = parts.join("; ");
}

function deleteCookie(name: string) {
  setCookie(name, "", { maxAge: 0, path: "/" });
}

export const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookies: {
    get(name) {
      return getCookie(name) ?? undefined;
    },
    set(name, value, options) {
      setCookie(name, value, {
        maxAge: typeof options?.maxAge === "number" ? options.maxAge : undefined,
        expires: options?.expires,
        path: options?.path ?? "/",
        domain: (options as any)?.domain,
        sameSite:
          (options?.sameSite as any) === "strict"
            ? "strict"
            : (options?.sameSite as any) === "none"
              ? "none"
              : "lax",
        secure: typeof options?.secure === "boolean" ? options.secure : undefined,
      });
    },
    remove(name) {
      deleteCookie(name);
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    /**
     * ✅ IMPORTANT for Supabase email links / invites:
     * Supabase redirects with tokens in the URL fragment (#access_token=...).
     * This MUST be true so the browser client can detect + persist the session cookie.
     */
    detectSessionInUrl: true,
  },
});