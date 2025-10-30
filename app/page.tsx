// app/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useReducedMotion,
} from "framer-motion";

import Header from "@/components/Header";
import Background from "@/components/Background";
import Section from "@/components/Section";
import BeforeAfter from "@/components/BeforeAfter";
import StickyBookingCTA from "@/components/StickyBookingCTA";
import WindshieldCrackOut from "@/components/WindshieldCrackOut"; // ✅ added import

export default function Home() {
  const { scrollYProgress } = useScroll();
  const progressWidth = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });

  // Lazy-mount the 3D iframe when the Avoid section is near viewport
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [showThree, setShowThree] = useState(false);
  useEffect(() => {
    if (!previewRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShowThree(true);
      },
      { rootMargin: "200px 0px", threshold: [0, 0.15] }
    );
    io.observe(previewRef.current);
    return () => io.disconnect();
  }, []);

  // Hero parallax/tilt (respect reduced motion)
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useTransform(my, [-0.5, 0.5], [6, -6]);
  const ry = useTransform(mx, [-0.5, 0.5], [-6, 6]);
  const tiltX = useSpring(rx, { stiffness: 160, damping: 18, mass: 0.6 });
  const tiltY = useSpring(ry, { stiffness: 160, damping: 18, mass: 0.6 });

  const onHeroPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(nx);
    my.set(ny);
  };

  const hoverLift = reduced
    ? {}
    : {
        whileHover: { y: -6, scale: 1.02 },
        whileTap: { scale: 0.99 },
        transition: { type: "spring", stiffness: 320, damping: 18 },
      };

  const copy = { color: "var(--text)", opacity: 0.95 };
  const subCopy = { color: "var(--text)", opacity: 0.88 };

  return (
    <>
      <Background />
      <motion.div className="scroll-progress" style={{ scaleX: progressWidth }} />
      <Header />
      <div className="fade-top" aria-hidden />
      <div className="fade-bottom" aria-hidden />

      <main>
        {/* HERO */}
        <Section id="overview" index={0} className="hero">
          <motion.div
            className="gradient-border"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              padding: 24,
              borderRadius: 24,
              width: "100%",
              maxWidth: 1100,
              margin: "0 auto",
              perspective: 1200,
            }}
            onPointerMove={onHeroPointerMove}
            onPointerLeave={() => {
              mx.set(0);
              my.set(0);
            }}
          >
            <motion.div
              className="card-glass"
              style={{
                padding: 36,
                borderRadius: 20,
                willChange: "transform",
                transformStyle: "preserve-3d",
                rotateX: reduced ? 0 : (tiltX as any),
                rotateY: reduced ? 0 : (tiltY as any),
              }}
              {...hoverLift}
            >
              <h1 style={{ marginBottom: 6, color: "var(--text)" }}>Glass Guardian</h1>
              <h2
                style={{
                  marginTop: 0,
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "var(--text)",
                  opacity: 0.98,
                }}
              >
                Chip and Crack Repair
              </h2>

              <p style={subCopy}>
                Mobile chip & crack repair done right — insurance-friendly, fast, and guaranteed.
                We come to you, restore clarity, and back it with a 1 year warranty.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginTop: 18,
                  flexWrap: "wrap",
                }}
              >
                <a className="gg-btn" href="#pricing">
                  See Price
                </a>
                <a className="gg-btn" href="#billing">
                  Insurance
                </a>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* AVOID CRACK-OUTS (moved under hero) */}
        <Section id="avoid" index={1}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>Avoid crack-outs</h2>
          <p className="section-sub" style={subCopy}>
            Small chips turn into large cracks fast. Potholes and speed bumps, hot sun or the
            defroster, even a firm door-slam can make damage spread. Repair now to protect visibility
            and the factory seal.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, alignItems: "stretch" }}>
            <div ref={previewRef}>
              {showThree ? (
                // ✅ replaced 3D iframe with WindshieldCrackOut component
                <WindshieldCrackOut height={420} />
              ) : (
                <div className="gradient-border" style={{ borderRadius: 16, overflow: "hidden" }}>
                  <div className="card-glass" style={{ height: 420, display: "grid", placeItems: "center" }}>
                    <div style={{ ...subCopy }}>Loading windshield preview…</div>
                  </div>
                </div>
              )}
            </div>

            <motion.div
              className="gradient-border"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5 }}
            >
              <div className="card-glass" style={{ padding: 22, borderRadius: 16 }}>
                <h3 style={{ marginTop: 0, color: "var(--text)" }}>Why chips spread</h3>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, ...copy }}>
                  <li><strong>Road shock:</strong> potholes, speed bumps, gravel chatter.</li>
                  <li><strong>Temp swings:</strong> hot sun → A/C or defroster → thermal stress.</li>
                  <li><strong>Body flex:</strong> driveways, uneven terrain, hard turns.</li>
                  <li><strong>Door slams:</strong> sudden cabin pressure spikes.</li>
                </ul>
                <div style={{ marginTop: 14 }}>
                  <a className="gg-btn" href="#pricing">Fix it before it grows</a>
                </div>
              </div>
            </motion.div>
          </div>
        </Section>

        {/* SPECIALTIES */}
        <Section id="specialties" index={2}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>Specialties</h2>
          <p className="section-sub" style={subCopy}>
            Experience excellence in windshield repair at Glass Guardian Chip & Crack Repair. With
            over a decade of dedicated service, our expertise protects your driving experience with
            precision.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
            <motion.div
              className="gradient-border"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              {...hoverLift}
              transition={{ duration: 0.5 }}
            >
              <div className="card-glass" style={{ padding: 22, borderRadius: 18 }}>
                <p style={{ ...copy, marginTop: 0 }}>
                  Tired of hefty deductibles? Ask about <strong>NO COST</strong> windshield repair* on
                  qualifying insurance plans. We’ll help set up a <em>NoFault Glass-Only Claim</em> and
                  handle the details.
                </p>
                <p style={copy}>
                  Repairs preserve the <strong>factory seal</strong>, reduce waste, and restore optical
                  clarity — often in under an hour.
                </p>
                <div className="gradient-border" style={{ padding: 2, borderRadius: 16, marginTop: 14 }}>
                  <div className="card-glass-solid" style={{ padding: 16, borderRadius: 14 }}>
                    <span style={copy}>
                      Not sure you’re covered? Call or text and we’ll check. Paying out of pocket? Our
                      pricing is simple and fair.
                    </span>
                  </div>
                </div>
                <p style={{ ...subCopy, fontSize: 13, marginTop: 12 }}>
                  *Coverage varies by insurer and policy.
                </p>
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              {...hoverLift}
              transition={{ duration: 0.55 }}
            >
              <div className="card-glass" style={{ padding: 22, borderRadius: 18 }}>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, ...copy }}>
                  <li>10+ years focused on chip & crack repair</li>
                  <li>Mobile service — we come to you</li>
                  <li>1 year warranty against spread on the repaired spot</li>
                  <li>Insurance-friendly & transparent pricing</li>
                  <li>Preserve OEM seal; avoid unnecessary replacements</li>
                </ul>
              </div>
            </motion.div>
          </div>

          <div style={{ marginTop: 18 }}>
            <BeforeAfter />
          </div>
        </Section>

        {/* ABOUT (moved below specialties) */}
        <Section id="about" index={3}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>
            About the repair
          </h2>
          <p className="section-sub" style={subCopy}>
            We inject professional-grade resin into the chip/crack, cure it with UV, and finish with
            precision polishing. The result: structurally reinforced glass and dramatically reduced
            visibility.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            {[
              { t: "Fast on-site service", d: "Most repairs 20–40 minutes at your location." },
              { t: "Optical clarity", d: "Reduces the blemish significantly; most chips ~80–95% improved." },
              { t: "Stops spreading", d: "Reinforces the glass to help prevent cracks from growing." },
            ].map((x, i) => (
              <motion.div
                key={x.t}
                className="gradient-border"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                {...hoverLift}
                transition={{ delay: i * 0.08, duration: 0.45 }}
              >
                <div className="card-glass" style={{ padding: 20, borderRadius: 18, willChange: "transform" }}>
                  <h3 style={{ marginTop: 0, color: "var(--text)" }}>{x.t}</h3>
                  <p style={{ ...copy, marginBottom: 0 }}>{x.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* BILLING & INSURANCE */}
        <Section id="billing" index={4}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>Billing & insurance</h2>
          <p className="section-sub" style={subCopy}>
            We work with major insurers for chip & crack repair. Many policies waive deductibles for
            repairs. Prefer to pay out of pocket? No problem — transparent, flat pricing below.
          </p>

          <motion.div className="gradient-border" style={{ padding: 2, borderRadius: 20 }} {...hoverLift}>
            <div className="card-glass" style={{ padding: 24, borderRadius: 18 }}>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, ...copy }}>
                <li>Guidance with NoFault Glass-Only Claims</li>
                <li>Direct-to-insurer billing support (where applicable)</li>
                <li>Digital receipts for quick reimbursement</li>
                <li>Instant PDF invoice by email</li>
              </ul>
              <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a className="gg-btn" href="#pricing">See out-of-pocket price</a>
                <a className="gg-btn" href="/login">Login for warranty</a>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* PRICING */}
        <Section id="pricing" index={5}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>Price</h2>
          <p className="section-sub" style={subCopy}>
            Straightforward, no surprises. Multiple chips in the same visit are discounted.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 18,
            }}
          >
            {[
              { name: "Single chip", price: "$60", note: "Most common. Includes UV cure & polish." },
              { name: "Each add’l chip", price: "$25", note: "Same windshield, same visit." },
              { name: "Short crack", price: "$100", note: "Subject to length/position assessment." },
            ].map((p, i) => (
              <motion.div
                key={p.name}
                className="gradient-border"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                {...hoverLift}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="card-glass" style={{ padding: 22, borderRadius: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      ...copy,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{p.price}</div>
                  </div>
                  <p style={copy}>{p.note}</p>
                  <a className="gg-btn" href="/login">Book / Login</a>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* Q&A */}
        <Section id="qa" index={6}>
          <h2 className="section-title" style={{ color: "var(--text)" }}>Q&A</h2>
          <p className="section-sub" style={subCopy}>
            Answers to common questions about chip & crack repair.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { q: "Will the blemish disappear completely?", a: "Most chips become 80–95% less visible. The main goal is structural: stop spreading and restore strength." },
              { q: "How long does it take?", a: "Typically 20–40 minutes. Complex cracks can take longer depending on length and position." },
              { q: "Is it safe to drive right after?", a: "Yes. The resin is UV-cured on site; you can drive immediately." },
              { q: "Do you guarantee the work?", a: "1 year warranty against spread on the repaired spot. Manage warranty details in your account." },
            ].map((item, i) => (
              <motion.details
                key={item.q}
                className="card-glass"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                {...hoverLift}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                style={{ padding: 18, borderRadius: 16 }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "var(--text)" }}>
                  {item.q}
                </summary>
                <p style={{ ...copy, marginTop: 10 }}>{item.a}</p>
              </motion.details>
            ))}
          </div>
        </Section>

        {/* FOOTER */}
        <Section id="footer" index={7}>
          <div style={{ textAlign: "center", color: "var(--text)", opacity: 0.85, width: "100%" }}>
            <div style={{ opacity: 0.95 }}>
              © {new Date().getFullYear()} Glass Guardian — Chip & Crack Repair • All rights reserved.
            </div>
          </div>
        </Section>
      </main>

      {/* Sticky CTA */}
      <StickyBookingCTA />
    </>
  );
}