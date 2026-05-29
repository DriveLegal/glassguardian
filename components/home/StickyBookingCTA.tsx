"use client";

import * as React from "react";
import s from "./StickyBookingCTA.module.css";
import { supabaseClient } from "@/lib/supabaseClient";

function ShieldMiniIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
    </svg>
  );
}

export default function StickyBookingCTA({
  revealOffset = 0,
  hideOverFooter = true,
  message = "Chip spreading? We can fix it today.",
  ctaLabel = "Book repair",
  subLabel = "Mobile • Insurance-friendly • 1-yr warranty",
  tel = "+1-909-529-1798",
  showBar = true,
}: {
  revealOffset?: number;
  hideOverFooter?: boolean;
  message?: string;
  ctaLabel?: string;
  subLabel?: string;
  tel?: string;
  showBar?: boolean;
}) {
  const [visible, setVisible] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const [celebrate, setCelebrate] = React.useState(false);
  const confettiRef = React.useRef<HTMLCanvasElement | null>(null);
  const confettiRAF = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleOpen = () => {
      setVisible(true);
      setOpen(true);
      window.setTimeout(() => {
        const el = document.getElementById("gg-name") as HTMLInputElement | null;
        el?.focus();
      }, 50);
    };

    if (typeof window === "undefined") return;
    window.addEventListener("gg:open-booking", handleOpen);
    return () => window.removeEventListener("gg:open-booking", handleOpen);
  }, []);

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
        if (!isTall()) return;
        if ((e.intersectionRatio ?? 0) >= 0.98) setVisible(false);
        else setVisible(true);
      },
      { threshold: [0.2, 0.6, 0.98] }
    );

    io.observe(footer);
    return () => io.disconnect();
  }, [hideOverFooter, showBar]);

  const [vh, setVh] = React.useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVh(window.innerHeight));
    };

    update();
    window.addEventListener("resize", update, {
      passive: true,
    } as EventListenerOptions);

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    vv?.addEventListener?.("resize", update, {
      passive: true,
    } as EventListenerOptions);
    vv?.addEventListener?.("scroll", update, {
      passive: true,
    } as EventListenerOptions);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update as EventListener);
      vv?.removeEventListener?.("resize", update as EventListener);
      vv?.removeEventListener?.("scroll", update as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [chips, setChips] = React.useState<number | "">("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const telHref = `tel:${tel.replace(/[^+\d]/g, "")}`;

  const showToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const runConfetti = React.useCallback(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const W = 260;
    const H = 180;

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
          ? "#F5E7B8"
          : i % 4 === 1
          ? "#D6B25E"
          : i % 4 === 2
          ? "#FFF1C7"
          : "#B38738",
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

    if (!fullName.trim()) {
      setError("Please enter your first & last name.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter a phone number.");
      return;
    }

    if (chips === "" || Number.isNaN(Number(chips)) || Number(chips) < 0) {
      setError("Please enter how many chips (0 if unsure).");
      return;
    }

    setSubmitting(true);

    try {
      let photo_url: string | null = null;

      if (file) {
        const bucket = "leads";
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `lead_${Date.now()}_${safeName}`;

        const { error: upErr } = await supabaseClient.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (!upErr) {
          const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
          photo_url = data?.publicUrl ?? null;
        } else {
          console.warn("[lead-upload] storage error:", upErr.message);
          showToast("Photo upload failed, sending without photo…");
        }
      }

      const { error: insErr } = await supabaseClient.from("booking_leads").insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        chips: Number(chips) || 0,
        slot: null,
        photo_url,
        source: "sticky_cta",
      });

      if (insErr) {
        console.error("[lead-insert] error:", insErr.message);
        setError("Could not send your request. Please try again.");
        setSubmitting(false);
        return;
      }

      setOpen(false);
      setCelebrate(true);

      requestAnimationFrame(() => runConfetti());
      window.setTimeout(() => setCelebrate(false), 7000);

      setFullName("");
      setPhone("");
      setChips("");
      setFile(null);
    } catch (e) {
      console.error(e);
      setError("Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fileInputId = "gg-file";
  const selectedFileName = file?.name ? file.name : "No file selected";

  const PANEL_GUTTER = 24;
  const panelMaxHpx = Math.max(320, Math.floor(vh - PANEL_GUTTER));

  return (
    <>
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
          <div className={s.barWrap}>
            <div className={s.barInner}>
              <div className={s.barCopy}>
                <div className={s.barMessage}>{message}</div>
                <div className={s.barSub}>{subLabel}</div>
              </div>

              <div className={s.barActions}>
                <a
                  href={telHref}
                  aria-label="Call or text now"
                  className={s.barActionCall}
                >
                  Call / Text
                </a>

                <button
                  onClick={() => setOpen(true)}
                  aria-label={`${ctaLabel}. Opens booking form`}
                  className={s.barActionBook}
                >
                  <ShieldMiniIcon className={s.barActionBookIcon} />
                  <span>{ctaLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && <div className={s.backdrop} onClick={() => setOpen(false)} aria-hidden />}

      {open && (
        <div
          className={s.panelWrapper}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gg-booking-title"
          id="gg-booking-panel"
          style={{
            width: "auto",
            maxWidth: "min(430px, 100vw - 24px)",
            maxHeight: `min(${panelMaxHpx}px, calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))`,
          }}
        >
          <div
            className={s.panelCard}
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: `min(${panelMaxHpx}px, calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))`,
              minHeight: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.grab} aria-hidden />

            <header
              className={s.panelHeader}
              style={{
                flex: "0 0 auto",
                minHeight: 0,
              }}
            >
              <div>
                <div className={s.titleRow}>
                  <span className={s.titleBadge} aria-hidden="true">
                    <ShieldMiniIcon className={s.titleBadgeIcon} />
                  </span>
                  <h3 id="gg-booking-title" className={s.title}>
                    Book a mobile repair
                  </h3>
                </div>

                <div className={s.subtitle}>
                  <span>{message}</span>
                  <span className={s.sep}>•</span>
                  <span className={s.eta}>15-30 mins on site</span>
                </div>
              </div>

              <button
                type="button"
                className={s.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close panel"
              >
                Close
              </button>
            </header>

            <div
              className={s.panelBody}
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
                paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
              }}
            >
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
                <label className={s.fieldLabel} htmlFor="gg-chips">
                  How many chips?
                </label>
                <input
                  id="gg-chips"
                  className={s.input}
                  value={chips}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setChips("");
                      return;
                    }
                    const n = Number(v.replace(/[^\d]/g, ""));
                    setChips(Number.isNaN(n) ? "" : n);
                  }}
                  placeholder="0, 1, 2…"
                  inputMode="numeric"
                />
              </div>

              <div className={s.field}>
                <label className={s.fieldLabel} htmlFor={fileInputId}>
                  Picture (optional)
                </label>

                <div className={s.filePickerRow}>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className={s.fileInputHidden}
                  />

                  <label
                    htmlFor={fileInputId}
                    className={s.fileButton}
                    aria-label="Choose a picture"
                  >
                    Choose file
                  </label>

                  <div
                    className={s.fileName}
                    aria-live="polite"
                    title={file?.name || undefined}
                  >
                    <span className={s.fileNameStrong}>{selectedFileName}</span>
                  </div>

                  {file && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className={s.fileRemove}
                      aria-label="Remove selected file"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className={s.fileInfo}>
                  Clear close-up of the chip helps us plan the repair.
                </div>
              </div>

              {error && <div className={s.error}>{error}</div>}

              <div className={s.actions}>
                <button
                  type="button"
                  className={s.primary}
                  onClick={onSubmit}
                  disabled={submitting}
                  aria-disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send & Continue"}
                </button>

                <div className={s.quickActions}>
                  <a className={s.quick} href={telHref}>
                    Call now
                  </a>
                  <button
                    type="button"
                    className={s.quick}
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className={s.smallNote}>
                <small>We’ll text to confirm.</small>
              </div>

              <footer className={s.panelFooter}>
                <div className={s.trust}>
                  <svg className={s.trustIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
                  </svg>
                  <span>1-yr warranty against spread on repaired spot</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      )}

      {celebrate && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: showBar ? 92 : 24,
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

          <div className={s.successBubble}>
            Request received! We’ll contact you ASAP. If urgent, please call{" "}
            <a href={telHref}>HERE</a>.
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}