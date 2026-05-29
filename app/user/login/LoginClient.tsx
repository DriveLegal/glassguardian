// app/user/login/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";
const HEAVY_BG_DELAY_DESKTOP_MS = 650;
const HEAVY_BG_DELAY_MOBILE_MS = 1600;
const ENABLE_USER_MOTION_BG = true;
const ENABLE_STARFIELD = false;
const LOGO_SRC = "/branding/glass-guardian-gold.png";
const AfterSunsetStarfield = ENABLE_STARFIELD
  ? dynamic(() => import("@/components/home/web/backgrounds/AfterSunsetStarfield"), {
      ssr: false,
    })
  : null;
const UserMotionBackground = ENABLE_USER_MOTION_BG
  ? dynamic(() => import("@/components/user/background/UserMotionBackground"), {
      ssr: false,
    })
  : null;
function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") return;
  const parts = [`${name}=${encodeURIComponent(value)}`, "path=/"];
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  document.cookie = parts.join("; ");
}
function safeRedirect(path: string) {
  try {
    window.location.assign(path);
  } catch {
    window.location.href = path;
  }
}
async function safeFetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  try {
    const r = await fetch(url, init);
    const text = await r.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return { ok: r.ok, status: r.status, json };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: e?.message || "Failed to fetch",
    };
  }
}
function readMultiHashParams() {
  if (typeof window === "undefined") {
    return {
      access_token: "",
      refresh_token: "",
      type: "",
      error: "",
      error_description: "",
      error_code: "",
    };
  }
  const rawHash = (window.location.hash || "").replace(/^#/, "");
  const segs = rawHash ? rawHash.split("#") : [];
  const buckets: URLSearchParams[] = [];
  for (const seg of segs) {
    if (seg) buckets.push(new URLSearchParams(seg));
  }
  const getFirst = (k: string) => {
    for (const b of buckets) {
      const v = (b.get(k) || "").trim();
      if (v) return v;
    }
    return "";
  };
  return {
    access_token: getFirst("access_token"),
    refresh_token: getFirst("refresh_token"),
    type: getFirst("type"),
    error: getFirst("error"),
    error_description: getFirst("error_description"),
    error_code: getFirst("error_code"),
  };
}
function decodePlus(s: string) {
  try {
    return decodeURIComponent(String(s || "").replace(/\+/g, " "));
  } catch {
    return String(s || "");
  }
}
async function waitForSession(maxMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await supabaseClient.auth.getSession();
    if (data?.session?.access_token) return data.session;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}
async function bootstrapAppUser(): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await safeFetchJson("/api/user/bootstrap", { method: "POST" });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || res.json?.error || `bootstrap failed (${res.status || "network"})`,
    };
  }
  if (res.json?.ok !== true) {
    return { ok: false, error: res.json?.error || "bootstrap returned not ok" };
  }
  return { ok: true };
}
async function activatePortal(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false, error: "Missing session token" };
  const res = await safeFetchJson("/api/user/activate-portal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.error ||
        res.json?.error ||
        `activate-portal failed (${res.status || "network"})`,
    };
  }
  if (res.json?.ok !== true) {
    return {
      ok: false,
      error: res.json?.error || "activate-portal returned not ok",
    };
  }
  return { ok: true };
}
async function ensureProfile(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false, error: "Missing access token" };
  const res = await safeFetchJson("/api/profile/ensure", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ defaultRole: "user" }),
  });
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.error ||
        res.json?.error ||
        `Profile ensure failed (${res.status || "network"})`,
    };
  }
  return { ok: true };
}
async function resendConfirmation(email: string) {
  if (!email) return;
  try {
    await supabaseClient.auth.resend({ type: "signup", email });
  } catch (err) {
    console.error("Failed to resend confirmation email:", err);
  }
}
function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}
export default function LoginPage() {
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [warn, setWarn] = React.useState<string | null>(null);
  const [isTyping, setIsTyping] = React.useState(false);
  const typingTimerRef = React.useRef<number | null>(null);
  const [enhanced, setEnhanced] = React.useState(false);
  const [bgOn, setBgOn] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const [logoFailed, setLogoFailed] = React.useState(false);
  React.useEffect(() => {
    setMobile(isMobileViewport());
    const onResize = () => setMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  React.useEffect(() => {
    const t = window.setTimeout(() => setEnhanced(true), mobile ? 420 : 360);
    return () => window.clearTimeout(t);
  }, [mobile]);
  React.useEffect(() => {
    if (!ENABLE_USER_MOTION_BG && !ENABLE_STARFIELD) return;
    const delay = mobile ? HEAVY_BG_DELAY_MOBILE_MS : HEAVY_BG_DELAY_DESKTOP_MS;
    const t = window.setTimeout(() => setBgOn(true), delay);
    return () => window.clearTimeout(t);
  }, [mobile]);
  const setTypingOn = React.useCallback(() => {
    setIsTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 900);
  }, []);
  const setTypingOffSoon = React.useCallback(() => {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 350);
  }, []);
  React.useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, []);
  const rawRedirect = qp.get("redirect");
  const redirect = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/user/dashboard";
  const createdFlag = qp.get("created");
  React.useEffect(() => {
    if (createdFlag === "1") {
      setNotice("Account created. Check your email to confirm, then sign in.");
    }
  }, [createdFlag]);
  const goAfterLogin = React.useCallback(
    async (normalizedEmail: string) => {
      if (!normalizedEmail) {
        const { data } = await supabaseClient.auth.getSession();
        normalizedEmail = (data?.session?.user?.email || "").toLowerCase();
      }
      const boot = await bootstrapAppUser();
      if (!boot.ok) {
        setWarn(`Signed in, but bootstrap had an issue (${boot.error}).`);
      }
      try {
        await supabaseClient.rpc("claim_app_user_by_email");
      } catch (e) {
        console.warn("claim_app_user_by_email fallback failed:", e);
      }
      const activated = await activatePortal();
      if (!activated.ok) {
        setWarn((w) => w || `Signed in, but activation had an issue (${activated.error}).`);
      }
      const ensured = await ensureProfile();
      if (!ensured.ok) {
        setWarn((w) => w || `Heads up: profile sync had an issue (${ensured.error}).`);
      }
      if (remember && normalizedEmail) {
        setCookie("gg_remember_user", normalizedEmail, 60 * 60 * 24 * 30);
      } else {
        setCookie("gg_remember_user", "", 0);
      }
      await waitForSession(800);
      safeRedirect(redirect);
    },
    [redirect, remember]
  );
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const hp = readMultiHashParams();
        if (hp.error) {
          if (!mounted) return;
          setErr(decodePlus(hp.error_description || hp.error));
        }
        if (hp.access_token && hp.refresh_token) {
          await supabaseClient.auth
            .setSession({
              access_token: hp.access_token,
              refresh_token: hp.refresh_token,
            })
            .catch(() => {});
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.hash = "";
            window.history.replaceState({}, "", url.toString());
          }
          const sess = await waitForSession(1000);
          if (sess && mounted) {
            const normalizedEmail = (sess.user?.email || "").toLowerCase();
            if (normalizedEmail) setEmail(normalizedEmail);
            await goAfterLogin(normalizedEmail || "");
          }
        }
      } catch {
        // non-blocking
      }
    })();
    return () => {
      mounted = false;
    };
  }, [goAfterLogin]);
  React.useEffect(() => {
    const dev = qp.get("dev");
    if (!dev) return;
    if (dev === "off") {
      setCookie("gg_dev_role", "", 0);
      setNotice("DevSim disabled.");
      return;
    }
    if (dev === "user") {
      setCookie("gg_dev_role", dev, 60 * 60 * 24);
      safeRedirect(redirect);
    } else {
      setErr("Unknown dev role. Use dev=user or dev=off.");
    }
  }, [qp, redirect]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setNotice(null);
    setWarn(null);
    setLoading(true);
    let normalizedEmail = "";
    try {
      normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      const sess = await waitForSession(1200);
      const user = data?.user || sess?.user;
      if (!user) throw new Error("No user returned from auth.");
      if (user.email_confirmed_at == null && user.email?.length) {
        await resendConfirmation(normalizedEmail);
        setNotice(
          "Your account exists, but your email isn’t confirmed yet. We just sent you a fresh confirmation link — open it, confirm, then sign in."
        );
        return;
      }
      await goAfterLogin(normalizedEmail);
    } catch (e: any) {
      if (e?.code === "email_not_confirmed") {
        await resendConfirmation(normalizedEmail);
        setNotice(
          "Your account exists, but your email isn’t confirmed yet. We just sent you a fresh confirmation link — open it, confirm, then sign in."
        );
        setErr(null);
      } else {
        setErr(e?.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };
  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(!!e.getModifierState?.("CapsLock"));
    setTypingOn();
  };
  const onEmailKey = () => setTypingOn();
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;
  const signupHref = React.useMemo(() => "/user/signup", []);
  const cardInitial = prefersReducedMotion
    ? false
    : mobile
      ? { opacity: 0, y: 8 }
      : { opacity: 0, y: 14, scale: 0.985 };
  const cardAnimate = prefersReducedMotion
    ? {}
    : mobile
      ? { opacity: 1, y: 0 }
      : { opacity: 1, y: 0, scale: 1 };
  return (
    <main className="fixed inset-0 isolate h-[100dvh] w-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen bg-[radial-gradient(900px_420px_at_12%_-6%,rgba(245,200,103,0.09),transparent_62%),radial-gradient(720px_420px_at_108%_6%,rgba(255,214,128,0.07),transparent_58%),radial-gradient(760px_520px_at_50%_116%,rgba(255,255,255,0.045),transparent_64%),linear-gradient(to_bottom,rgba(3,3,3,1),rgba(8,8,8,0.985),rgba(3,3,3,1))]" />
      {ENABLE_USER_MOTION_BG && bgOn && UserMotionBackground ? (
        <div className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen overflow-hidden">
          <UserMotionBackground
            srcMp4="/user-background.mp4"
            opacity={mobile ? 0.2 : 0.34}
            blurPx={mobile ? 1 : 0}
            enableDrift={!mobile}
            driftPx={8}
            dimWhenTyping={isTyping}
            typingDimStrength={mobile ? 0.34 : 0.2}
          />
        </div>
      ) : null}
      <div
        className={[
          "pointer-events-none fixed inset-0 z-0 transition-opacity duration-500",
          isTyping ? "opacity-100" : "opacity-75 md:opacity-55",
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.16),rgba(0,0,0,0.42)_45%,rgba(0,0,0,0.72))]" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(640px_260px_at_50%_0%,rgba(255,210,120,0.085),transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(520px_220px_at_50%_100%,rgba(199,148,54,0.08),transparent_74%)]" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.3] [mask-image:radial-gradient(62%_60%_at_50%_40%,#000,transparent_82%)]">
        <div
          className={
            enhanced
              ? "absolute -top-24 -left-28 h-[31rem] w-[31rem] rounded-full bg-amber-200/12 blur-3xl"
              : "absolute -top-24 -left-28 h-[31rem] w-[31rem] rounded-full bg-amber-200/10 blur-2xl"
          }
        />
        <div
          className={
            enhanced
              ? "absolute -bottom-28 -right-24 h-[28rem] w-[28rem] rounded-full bg-yellow-100/10 blur-3xl"
              : "absolute -bottom-28 -right-24 h-[28rem] w-[28rem] rounded-full bg-yellow-100/8 blur-2xl"
          }
        />
      </div>
      {ENABLE_STARFIELD && bgOn && AfterSunsetStarfield ? (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
          <AfterSunsetStarfield />
        </div>
      ) : null}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-90">
        <div className="absolute left-[10%] top-[15%] h-1 w-1 rounded-full bg-amber-200/40 shadow-[0_0_10px_rgba(253,230,138,0.35)]" />
        <div className="absolute left-[19%] top-[28%] h-[2px] w-[2px] rounded-full bg-yellow-100/35" />
        <div className="absolute right-[14%] top-[20%] h-1 w-1 rounded-full bg-amber-100/35 shadow-[0_0_8px_rgba(251,191,36,0.28)]" />
        <div className="absolute right-[23%] top-[34%] h-[2px] w-[2px] rounded-full bg-yellow-50/30" />
        <div className="absolute left-[16%] bottom-[22%] h-[2px] w-[2px] rounded-full bg-amber-100/30" />
        <div className="absolute right-[18%] bottom-[18%] h-1 w-1 rounded-full bg-amber-200/30 shadow-[0_0_10px_rgba(251,191,36,0.24)]" />
      </div>
      <div className="relative z-10 h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
        <section className="flex min-h-[100dvh] w-full items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-8">
          <div className="w-full max-w-[420px]">
            <motion.div
              initial={cardInitial as any}
              animate={cardAnimate as any}
              transition={{ duration: mobile ? 0.22 : 0.42, ease: "easeOut" }}
              className="group relative"
            >
              <div
                className={
                  enhanced
                    ? "absolute -inset-[1.5px] rounded-[26px] bg-[linear-gradient(135deg,rgba(255,231,181,0.42),rgba(198,145,54,0.2)_28%,rgba(255,255,255,0.055)_55%,rgba(173,121,40,0.2)_78%,rgba(255,226,164,0.34))] opacity-90 blur-[1.8px] transition-opacity duration-300 group-hover:opacity-100"
                    : "absolute -inset-[1.5px] rounded-[26px] bg-[linear-gradient(135deg,rgba(255,231,181,0.32),rgba(198,145,54,0.16)_28%,rgba(255,255,255,0.04)_55%,rgba(173,121,40,0.16)_78%,rgba(255,226,164,0.26))] opacity-80"
                }
              />
              <div
                className={
                  enhanced
                    ? "absolute -inset-[2px] rounded-[26px] bg-[radial-gradient(circle_at_top,rgba(255,220,145,0.1),transparent_45%),linear-gradient(to_bottom_right,rgba(255,255,255,0.095),rgba(255,255,255,0.018))] backdrop-blur-xl"
                    : "absolute -inset-[2px] rounded-[26px] bg-[linear-gradient(to_bottom_right,rgba(255,255,255,0.07),rgba(255,255,255,0.015))]"
                }
              />
              <motion.section
                whileHover={
                  prefersReducedMotion || mobile
                    ? {}
                    : { rotateX: 0.35, rotateY: -0.35, y: -2 }
                }
                className={
                  enhanced
                    ? "relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,22,0.94),rgba(9,9,9,0.94))] shadow-[0_24px_70px_rgba(0,0,0,0.62),0_10px_24px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-2xl"
                    : "relative overflow-hidden rounded-[24px] border border-white/9 bg-[linear-gradient(180deg,rgba(20,20,20,0.92),rgba(10,10,10,0.92))] shadow-[0_18px_42px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]"
                }
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,241,204,0.085),transparent)]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_120px_at_50%_0%,rgba(255,207,112,0.085),transparent_72%)]" />
                <div className="relative rounded-[24px] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015)_32%,rgba(255,221,160,0.025)_62%,rgba(255,255,255,0.01))] p-4 min-[380px]:p-5 sm:p-6">
                  <div className="mb-4 flex flex-col items-center text-center">
                    <div className="mb-3 flex items-center justify-center">
                      {!logoFailed ? (
                        <img
                          src={LOGO_SRC}
                          alt="Glass Guardian"
                          className="h-14 w-auto object-contain drop-shadow-[0_12px_30px_rgba(245,190,80,0.18)]"
                          onError={() => setLogoFailed(true)}
                        />
                      ) : (
                        <ShieldCheck className="h-10 w-10 text-amber-100" />
                      )}
                    </div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/12 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/72">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
                      User Portal
                    </div>
                    <h1 className="text-[1.55rem] font-black leading-tight tracking-tight text-white min-[380px]:text-[1.75rem] sm:text-3xl">
                      Welcome back
                    </h1>
                    <p className="mt-1 max-w-[320px] text-sm leading-5 text-white/62">
                      Sign in to view your appointments, invoices, deposits, and warranty info.
                    </p>
                  </div>
                  {err && (
                    <div className="mb-3 rounded-2xl border border-red-400/25 bg-red-500/12 px-3 py-2 text-sm leading-5 text-red-100 shadow-sm">
                      {err}
                    </div>
                  )}
                  {warn && !err && (
                    <div className="mb-3 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm leading-5 text-amber-100 shadow-sm">
                      {warn}
                    </div>
                  )}
                  {notice && (
                    <div className="mb-3 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm leading-5 text-emerald-100 shadow-sm">
                      {notice}
                    </div>
                  )}
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-white/80">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/40" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setTypingOn();
                          }}
                          onFocus={() => setIsTyping(true)}
                          onBlur={setTypingOffSoon}
                          onKeyDown={onEmailKey}
                          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-10 pr-3 text-[16px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] outline-none transition placeholder:text-white/32 focus:border-amber-300/50 focus:bg-white/[0.075] focus:ring-2 focus:ring-amber-300/25 sm:h-12"
                          placeholder="you@example.com"
                          autoComplete="email"
                          inputMode="email"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="mb-1.5 block text-sm font-semibold text-white/80">
                          Password
                        </label>
                        {capsLock && (
                          <span className="mb-1.5 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-100">
                            Caps Lock ON
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/40" />
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setTypingOn();
                          }}
                          onFocus={() => setIsTyping(true)}
                          onBlur={setTypingOffSoon}
                          onKeyUp={onPasswordKey}
                          onKeyDown={onPasswordKey}
                          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-10 pr-12 text-[16px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] outline-none transition placeholder:text-white/32 focus:border-amber-300/50 focus:bg-white/[0.075] focus:ring-2 focus:ring-amber-300/25 sm:h-12"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((s) => !s)}
                          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-white/55 transition active:scale-95 hover:bg-white/7 hover:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/35"
                          aria-label={showPass ? "Hide password" : "Show password"}
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="inline-flex select-none items-center gap-2 text-sm text-white/76">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-300/40"
                        />
                        Remember me
                      </label>
                      <Link
                        href="/user/forgot-password"
                        className="text-sm font-medium text-amber-100/85 underline underline-offset-4 transition active:scale-[0.98] hover:text-amber-50"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="h-11 w-full rounded-2xl border border-amber-200/14 bg-[linear-gradient(180deg,rgba(232,181,82,0.98),rgba(168,116,36,0.98))] text-[15px] font-black text-black shadow-[0_16px_34px_rgba(145,98,28,0.28),inset_0_1px_0_rgba(255,248,220,0.42)] transition active:scale-[0.985] hover:bg-[linear-gradient(180deg,rgba(242,194,97,1),rgba(180,128,44,1))] disabled:cursor-not-allowed disabled:opacity-60 sm:h-12"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/45 border-t-transparent" />
                          Signing in…
                        </span>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={signupHref}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200/12 bg-amber-300/[0.065] px-3 text-sm font-semibold text-amber-100/88 transition active:scale-[0.985] hover:bg-amber-300/[0.1] hover:text-amber-50 sm:h-11"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create Account
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.035] px-3 text-sm font-semibold text-white/66 transition active:scale-[0.985] hover:bg-white/[0.06] hover:text-white sm:h-11"
                    >
                      Home
                    </Link>
                  </div>
                </div>
              </motion.section>
            </motion.div>
            <p className="mx-auto mt-3 max-w-sm px-4 text-center text-[11px] leading-4 text-white/52 sm:text-xs sm:leading-5">
              By continuing you agree to our{" "}
              <Link
                href="/legal/terms"
                className="font-semibold text-amber-200 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-100"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy"
                className="font-semibold text-amber-200 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-100"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.045] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
        }}
      />
    </main>
  );
}