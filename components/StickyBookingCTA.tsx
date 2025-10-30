"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./StickyBookingCTA.module.css";

type DamageType = "chip" | "multi" | "shortCrack";
type Slot = { label: string; iso: string };

/** Generate the next N half-hour slots between 09:00–18:00 local time. */
function getNextSlots(n: number = 3): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  const start = new Date(now);

  // Round up to next :00 or :30
  const m = now.getMinutes();
  const addMin = m === 0 ? 0 : m <= 30 ? 30 - m : 60 - m;
  start.setMinutes(m + addMin, 0, 0);

  const openH = 9;
  const closeH = 18;

  let cur = new Date(start);
  if (cur.getHours() < openH) cur.setHours(openH, 0, 0, 0);
  if (cur.getHours() >= closeH || (cur.getHours() === closeH - 1 && cur.getMinutes() > 30)) {
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 1);
    cur.setHours(openH, 0, 0, 0);
  }

  while (slots.length < n) {
    if (cur.getHours() < closeH || (cur.getHours() === closeH && cur.getMinutes() === 0)) {
      const time = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(cur);
      const isToday = new Date().toDateString() === cur.toDateString();
      slots.push({
        label: `${isToday ? "Today " : ""}${time}`,
        iso: cur.toISOString(),
      });
      cur = new Date(cur.getTime() + 30 * 60 * 1000);
      continue;
    }
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 1);
    cur.setHours(openH, 0, 0, 0);
  }

  return slots;
}

export default function StickyBookingCTA() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // form state
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [damage, setDamage] = useState<DamageType>("chip");
  const [insurance, setInsurance] = useState(false);
  const [chips, setChips] = useState(2);
  const [photo, setPhoto] = useState<File | null>(null);

  // slot picker
  const slots = useMemo(() => getNextSlots(3), []);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // a11y helpers
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const lastInteractive = useRef<HTMLButtonElement | null>(null);

  // desktop tab ref for overlap detection
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const [overContent, setOverContent] = useState(false);

  useEffect(() => setMounted(true), []);

  // Estimate
  const estimate = useMemo(() => {
    if (insurance) return "Possible $0 with qualifying insurance";
    if (damage === "shortCrack") return "$100 est. (short crack)";
    const qty = damage === "multi" ? Math.max(2, chips) : 1;
    const total = 60 + Math.max(0, qty - 1) * 25;
    return `$${total} est. • ${qty} item${qty > 1 ? "s" : ""}`;
  }, [insurance, damage, chips]);

  // ETA hint
  const eta = useMemo(
    () => (zip.trim().length >= 5 ? "Today — ~1–3 hrs" : "Today — call for availability"),
    [zip]
  );

  // analytics (stub)
  const track = (ev: string, data?: Record<string, any>) =>
    console.log("[StickyBookingCTA]", ev, data ?? "");

  // focus trap + esc
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const el = panelRef.current;
    const t = setTimeout(() => firstInputRef.current?.focus(), 80);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        track("cta_close_escape");
        return;
      }
      if (e.key === "Tab") {
        const focusable = el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Darken background when the tab floats over content
  useEffect(() => {
    if (!mounted) return;

    const check = () => {
      const btn = tabRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);

      // Element directly under the tab's center
      const el = document.elementFromPoint(cx, cy);

      // Consider "content" if it's inside a section/article/main/card/panel
      // or any ancestor marks itself with data-cta-contrast="solid"
      const contentish =
        el?.closest?.('[data-cta-contrast="solid"], section, article, main, .card, .panel, [role="region"]');

      setOverContent(Boolean(contentish));
    };

    // run once and on scroll/resize
    check();
    const onScroll = () => check();
    const onResize = () => check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const id = window.setInterval(check, 300); // periodic in case layout changes without scroll

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.clearInterval(id);
    };
  }, [mounted]);

  // Mailto fallback
  function openMailto() {
    const subject = encodeURIComponent("Glass Guardian — Repair Request");
    const issue =
      damage === "chip" ? "Single chip" : damage === "multi" ? `${chips} chips` : "Short crack";
    const lines = [
      `Issue: ${issue}`,
      `ZIP: ${zip || "—"}`,
      `Phone: ${phone || "—"}`,
      insurance ? "Insurance: Yes" : "Insurance: No",
      selectedSlot ? `Requested slot: ${selectedSlot.label}` : "Requested slot: (none)",
      photo ? `Photo: ${photo.name}` : "",
      "",
      "Please reach out to schedule. Sent from the website.",
    ].filter(Boolean);
    const body = encodeURIComponent(lines.join("\n"));
    const href = `mailto:hello@glassguardian.example?subject=${subject}&body=${body}`;
    track("cta_mailto_open", { damage, zip, phone, slot: selectedSlot?.iso });
    window.location.href = href;
  }

  // quick call / sms
  const quickCallHref = "tel:+15555555555"; // TODO replace with production number
  const quickSmsHref = "sms:+15555555555";

  // validation for primary action
  const phoneDigits = phone.replace(/\D/g, "");
  const canRequest =
    zip.trim().length >= 5 && (phoneDigits.length >= 7 || phone.trim().length === 0);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Desktop bottom-right floating tab */}
      <motion.button
        ref={tabRef}
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className={`${styles.tab} ${overContent ? styles.tabSolid : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="sticky-booking-panel"
        onClick={() => setOpen(true)}
        onMouseEnter={() => track("cta_tab_hover")}
        title="Schedule repair"
      >
        <span className={styles.tabInner}>
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>
            <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.25A2.75 2.75 0 0 1 22 6.75v11.5A2.75 2.75 0 0 1 19.25 21H4.75A2.75 2.75 0 0 1 2 18.25V6.75A2.75 2.75 0 0 1 4.75 4H6V3a1 1 0 0 1 1-1Zm12 8.5H5v8.75c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75V10.5ZM6 6H4.75a.75.75 0 0 0-.75.75V9h16V6.75a.75.75 0 0 0-.75-.75H18v1a1 1 0 1 1-2 0V6H8v1a1 1 0 0 1-2 0V6Z" />
          </svg>

          <span className={styles.label}>Schedule Repair</span>

          <span className={styles.badge} aria-hidden>
            {zip.trim().length >= 5 ? "Today" : "Quick"}
          </span>

          <span className={styles.shimmer} aria-hidden />
          <span className={styles.glow} aria-hidden />
        </span>
      </motion.button>

      {/* Mobile bottom pill */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.mtab}
        aria-label="Open Schedule Repair"
      >
        <svg viewBox="0 0 24 24" className={styles.mtabIcn} aria-hidden>
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.25A2.75 2.75 0 0 1 22 6.75v11.5A2.75 2.75 0 0 1 19.25 21H4.75A2.75 2.75 0 0 1 2 18.25V6.75A2.75 2.75 0 0 1 4.75 4H6V3a1 1 0 0 1 1-1Zm12 8.5H5v8.75c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75V10.5ZM6 6H4.75a.75.75 0 0 0-.75.75V9h16V6.75a.75.75 0 0 0-.75-.75H18v1a1 1 0 1 1-2 0V6H8v1a1 1 0 0 1-2 0V6Z" />
        </svg>
        <span className={styles.mtabText}>Schedule Repair</span>
        <span className={styles.mpulse} aria-hidden />
      </button>

      {/* Panel / dialog */}
      <AnimatePresence>
        {open && (
          <motion.aside
            id="sticky-booking-panel"
            ref={panelRef}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className={styles.panelWrapper}
            role="dialog"
            aria-modal="true"
            aria-label="Schedule repair panel"
          >
            <div className={styles.panelCard}>
              {/* Mobile grab handle */}
              <div className={styles.grab} aria-hidden />

              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.title}>Book Mobile Repair</h3>
                  <div className={styles.subtitle}>
                    <strong>{estimate}</strong>
                    <span className={styles.sep}>•</span>
                    <span className={styles.eta}>{eta}</span>
                  </div>
                </div>

                <button
                  aria-label="Close schedule panel"
                  onClick={() => setOpen(false)}
                  className={styles.closeBtn}
                >
                  ✕
                </button>
              </div>

              <div className={styles.panelBody}>
                {/* Availability / slot picker */}
                <div className={styles.slots}>
                  {slots.map((s) => {
                    const selected = selectedSlot?.iso === s.iso;
                    return (
                      <button
                        key={s.iso}
                        type="button"
                        onClick={() => setSelectedSlot(s)}
                        className={`${styles.slotBtn} ${selected ? styles.slotBtnSelected : ""}`}
                        aria-pressed={selected}
                      >
                        <span className={styles.slotTime}>{s.label}</span>
                        <span className={styles.slotMeta}>Earliest</span>
                      </button>
                    );
                  })}
                </div>

                {/* Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    track("cta_request_submit", { damage, zip, phone, slot: selectedSlot?.iso });
                    openMailto();
                    setOpen(false);
                  }}
                >
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>ZIP</span>
                    <input
                      ref={firstInputRef}
                      className={styles.input}
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="e.g., 94103"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Phone</span>
                    <input
                      className={styles.input}
                      type="tel"
                      placeholder="Optional — (555) 555-5555"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Damage</span>
                    <select
                      className={styles.input}
                      value={damage}
                      onChange={(e) => setDamage(e.target.value as DamageType)}
                    >
                      <option value="chip">Single chip</option>
                      <option value="multi">Multiple chips</option>
                      <option value="shortCrack">Short crack</option>
                    </select>
                  </label>

                  {damage === "multi" && (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>How many?</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={2}
                        max={8}
                        value={chips}
                        onChange={(e) =>
                          setChips(Math.max(2, Math.min(8, Number(e.target.value) || 2)))
                        }
                      />
                    </label>
                  )}

                  <label className={styles.fieldInline} htmlFor="insurance-check">
                    <input
                      id="insurance-check"
                      type="checkbox"
                      checked={insurance}
                      onChange={(e) => setInsurance(e.target.checked)}
                    />
                    <span className={styles.inlineLabel}>
                      Check insurance (NoFault Glass-Only)
                    </span>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Photo (optional)</span>
                    <input
                      className={styles.inputFile}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                    />
                    {photo && <div className={styles.fileInfo}>Selected: {photo.name}</div>}
                  </label>

                  <div className={styles.actions}>
                    <button
                      type="submit"
                      className={styles.primary}
                      disabled={!canRequest}
                      ref={lastInteractive}
                    >
                      {selectedSlot ? "Request This Time" : "Request—We’ll Call"}
                    </button>

                    <div className={styles.quickActions}>
                      <a
                        href={quickCallHref}
                        className={styles.quick}
                        onClick={() => track("cta_quick_call")}
                      >
                        Call
                      </a>
                      <a
                        href={quickSmsHref}
                        className={styles.quick}
                        onClick={() => track("cta_quick_sms")}
                      >
                        Text
                      </a>
                      <button
                        type="button"
                        className={styles.quick}
                        onClick={() => {
                          setOpen(false);
                          track("cta_share");
                          if (navigator.share) {
                            navigator
                              .share({
                                title: "Glass Guardian — Schedule Repair",
                                text: "Quick windshield repair near you — schedule now.",
                                url: window.location.href,
                              })
                              .catch(() => {});
                          } else {
                            navigator.clipboard?.writeText(window.location.href).then(() => {
                              alert("Link copied to clipboard");
                            });
                          }
                        }}
                      >
                        Share
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className={styles.panelFooter}>
                <div className={styles.trust}>
                  <img src="/icons/lock.svg" alt="" aria-hidden className={styles.trustIcon} />
                  <span>Secure & insured • 1 year warranty</span>
                </div>
                <div className={styles.smallNote}>
                  Prefer to call? <a href={quickCallHref}>Tap to call</a>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}