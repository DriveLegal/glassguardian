"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { motion, useSpring, useScroll, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

import Header from "@/components/home/web/Header";
import Section from "@/components/home/Section";
import BeforeAfter from "@/components/home/BeforeAfter";
import StickyBookingCTA from "@/components/home/StickyBookingCTA";

/* Imported section components (product-ready split) */
import Billing from "@/components/sections/Billing";
import Pricing from "@/components/sections/Pricing";

/**
 * ✅ Mirror / page behavior:
 * Defer background module load so mobile Safari can paint content reliably.
 * (Does NOT change AfterSunsetStarfield code.)
 */
const AfterSunsetStarfield = dynamic(() => import("@/components/home/web/backgrounds/AfterSunsetStarfield"), {
  ssr: false,
  loading: () => null,
});

/* WindshieldCrackOut is dynamically imported to avoid heavy code on first paint */
const WindshieldCrackOut = dynamic(() => import("@/components/home/WindshieldCrackOut"), { ssr: false });

/* FX flag (default ON; set NEXT_PUBLIC_ENABLE_3D="false" to disable) */
const ENABLE_3D = (process.env.NEXT_PUBLIC_ENABLE_3D ?? "true") !== "false";

/* -------------------- tiny responsive helpers -------------------- */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", handler);
    else if (typeof (mql as any).addListener === "function") (mql as any).addListener(handler);
    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", handler);
      else if (typeof (mql as any).removeListener === "function") (mql as any).removeListener(handler);
    };
  }, [query]);
  return matches;
}

/** Desktop = wide screen + precise pointer (mouse/trackpad) */
function useIsDesktop() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const fine = useMediaQuery("(pointer: fine)");
  return wide && fine;
}

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  /* Public-only CTAs (no auth reads) */
  const goBookOrLogin = () => router.push(`/user/login?redirect=${encodeURIComponent("/user/dashboard/book")}`);
  const goLoginForWarranty = () => router.push(`/user/login?redirect=${encodeURIComponent("/user/dashboard")}`);

  /* Prefetch login route for snappy CTA */
  useEffect(() => {
    router.prefetch("/user/login");
    // Optional: prefetch signup if you link to it elsewhere later
    // router.prefetch may return void or a Promise; normalize to a Promise to safely catch errors.
    Promise.resolve(router.prefetch("/user/signup")).catch(() => {});
  }, [router]);

  /* Programmatic open for StickyBookingCTA + Billing section button */
  const openBooking = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("gg:open-booking"));
    } catch {
      // ignore
    }
  }, []);

  /**
   * ✅ IMPORTANT MOBILE FIX:
   * Your black/blank page is caused by the fixed scroll-container compositing on iOS.
   * We keep your layout, but let the WINDOW scroll (same as your working "/" page).
   */
  const { scrollYProgress } = useScroll();
  const progressWidth = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });

  const isSmall = useMediaQuery("(max-width: 640px)");
  const isDesktop = useIsDesktop();

  // Desktop-view forcing toggle (for mobile only), no persistence
  const [forceDesktop, setForceDesktop] = useState(false);

  // Viewport/meta policy, always default to mobile each load
  useEffect(() => {
    function ensureViewportMeta(): HTMLMetaElement | null {
      try {
        let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "viewport";
          document.head.appendChild(meta);
        }
        return meta;
      } catch {
        return null;
      }
    }

    const setViewport = () => {
      const meta = ensureViewportMeta();
      if (!meta) return;

      if (isDesktop) {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        document.documentElement.classList.remove("force-desktop");
        return;
      }

      const desktopWidth = 1100;
      if (forceDesktop) {
        const deviceW = Math.max(window.innerWidth, document.documentElement.clientWidth || 0);
        const scale = Math.max(0.25, Math.min(1, deviceW / desktopWidth));
        meta.setAttribute("content", `width=${desktopWidth}, initial-scale=${scale}, viewport-fit=cover`);
        document.documentElement.classList.add("force-desktop");
      } else {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        document.documentElement.classList.remove("force-desktop");
      }
    };

    setViewport();

    if (!isDesktop && forceDesktop) {
      const onResize = () => setViewport();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
      };
    }
  }, [isDesktop, forceDesktop]);

  /**
   * ✅ Anchor scrolling:
   * Since we switched back to window scrolling, scroll the WINDOW (not a container).
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const getHeaderOffset = () => {
      const css = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
      const parsed = Number(String(css || "").replace("px", "").trim());
      const fallback = 72;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const a = target.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (!href || href === "#") return;

      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();

      const headerOffset = getHeaderOffset() + 10;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;

      window.history.pushState({}, "", href);

      window.scrollTo({
        top: Math.max(0, top),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    };

    document.addEventListener("click", onClick, { passive: false });
    return () => document.removeEventListener("click", onClick as any);
  }, [reduceMotion]);

  // Lazy-mount the FX when near viewport
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false); // ✅ actually lazy now

  useEffect(() => {
    if (!previewRef.current) return;

    // Fallback: if IO not available, just mount
    if (typeof window === "undefined" || typeof (window as any).IntersectionObserver !== "function") {
      setNearViewport(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNearViewport(true);
      },
      { rootMargin: "160px 0px", threshold: [0, 0.2] } // ✅ a bit earlier so it’s ready before users see it
    );
    io.observe(previewRef.current);
    return () => io.disconnect();
  }, []);

  const copy: React.CSSProperties = { color: "var(--text)", opacity: 0.92 };
  const subCopy: React.CSSProperties = { color: "var(--text)", opacity: 0.84 };

  /* Lightweight static fallback (no canvas) */
  function StaticGlassPreview({ h }: { h: number }) {
    return (
      <div className="gradient-border premium-shell" style={{ borderRadius: 16, overflow: "hidden" }}>
        <div className="card-glass" style={{ height: h, display: "grid", placeItems: "center" }}>
          <div style={subCopy}>Windshield preview</div>
        </div>
      </div>
    );
  }

  /* Memoized data (kept if you need it elsewhere later) */
  const pricingData = useMemo(
    () => [
      { name: "Single chip", price: "$70", note: "Most common. Includes UV cure and polish." },
      { name: "Each additional chip", price: "$35", note: "Same windshield, same visit." },
      { name: "Short crack", price: "$105", note: "Subject to length and position assessment." },
    ],
    []
  );

  return (
    <main className="gg-page">
      {/* ✅ Background (mirror "/" page layering) */}
      <AfterSunsetStarfield className="z-0" density={1} intensity={1} disableComet={false} showHorizonTitan />

      {/* ✅ Depth overlays (mirror "/" pattern) */}
      <div className="gg-depth-overlays" aria-hidden="true">
        <div className="gg-depth-vignette" />
        <div className="gg-skyglow" />
        <div className="gg-grain" />
      </div>

      <motion.div className="scroll-progress" style={{ scaleX: progressWidth }} />

      {/* ✅ Header stays fixed; content scrolls underneath */}
      <Header />

      {/* ✅ Content in normal document flow (no fixed scroll container) */}
      <div className="gg-content">
        <main style={{ paddingTop: "var(--header-h, 72px)" }}>
          {/* HERO */}
          <Section id="overview" index={0} className="hero">
            <motion.div
              className="gradient-border premium-shell"
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
              style={{ padding: 24, borderRadius: 24, width: "100%", maxWidth: 1100, margin: "0 auto" }}
            >
              <div className="card-glass hero-card" style={{ padding: 36, borderRadius: 20 }}>
                <div className="hero-kicker">Mobile windshield repair</div>

                <h1 className="hero-brand" style={{ marginBottom: 8 }}>
                  Glass Guardian
                </h1>

                <h2 className="hero-title">Chip and Crack Repair</h2>

                <p className="hero-lede" style={subCopy}>
                  Mobile chip and crack repair, delivered with clean technique and consistent results. We come to you,
                  restore clarity, and back the repair with a one-year warranty.
                </p>

                <div className="hero-badges" aria-hidden>
                  <span className="pill">Fast service</span>
                  <span className="pill">Insurance-friendly</span>
                  <span className="pill">One-year warranty</span>
                </div>

                <div className="btn-row">
                  <a className="gg-btn" href="#pricing" aria-label="See pricing">
                    See Pricing
                  </a>
                  <a className="gg-btn gg-btn-ghost" href="#billing" aria-label="Insurance help">
                    Insurance Help
                  </a>
                  <button className="gg-btn" onClick={openBooking} aria-label="Book now">
                    Book Now
                  </button>
                </div>

                {/* ✅ micro CTA row (kept subtle) */}
                <div className="hero-micro-cta" aria-hidden={false}>
                  <button className="hero-micro-link" onClick={goLoginForWarranty} aria-label="Login to manage warranty">
                    Manage warranty
                  </button>
                  <span className="hero-dot" aria-hidden />
                  <button className="hero-micro-link" onClick={goBookOrLogin} aria-label="Login to book">
                    Book from account
                  </button>
                </div>
              </div>
            </motion.div>
          </Section>

          {/* AVOID CRACK-OUTS */}
          <Section id="avoid" index={1}>
            <h2 className="section-title premium-title">Avoid crack-outs</h2>
            <p className="section-sub premium-sub" style={subCopy}>
              Small chips can turn into full cracks quickly. Potholes, speed bumps, hot sun, the defroster, or even a
              firm door slam can make damage spread. Repair early to protect visibility and the factory seal.
            </p>

            <div className="two-col two-col-avoid">
              <div ref={previewRef}>
                {ENABLE_3D && nearViewport ? (
                  <Suspense fallback={<StaticGlassPreview h={isSmall ? 280 : 420} />}>
                    <WindshieldCrackOut height={isSmall ? 280 : 420} />
                  </Suspense>
                ) : (
                  <StaticGlassPreview h={isSmall ? 280 : 420} />
                )}
              </div>

              <motion.div
                className="gradient-border gg-fit-card premium-shell"
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5 }}
              >
                <div className="card-glass card-pad">
                  <h3 className="premium-h3" style={{ marginTop: 0 }}>
                    Why chips spread
                  </h3>
                  <ul className="tight-list premium-list" style={copy}>
                    <li>
                      <strong>Road shock:</strong> potholes, speed bumps, gravel chatter.
                    </li>
                    <li>
                      <strong>Temperature swings:</strong> hot sun, then A/C or defroster.
                    </li>
                    <li>
                      <strong>Body flex:</strong> driveways, uneven terrain, hard turns.
                    </li>
                    <li>
                      <strong>Door slams:</strong> sudden cabin pressure spikes.
                    </li>
                  </ul>
                  <div style={{ marginTop: 14 }}>
                    <a className="gg-btn" href="#pricing" aria-label="See pricing before damage grows">
                      Lock it in before it grows
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </Section>

          {/* SPECIALTIES */}
          <Section id="specialties" index={2}>
            <h2 className="section-title premium-title">Specialties</h2>
            <p className="section-sub premium-sub" style={subCopy}>
              Experience excellence in windshield repair at Glass Guardian. With over a decade of focused service, our
              work protects your drive with clean technique and consistent results.
            </p>

            <div className="two-col two-col-specialties">
              <motion.div
                className="gradient-border premium-shell"
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5 }}
              >
                <div className="card-glass card-pad">
                  <p className="premium-body" style={{ ...copy, marginTop: 0 }}>
                    Tired of hefty deductibles? Ask about <strong>NO COST</strong> windshield repair on qualifying
                    insurance plans. We can help set up a <em>No-Fault, glass-only claim</em> and handle the details.
                  </p>
                  <p className="premium-body" style={copy}>
                    Repairs preserve the <strong>factory seal</strong>, reduce waste, and restore optical clarity, often
                    in under an hour.
                  </p>

                  <div className="gradient-border inner-border premium-shell">
                    <div className="card-glass-solid inner-card">
                      <span className="premium-body" style={copy}>
                        Not sure you are covered? Call or text and we will check. Paying out of pocket? Pricing stays
                        simple and fair.
                      </span>
                    </div>
                  </div>

                  <p className="fineprint">Coverage varies by insurer and policy.</p>
                  <div className="btn-row">
                    <a className="gg-btn gg-btn-ghost" href="#billing" aria-label="Check insurance coverage">
                      Check Coverage
                    </a>
                    <a className="gg-btn" href="#pricing" aria-label="View pricing">
                      View Pricing
                    </a>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="gradient-border premium-shell"
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.55 }}
              >
                <div className="card-glass card-pad">
                  <ul className="tight-list premium-list" style={copy}>
                    <li>10+ years focused on chip and crack repair</li>
                    <li>Mobile service, we come to you</li>
                    <li>One-year warranty against spread on the repaired spot</li>
                    <li>Insurance-friendly and transparent pricing</li>
                    <li>Preserve the OEM seal and avoid unnecessary replacements</li>
                  </ul>
                </div>
              </motion.div>
            </div>

            <div style={{ marginTop: 18 }}>
              <BeforeAfter />
            </div>
          </Section>

          {/* ABOUT */}
          <Section id="about" index={3}>
            <h2 className="section-title premium-title">About the repair</h2>
            <p className="section-sub premium-sub" style={subCopy}>
              We inject professional-grade resin into the chip or crack, cure it with UV, then finish with precision
              polishing. The result is reinforced glass and a cleaner sightline.
            </p>

            <div className="auto-grid">
              {[
                { t: "Fast on-site service", d: "Most repairs take 20 to 40 minutes at your location." },
                {
                  t: "Optical clarity",
                  d: "Reduces the blemish significantly. Most chips improve by about 80 to 95 percent.",
                },
                { t: "Stops spreading", d: "Reinforces the glass to help prevent cracks from growing." },
              ].map((x, i) => (
                <motion.div
                  key={x.t}
                  className="gradient-border premium-shell"
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: i * 0.08, duration: 0.45 }}
                >
                  <div className="card-glass card-pad">
                    <h3 className="premium-h3" style={{ marginTop: 0 }}>
                      {x.t}
                    </h3>
                    <p className="premium-body" style={{ ...copy, marginBottom: 0 }}>
                      {x.d}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="btn-row" style={{ marginTop: 18 }}>
              <button className="gg-btn" onClick={openBooking} aria-label="Book now">
                Book Now
              </button>
            </div>
          </Section>

          {/* BILLING & INSURANCE (imported component) */}
          <section
            id="billing"
            data-gg-section="true"
            className="gg-imported-upgrade"
            style={{ scrollMarginTop: "var(--header-h, 72px)" }}
          >
            <Billing />
          </section>

          <section
            id="pricing"
            data-gg-section="true"
            className="gg-imported-upgrade"
            style={{ scrollMarginTop: "var(--header-h, 72px)" }}
          >
            <Pricing />
          </section>

          {/* Q&A */}
          <Section id="qa" index={6}>
            <h2 className="section-title premium-title">Q&amp;A</h2>
            <p className="section-sub premium-sub" style={subCopy}>
              Quick answers to common questions about chip and crack repair.
            </p>

            <div className="qa-col">
              {[
                {
                  q: "Will the blemish disappear completely?",
                  a: "Most chips become 80 to 95 percent less visible. The main goal is structural strength, stopping spread, and restoring clarity.",
                },
                {
                  q: "How long does it take?",
                  a: "Typically 20 to 40 minutes. Complex cracks can take longer depending on length and location.",
                },
                { q: "Is it safe to drive right after?", a: "Yes. The resin is UV-cured on site, so you can drive immediately." },
                {
                  q: "Do you guarantee the work?",
                  a: "Yes. We offer a one-year warranty against spread on the repaired spot. You can manage warranty details in your account.",
                },
              ].map((item, i) => (
                <motion.details
                  key={item.q}
                  className="card-glass premium-qa"
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: i * 0.06, duration: 0.45 }}
                  style={{ padding: 18, borderRadius: 16 }}
                >
                  <summary className="premium-summary">{item.q}</summary>
                  <p className="premium-body" style={{ ...copy, marginTop: 10 }}>
                    {item.a}
                  </p>
                </motion.details>
              ))}
            </div>
          </Section>

          {/* FOOTER */}
          <Section id="footer" index={7}>
            <div style={{ textAlign: "center", color: "var(--text)", opacity: 0.85, width: "100%" }}>
              <div style={{ opacity: 0.95 }}>
                © {new Date().getFullYear()} Glass Guardian | Chip &amp; Crack Repair. All rights reserved.
              </div>
            </div>
          </Section>

          {!isDesktop && (
            <div className="desktop-toggle" aria-hidden={false}>
              <button
                className="desktop-toggle-text"
                onClick={() => setForceDesktop((s) => !s)}
                aria-pressed={forceDesktop}
                aria-label={forceDesktop ? "Exit desktop view" : "Switch to desktop view"}
                title={forceDesktop ? "Exit desktop view" : "Desktop view"}
              >
                {forceDesktop ? "Exit desktop view" : "Desktop view"}
              </button>
            </div>
          )}
        </main>
      </div>

      <StickyBookingCTA
        revealOffset={0}
        hideOverFooter={false}
        message="Request a mobile chip or crack repair in minutes."
        ctaLabel="Book repair"
        subLabel="Mobile • Insurance-friendly • 1-yr warranty"
        showBar={false}
      />

      <style jsx global>{`
        :root {
          /* Premium graphite + gold */
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.78);

          --gold: #d6b35a;
          --gold-2: #f4d88b;
          --gold-deep: #9a6f25;

          --accent: var(--gold);
          --ring: rgba(244, 216, 139, 0.58);

          --bg-0: rgba(6, 5, 4, 0.985);
          --bg-1: rgba(10, 8, 6, 0.92);
          --bg-2: rgba(14, 11, 8, 0.78);

          /* Keep background visible */
          --fade-color: rgba(6, 5, 4, 0.7);
          --fade-top: 70px;
          --fade-bottom: 74px;

          /* Glow */
          --gold-glow-1: rgba(244, 216, 139, 0.2);
          --gold-glow-2: rgba(214, 179, 90, 0.18);
          --gold-glow-3: rgba(154, 111, 37, 0.12);

          /* Hover lift tuning */
          --lift: 2px;
          --tilt: 0.9deg;
        }

        /* ✅ Mirror "/" page: normal scrolling (do NOT lock html/body) */
        html {
          scroll-padding-top: var(--header-h, 72px);
          overflow-x: hidden;
          height: auto;
        }
        body {
          overflow-x: hidden;
          height: auto;
          background: #000;
        }

        section[id] {
          scroll-margin-top: var(--header-h, 72px);
        }

        /* ✅ Page shell like "/" */
        .gg-page {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          min-height: 100dvh;
          overflow: hidden;
          background: #000;
        }

        .gg-depth-overlays {
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .gg-depth-vignette {
          position: absolute;
          inset: -20%;
          background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.032), transparent 55%),
            radial-gradient(circle at 70% 18%, rgba(255, 255, 255, 0.024), transparent 58%),
            radial-gradient(circle at 50% 75%, rgba(0, 0, 0, 0.22), transparent 62%);
          opacity: 1;
          filter: blur(2px);
        }

        .gg-skyglow {
          position: absolute;
          inset: -35%;
          background: radial-gradient(circle at 22% 22%, rgba(56, 189, 248, 0.06), transparent 54%),
            radial-gradient(circle at 78% 28%, rgba(251, 191, 36, 0.06), transparent 58%),
            radial-gradient(circle at 52% 60%, rgba(167, 139, 250, 0.05), transparent 62%);
          filter: blur(28px);
          opacity: 0.85;
          mix-blend-mode: screen;
        }

        .gg-grain {
          position: absolute;
          inset: 0;
          opacity: 0.18;
          mix-blend-mode: overlay;
          pointer-events: none;
          background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px);
          background-size: 3px 3px, 4px 4px;
        }

        .gg-content {
          position: relative;
          z-index: 10;
        }

        /* progress bar stays fixed */
        .scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, rgba(154, 111, 37, 1), rgba(214, 179, 90, 1), rgba(244, 216, 139, 1));
          transform-origin: left;
          z-index: 110;
          box-shadow: 0 10px 30px rgba(214, 179, 90, 0.12);
        }
      `}</style>
    </main>
  );
}