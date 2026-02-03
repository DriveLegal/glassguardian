// components/home/StickyBookingCTA.tsx
"use client";

import * as React from "react";
import s from "./StickyBookingCTA.module.css";
import { supabaseClient } from "@/lib/supabaseClient";

export default function StickyBookingCTA({
  revealOffset = 0, // show as soon as you scroll past this
  hideOverFooter = true,
  message = "Chip spreading? We can fix it today.",
  ctaLabel = "Book repair",
  subLabel = "Mobile • Insurance-friendly • 1-yr warranty",
  tel = "+1-909-529-1798",
  showBar = true, // allow hiding the sticky footer bar
}: {
  revealOffset?: number;
  hideOverFooter?: boolean;
  message?: string;
  ctaLabel?: string;
  subLabel?: string;
  tel?: string;
  showBar?: boolean;
}) {
  // visibility and panel state
  const [visible, setVisible] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  // celebration state
  const [celebrate, setCelebrate] = React.useState(false);
  const confettiRef = React.useRef<HTMLCanvasElement | null>(null);
  const confettiRAF = React.useRef<number | null>(null);

  // 🔹 Listen for global "open booking" command dispatched from the page
  React.useEffect(() => {
    const handleOpen = () => {
      setVisible(true); // ensure bar can be visible
      setOpen(true); // open the panel
      // focus first input for smoother UX
      setTimeout(() => {
        const el = document.getElementById("gg-name") as HTMLInputElement | null;
        el?.focus();
      }, 50);
    };

    if (typeof window === "undefined") return;
    window.addEventListener("gg:open-booking", handleOpen);
    return () => window.removeEventListener("gg:open-booking", handleOpen);
  }, []);

  // keep bar visible once scrolled past offset (only matters if showBar / revealOffset > 0)
  React.useEffect(() => {
    if (!showBar && revealOffset <= 0) return;

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y > revealOffset) setVisible(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealOffset, showBar]);

  // auto-hide bottom bar when footer is fully in view on tall pages
  React.useEffect(() => {
    if (!hideOverFooter || !showBar) return;

    const footer = document.querySelector("section#footer");
    if (!footer) return;

    const isTall = () =>
      document.documentElement.scrollHeight - window.innerHeight > 600;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (!isTall()) return; // never hide on short pages
        if ((e.intersectionRatio ?? 0) >= 0.98) setVisible(false);
        else setVisible(true);
      },
      { threshold: [0.2, 0.6, 0.98] }
    );
    io.observe(footer);
    return () => io.disconnect();
  }, [hideOverFooter, showBar]);

  // form state
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [chips, setChips] = React.useState<number | "">("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const telHref = `tel:${tel.replace(/[^+\d]/g, "")}`;
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // simple confetti burst near bottom-right
  const runConfetti = React.useCallback(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const W = 260,
      H = 180; // small canvas, bottom-right
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(DPR, DPR);

    const N = 36;
    const parts = Array.from({ length: N }).map((_, i) => ({
      x: W - 30 + (Math.random() - 0.5) * 20,
      y: H - 10,
      vx: -3 - Math.random() * 3,
      vy: -5 - Math.random() * 6,
      g: 0.24 + Math.random() * 0.06,
      s: 4 + Math.random() * 3,
      r: Math.random() * Math.PI,
      rv: (Math.random() - 0.5) * 0.3,
      a: 1,
      color:
        i % 4 === 0
          ? "#6EE7F9"
          : i % 4 === 1
          ? "#93C5FD"
          : i % 4 === 2
          ? "#A78BFA"
          : "#FDE68A",
    }));

    const start = performance.now();
    const dur = 1600;

    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W, H);

      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.r += p.rv;
        p.a = Math.max(0, 1 - elapsed / dur);

        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6);
        ctx.restore();
      });

      if (elapsed < dur) {
        confettiRAF.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
        if (confettiRAF.current != null) {
          cancelAnimationFrame(confettiRAF.current);
          confettiRAF.current = null;
        }
      }
    };

    confettiRAF.current = requestAnimationFrame(tick);
  }, []);

  React.useEffect(() => {
    return () => {
      if (confettiRAF.current != null) cancelAnimationFrame(confettiRAF.current);
    };
  }, []);

  const onSubmit = async () => {
    setError(null);

    // basic validation
    if (!fullName.trim())
      return setError("Please enter your first & last name.");
    if (!phone.trim()) return setError("Please enter a phone number.");
    if (!zip.trim()) return setError("Please enter your ZIP code.");
    if (chips === "" || Number.isNaN(Number(chips)) || Number(chips) < 0)
      return setError("Please enter how many chips (0 if unsure).");

    setSubmitting(true);
    try {
      // 1) optional upload to storage bucket "leads"
      let photo_url: string | null = null;
      if (file) {
        const bucket = "leads";
        const path = `lead_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const { error: upErr } = await supabaseClient.storage
          .from(bucket)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (!upErr) {
          const { data } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);
          photo_url = data?.publicUrl ?? null;
        } else {
          console.warn("[lead-upload] storage error:", upErr.message);
          showToast("Photo upload failed, sending without photo…");
        }
      }

      // 2) insert into public.booking_leads
      const { error: insErr } = await supabaseClient.from("booking_leads").insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        zip: zip.trim(),
        chips: Number(chips) || 0,
        slot: null, // no slots UI
        photo_url,
        source: "sticky_cta",
      });

      if (insErr) {
        console.error("[lead-insert] error:", insErr.message);
        setError("Could not send your request. Please try again.");
        setSubmitting(false);
        return;
      }

      // 3) success UX — close panel, fire confetti, show celebration note
      setOpen(false);
      setCelebrate(true);
      // kick confetti after panel closes on next paint
      requestAnimationFrame(() => runConfetti());
      // auto-hide celebration after a few seconds
      setTimeout(() => setCelebrate(false), 7000);
    } catch (e: any) {
      console.error(e);
      setError("Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Full-width sticky bar across the bottom (can be turned off via showBar) */}
      {showBar && (
        <div
          aria-hidden={!visible}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1600,
            pointerEvents: "none",
            transform: visible ? "translateY(0)" : "translateY(16px)",
            opacity: visible ? 1 : 0,
            transition: "transform 300ms ease, opacity 250ms ease",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              width: "100%",
              margin: "0 auto",
              padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
              // glassy stretched bar
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.26), rgba(255,255,255,0.16)), radial-gradient(1200px 420px at 20% -10%, rgba(96,165,250,0.18), transparent 60%)",
              borderTop: "1px solid rgba(255,255,255,0.35)",
              boxShadow: "0 -8px 20px rgba(0,0,0,0.15)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Copy */}
              <div
                style={{
                  minWidth: 0,
                  flex: "1 1 100%",
                }}
              >
                <div
                  style={{
                    color: "var(--text, #0f172a)",
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    fontSize: "clamp(15px, 2.6vw, 18px)",
                    lineHeight: 1.15,
                    margin: "2px 0",
                  }}
                >
                  {message}
                </div>
                <div
                  style={{
                    color: "var(--text, #0f172a)",
                    opacity: 0.85,
                    fontSize: "clamp(12px, 2.2vw, 13px)",
                    lineHeight: 1.35,
                    marginTop: 2,
                  }}
                >
                  {subLabel}
                </div>
              </div>

              {/* Call / Text — high contrast */}
              <a
                href={telHref}
                aria-label="Call or text now"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "11px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13,
                  background:
                    "linear-gradient(90deg, var(--accentA, #60a5fa), var(--accentB, #8b5cf6))",
                  color: "#071124",
                  border: "0",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 6px 18px rgba(6,95,255,0.22)",
                  flexShrink: 0,
                }}
              >
                Call / Text
              </a>

              {/* Book button */}
              <button
                onClick={() => setOpen(true)}
                aria-label={`${ctaLabel}. Opens booking form`}
                style={{
                  appearance: "none",
                  border: 0,
                  cursor: "pointer",
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: "-0.01em",
                  color: "#fff",
                  background: "var(--accent, #2563eb)",
                  boxShadow: "0 6px 14px rgba(37,99,235,0.35)",
                  transition:
                    "transform 120ms ease, box-shadow 160ms ease, filter 160ms ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact booking panel (used even if showBar = false) */}
      {open && (
        <div
          className={s.panelWrapper}
          role="dialog"
          aria-modal="true"
          id="gg-booking-panel"
          style={{
            width: "auto",
            maxWidth: "min(420px, 100vw - 24px)", // mobile-safe
          }}
        >
          <div className={s.panelCard}>
            <div className={s.grab} aria-hidden />
            <header className={s.panelHeader}>
              <div>
                <h3 className="title" style={{ margin: 0 }}>
                  Book a mobile repair
                </h3>
                <div className={s.subtitle}>
                  <span>{message}</span>
                  <span className={s.sep}>•</span>
                  <span className={s.eta}>~20–40 mins on site</span>
                </div>
              </div>
              <button
                className={s.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close panel"
              >
                Close
              </button>
            </header>

            <div className={s.panelBody}>
              {/* Form fields */}
              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="gg-name">
                  First &amp; last name
                </label>
                <input
                  id="gg-name"
                  className={s.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="gg-phone">
                  Phone number
                </label>
                <input
                  id="gg-phone"
                  className={s.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(909) 529-1798"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="gg-zip">
                  ZIP code
                </label>
                <input
                  id="gg-zip"
                  className={s.input}
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="e.g., 92376"
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="gg-chips">
                  How many chips?
                </label>
                <input
                  id="gg-chips"
                  className={s.input}
                  value={chips}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return setChips("");
                    const n = Number(v.replace(/[^\d]/g, ""));
                    setChips(Number.isNaN(n) ? "" : n);
                  }}
                  placeholder="0, 1, 2…"
                  inputMode="numeric"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor="gg-file">
                  Picture (optional)
                </label>
                <input
                  id="gg-file"
                  className="inputFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="fileInfo">
                  Clear close-up of the chip helps us plan the repair.
                </div>
              </div>

              {/* Form feedback */}
              {error && <div className="error">{error}</div>}

              {/* Actions */}
              <div className={s.actions}>
                <button
                  className={s.primary}
                  onClick={onSubmit}
                  disabled={submitting}
                  aria-disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send & Continue"}
                </button>

                <div
                  className="quickActions"
                  style={{ display: "flex", gap: 8, marginLeft: "auto" }}
                >
                  <a className="quick" href={telHref}>
                    Call now
                  </a>
                  <button className="quick" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="smallNote">
                <small>
                  We’ll text to confirm. <a href="#terms">Terms</a>
                </small>
              </div>

              <footer className={s.panelFooter}>
                <div className={s.trust}>
                  <svg className={s.trustIcon} viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
                  </svg>
                  <span>1-yr warranty against spread on repaired spot</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* Celebration bubble (bottom-right, above sticky bar) */}
      {celebrate && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: showBar ? 88 : 24, // if no bar, sit a bit lower
            zIndex: 1700,
            display: "grid",
            gap: 8,
            alignItems: "end",
            justifyItems: "end",
            pointerEvents: "none",
          }}
          aria-live="polite"
          role="status"
        >
          <canvas
            ref={confettiRef}
            style={{
              width: 260,
              height: 180,
              pointerEvents: "none",
            }}
            aria-hidden
          />
          <div
            style={{
              pointerEvents: "auto",
              maxWidth: 360,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.90))",
              color: "#0f172a",
              borderRadius: 12,
              padding: "10px 12px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
              border: "1px solid rgba(0,0,0,0.06)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Request received! We’ll contact you ASAP. If urgent, please call{" "}
            <a
              href={telHref}
              style={{
                fontWeight: 900,
                textDecoration: "underline",
                color: "#0f172a",
              }}
            >
              HERE
            </a>
            .
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={s.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}