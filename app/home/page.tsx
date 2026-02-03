// app/home/page.tsx
"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import { motion, useSpring, useScroll } from "framer-motion";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Background from "@/components/home/Background";
import Section from "@/components/home/Section";
import BeforeAfter from "@/components/home/BeforeAfter";
import StickyBookingCTA from "@/components/home/StickyBookingCTA";

/* 🔹 WindshieldCrackOut is dynamically imported to avoid heavy code on first paint */
const WindshieldCrackOut = dynamic(
  () => import("@/components/home/WindshieldCrackOut"),
  { ssr: false }
);

/* 🔹 FX flag (default ON; set NEXT_PUBLIC_ENABLE_3D="false" to disable) */
const ENABLE_3D =
  (process.env.NEXT_PUBLIC_ENABLE_3D ?? "true") !== "false";

/* -------------------- tiny responsive helpers -------------------- */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    if (typeof mql.addEventListener === "function")
      mql.addEventListener("change", handler);
    else if (typeof mql.addListener === "function")
      mql.addListener(handler);
    return () => {
      if (typeof mql.removeEventListener === "function")
        mql.removeEventListener("change", handler);
      else if (typeof mql.removeListener === "function")
        mql.removeListener(handler);
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

  /* ---------- Public-only CTAs (no auth reads) ---------- */
  const goBookOrLogin = () =>
    router.push(
      `/user/login?redirect=${encodeURIComponent("/user/dashboard/book")}`
    );

  const goLoginForWarranty = () =>
    router.push(
      `/user/login?redirect=${encodeURIComponent("/user/dashboard")}`
    );

  /* Prefetch login route for snappy CTA */
  useEffect(() => {
    router.prefetch("/user/login");
  }, [router]);

  /* 🔹 Programmatic open for StickyBookingCTA */
  const openBooking = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("gg:open-booking"));
    } catch {
      // ignore
    }
  }, []);

  const { scrollYProgress } = useScroll();
  const progressWidth = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
  });

  const isSmall = useMediaQuery("(max-width: 640px)");
  const isDesktop = useIsDesktop();

  // Desktop-view forcing toggle (for *mobile only*), no persistence
  const [forceDesktop, setForceDesktop] = useState(false);

  // Viewport/meta policy – always default to mobile each load
  useEffect(() => {
    function ensureViewportMeta(): HTMLMetaElement | null {
      try {
        let meta = document.querySelector(
          'meta[name="viewport"]'
        ) as HTMLMetaElement | null;
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
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1, viewport-fit=cover"
        );
        document.documentElement.classList.remove("force-desktop");
        return;
      }

      const desktopWidth = 1100;
      if (forceDesktop) {
        const deviceW = Math.max(
          window.innerWidth,
          document.documentElement.clientWidth || 0
        );
        const scale = Math.max(0.25, Math.min(1, deviceW / desktopWidth));
        meta.setAttribute(
          "content",
          `width=${desktopWidth}, initial-scale=${scale}, viewport-fit=cover`
        );
        document.documentElement.classList.add("force-desktop");
      } else {
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1, viewport-fit=cover"
        );
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

  // Lazy-mount the FX when near viewport
  const previewRef = useRef<HTMLDivElement | null>(null);
  // Default TRUE so demo renders immediately; observer keeps it true thereafter.
  const [nearViewport, setNearViewport] = useState(true);

  useEffect(() => {
    if (!previewRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNearViewport(true);
      },
      { rootMargin: "80px 0px", threshold: [0, 0.2] }
    );
    io.observe(previewRef.current);
    return () => io.disconnect();
  }, []);

  const copy: React.CSSProperties = { color: "var(--text)", opacity: 0.95 };
  const subCopy: React.CSSProperties = { color: "var(--text)", opacity: 0.88 };

  /* 🔹 Lightweight static fallback (no canvas) */
  function StaticGlassPreview({ h }: { h: number }) {
    return (
      <div
        className="gradient-border"
        style={{ borderRadius: 16, overflow: "hidden" }}
      >
        <div
          className="card-glass"
          style={{
            height: h,
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(1200px 600px at 20% 10%, rgba(96,165,250,0.20), transparent 60%), radial-gradient(1000px 500px at 80% 120%, rgba(14,165,233,0.18), transparent 55%)",
          }}
        >
          <div style={subCopy}>Windshield preview</div>
        </div>
      </div>
    );
  }

  /* 🔹 Memoized data */
  const pricingData = useMemo(
    () => [
      {
        name: "Single chip",
        price: "$60",
        note: "Most common. Includes UV cure & polish.",
      },
      {
        name: "Each add’l chip",
        price: "$25",
        note: "Same windshield, same visit.",
      },
      {
        name: "Short crack",
        price: "$100",
        note: "Subject to length/position assessment.",
      },
    ],
    []
  );

  return (
    <>
      <Background />

      <motion.div
        className="scroll-progress"
        style={{ scaleX: progressWidth }}
      />
      <Header />
      <div className="fade-top" aria-hidden />
      <div className="fade-bottom" aria-hidden />

      {/* Add top space equal to the live header height */}
      <main style={{ paddingTop: "var(--header-h, 72px)" }}>
        {/* HERO */}
        <Section id="overview" index={0} className="hero">
          <motion.div
            className="gradient-border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              padding: 24,
              borderRadius: 24,
              width: "100%",
              maxWidth: 1100,
              margin: "0 auto",
            }}
          >
            <div
              className="card-glass"
              style={{
                padding: 36,
                borderRadius: 20,
              }}
            >
              <h1 style={{ marginBottom: 6, color: "var(--text)" }}>
                Glass Guardian
              </h1>
              <h2
                style={{
                  marginTop: 0,
                  fontSize: "clamp(26px, 6vw, 42px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "var(--text)",
                  opacity: 0.98,
                }}
              >
                Chip and Crack Repair
              </h2>

              <p style={subCopy}>
                Mobile chip &amp; crack repair done right —
                insurance-friendly, fast, and guaranteed. We come to you,
                restore clarity, and back it with a 1 year warranty.
              </p>
              <div className="btn-row">
                <a className="gg-btn" href="#pricing">
                  See Price
                </a>
                <a className="gg-btn" href="#billing">
                  Insurance
                </a>
                <button className="gg-btn" onClick={openBooking}>
                  Book
                </button>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* AVOID CRACK-OUTS */}
        <Section id="avoid" index={1}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>
            Avoid crack-outs
          </h2>
          <p className="section-sub" style={subCopy}>
            Small chips turn into large cracks fast. Potholes and speed
            bumps, hot sun or the defroster, even a firm door-slam can
            make damage spread. Repair now to protect visibility and the
            factory seal.
          </p>

          <div className="two-col two-col-avoid">
            <div ref={previewRef}>
              {/* Mount Canvas demo if flag is ON and section is near/in view */}
              {ENABLE_3D && nearViewport ? (
                <Suspense
                  fallback={
                    <StaticGlassPreview h={isSmall ? 280 : 420} />
                  }
                >
                  <WindshieldCrackOut height={isSmall ? 280 : 420} />
                </Suspense>
              ) : (
                <StaticGlassPreview h={isSmall ? 280 : 420} />
              )}
            </div>

            <motion.div
              className="gradient-border"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="card-glass card-pad">
                <h3 style={{ marginTop: 0, color: "var(--text)" }}>
                  Why chips spread
                </h3>
                <ul className="tight-list" style={copy}>
                  <li>
                    <strong>Road shock:</strong> potholes, speed bumps,
                    gravel chatter.
                  </li>
                  <li>
                    <strong>Temp swings:</strong> hot sun → A/C or
                    defroster → thermal stress.
                  </li>
                  <li>
                    <strong>Body flex:</strong> driveways, uneven
                    terrain, hard turns.
                  </li>
                  <li>
                    <strong>Door slams:</strong> sudden cabin pressure
                    spikes.
                  </li>
                </ul>
                <div style={{ marginTop: 14 }}>
                  <a className="gg-btn" href="#pricing">
                    Fix it before it grows
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </Section>

        {/* SPECIALTIES */}
        <Section id="specialties" index={2}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>
            Specialties
          </h2>
          <p className="section-sub" style={subCopy}>
            Experience excellence in windshield repair at Glass Guardian
            Chip &amp; Crack Repair. With over a decade of dedicated
            service, our expertise protects your driving experience with
            precision.
          </p>

        <div className="two-col two-col-specialties">
          <motion.div
            className="gradient-border"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="card-glass card-pad">
              <p style={{ ...copy, marginTop: 0 }}>
                Tired of hefty deductibles? Ask about{" "}
                <strong>NO COST</strong> windshield repair* on
                qualifying insurance plans. We’ll help set up a{" "}
                <em>NoFault Glass-Only Claim</em> and handle the
                details.
              </p>
              <p style={copy}>
                Repairs preserve the <strong>factory seal</strong>,
                reduce waste, and restore optical clarity — often in
                under an hour.
              </p>
              <div className="gradient-border inner-border">
                <div className="card-glass-solid inner-card">
                  <span style={copy}>
                    Not sure you’re covered? Call or text and we’ll
                    check. Paying out of pocket? Our pricing is simple
                    and fair.
                  </span>
                </div>
              </div>
              <p className="fineprint">
                *Coverage varies by insurer and policy.
              </p>
              <div className="btn-row">
                <a className="gg-btn" href="#billing">
                  Check Insurance
                </a>
                <a className="gg-btn" href="#pricing">
                  Out-of-Pocket Pricing
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="gradient-border"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="card-glass card-pad">
              <ul className="tight-list" style={copy}>
                <li>10+ years focused on chip &amp; crack repair</li>
                <li>Mobile service — we come to you</li>
                <li>
                  1 year warranty against spread on the repaired spot
                </li>
                <li>Insurance-friendly &amp; transparent pricing</li>
                <li>
                  Preserve OEM seal; avoid unnecessary replacements
                </li>
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
        <h2 className="section-title" style={{ color: "var(--text)" }}>
          About the repair
        </h2>
        <p className="section-sub" style={subCopy}>
          We inject professional-grade resin into the chip/crack, cure
          it with UV, and finish with precision polishing. The result:
          structurally reinforced glass and dramatically reduced
          visibility.
        </p>

        <div className="auto-grid">
          {[
            {
              t: "Fast on-site service",
              d: "Most repairs 20–40 minutes at your location.",
            },
            {
              t: "Optical clarity",
              d: "Reduces the blemish significantly; most chips ~80–95% improved.",
            },
            {
              t: "Stops spreading",
              d: "Reinforces the glass to help prevent cracks from growing.",
            },
          ].map((x, i) => (
            <motion.div
              key={x.t}
              className="gradient-border"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
            >
              <div className="card-glass card-pad">
                <h3
                  style={{ marginTop: 0, color: "var(--text)" }}
                >
                  {x.t}
                </h3>
                <p style={{ ...copy, marginBottom: 0 }}>{x.d}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Book button in About section */}
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="gg-btn" onClick={openBooking}>
            Book
          </button>
        </div>
      </Section>

      {/* BILLING & INSURANCE */}
      <Section id="billing" index={4}>
        <h2 className="section-title" style={{ color: "var(--text)" }}>
          Billing &amp; insurance
        </h2>
        <p className="section-sub" style={subCopy}>
          We work with major insurers for chip &amp; crack repair.
          Many policies waive deductibles for repairs. Prefer to pay
          out of pocket? No problem — transparent, flat pricing below.
        </p>

        <motion.div
          className="gradient-border"
          style={{ padding: 2, borderRadius: 20 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card-glass card-pad">
            <ul className="tight-list" style={copy}>
              <li>Guidance with NoFault Glass-Only Claims</li>
              <li>Direct-to-insurer billing support (where applicable)</li>
              <li>Digital receipts for quick reimbursement</li>
              <li>Instant PDF invoice by email</li>
            </ul>
            <div className="btn-row">
              <a className="gg-btn" href="#pricing">
                See out-of-pocket price
              </a>
              {/* Public CTA: always sends to login with redirect */}
              <button className="gg-btn" onClick={goLoginForWarranty}>
                Login for warranty
              </button>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* PRICING */}
      <Section id="pricing" index={5}>
        <h2 className="section-title" style={{ color: "var(--text)" }}>
          Price
        </h2>
        <p className="section-sub" style={subCopy}>
          Straightforward, no surprises. Multiple chips in the same
          visit are discounted.
        </p>

        <div className="auto-grid pricing-grid">
          {pricingData.map((p, i) => (
            <motion.div
              key={p.name}
              className="gradient-border"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="card-glass card-pad">
                <div className="price-row" style={copy}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <div className="price-tag">{p.price}</div>
                </div>
                <p style={copy}>{p.note}</p>
                {/* Open StickyBookingCTA */}
                <button className="gg-btn" onClick={openBooking}>
                  Book
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Q&A */}
      <Section id="qa" index={6}>
        <h2 className="section-title" style={{ color: "var(--text)" }}>
          Q&amp;A
        </h2>
        <p className="section-sub" style={subCopy}>
          Answers to common questions about chip &amp; crack repair.
        </p>
        <div className="qa-col">
          {[
            {
              q: "Will the blemish disappear completely?",
              a: "Most chips become 80–95% less visible. The main goal is structural: stop spreading and restore strength.",
            },
            {
              q: "How long does it take?",
              a: "Typically 20–40 minutes. Complex cracks can take longer depending on length and position.",
            },
            {
              q: "Is it safe to drive right after?",
              a: "Yes. The resin is UV-cured on site; you can drive immediately.",
            },
            {
              q: "Do you guarantee the work?",
              a: "1 year warranty against spread on the repaired spot. Manage warranty details in your account.",
            },
          ].map((item, i) => (
            <motion.details
              key={item.q}
              className="card-glass"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              style={{ padding: 18, borderRadius: 16 }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {item.q}
              </summary>
              <p style={{ ...copy, marginTop: 10 }}>{item.a}</p>
            </motion.details>
          ))}
        </div>
      </Section>

      {/* FOOTER */}
      <Section id="footer" index={7}>
        <div
          style={{
            textAlign: "center",
            color: "var(--text)",
            opacity: 0.85,
            width: "100%",
          }}
        >
          <div style={{ opacity: 0.95 }}>
            © {new Date().getFullYear()} Glass Guardian — Chip &amp;
            Crack Repair • All rights reserved.
          </div>
        </div>
      </Section>

      {/* Desktop view toggle lives at TRUE bottom of page, not fixed */}
      {!isDesktop && (
        <div className="desktop-toggle" aria-hidden={false}>
          <button
            className="desktop-toggle-text"
            onClick={() => setForceDesktop((s) => !s)}
            aria-pressed={forceDesktop}
            aria-label={
              forceDesktop ? "Exit desktop view" : "Switch to desktop view"
            }
            title={forceDesktop ? "Exit desktop view" : "Desktop view"}
          >
            {forceDesktop ? "Exit desktop view" : "Desktop view"}
          </button>
        </div>
      )}
    </main>

    {/* Sticky CTA – panel only, NO bottom footer bar */}
    <StickyBookingCTA
      revealOffset={0}
      hideOverFooter={false}
      message="Request a mobile chip or crack repair in minutes."
      ctaLabel="Book repair"
      subLabel="Mobile • Insurance-friendly • 1-yr warranty"
      showBar={false}
    />

    {/* -------------------- responsive polish CSS -------------------- */}
    <style jsx global>{`
      html {
        scroll-padding-top: var(--header-h, 72px);
      }
      section[id] {
        scroll-margin-top: var(--header-h, 72px);
      }
      main {
        padding-bottom: calc(40px + env(safe-area-inset-bottom));
      }

      .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--accent, #60a5fa);
        transform-origin: left;
        z-index: 110;
      }

      .fade-top,
      .fade-bottom {
        z-index: 2 !important;
        pointer-events: none;
      }
      main {
        position: relative;
        z-index: 3;
      }
      .gg-header {
        z-index: 5 !important;
      }

      .btn-row {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 18px;
        flex-wrap: wrap;
      }
      .gg-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 12px;
        font-weight: 700;
        background: var(--accent);
        color: white;
        text-decoration: none;
        border: none;
        cursor: pointer;
      }

      .two-col {
        display: grid;
        gap: 18px;
        align-items: stretch;
      }
      .two-col-avoid {
        grid-template-columns: 1.2fr 1fr;
      }
      .two-col-specialties {
        grid-template-columns: 1.3fr 1fr;
      }
      .two-col > div,
      .two-col-avoid > div,
      .two-col-specialties > div {
        min-width: 0;
      }

      .auto-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }
      .pricing-grid {
        gap: 18px;
      }

      .card-pad {
        padding: 22px;
        border-radius: 18px;
      }
      .inner-border {
        padding: 2px;
        border-radius: 16px;
        margin-top: 14px;
      }
      .inner-card {
        padding: 16px;
        border-radius: 14px;
      }

      .fineprint {
        color: var(--text);
        opacity: 0.7;
        font-size: 13px;
        margin-top: 12px;
      }
      .tight-list {
        margin: 0;
        padding-left: 18px;
        line-height: 1.9;
      }

      .price-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .price-tag {
        font-size: 24px;
        font-weight: 800;
      }

      .force-desktop .two-col,
      .force-desktop .two-col-avoid,
      .force-desktop .two-col-specialties {
        grid-template-columns: 1.2fr 1fr !important;
      }
      .force-desktop .two-col-specialties {
        grid-template-columns: 1.3fr 1fr !important;
      }
      .force-desktop .auto-grid {
        grid-template-columns: repeat(
          auto-fit,
          minmax(240px, 1fr)
        ) !important;
      }
      .force-desktop .gg-btn {
        width: auto !important;
      }
      .force-desktop .hero .card-glass {
        padding: 36px !important;
        max-width: 1100px;
        margin: 0 auto;
      }

      /* 🔹 Desktop toggle now sits in normal flow at the bottom of the page */
      .desktop-toggle {
        margin-top: 16px;
        padding-bottom: env(safe-area-inset-bottom);
        display: flex;
        justify-content: center;
      }
      .desktop-toggle-text {
        background: transparent;
        border: none;
        padding: 4px 8px;
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
        text-decoration: underline;
        cursor: pointer;
      }
      .desktop-toggle-text:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.6);
        outline-offset: 2px;
      }

      @media (min-width: 1024px) and (pointer: fine) {
        .desktop-toggle {
          display: none !important;
        }
      }

      @media (max-width: 640px) {
        .two-col,
        .two-col-avoid,
        .two-col-specialties {
          grid-template-columns: 1fr !important;
          gap: 12px;
        }
        .auto-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .card-pad {
          padding: 16px !important;
          border-radius: 16px;
        }
        .gg-btn {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
        }
        .section-title {
          font-size: clamp(20px, 6vw, 26px);
          line-height: 1.1;
          margin-bottom: 6px;
        }
        .section-sub {
          font-size: 14px;
          line-height: 1.6;
        }
        .price-tag {
          font-size: 22px;
        }
        .scroll-progress {
          height: 2px;
        }
        .hero .card-glass {
          padding: 20px !important;
        }
      }
    `}</style>
  </>
  );
}