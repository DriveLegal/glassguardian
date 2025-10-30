"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import styles from "./BeforeAfter.module.css";

export default function BeforeAfter({
  beforeSrc = "/media/repair-before.avif",
  afterSrc = "/media/repair-after.avif",
  alt = "Windshield repair result",
  width = 1200,
  height = 720,
}: {
  beforeSrc?: string;
  afterSrc?: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  const [pos, setPos] = useState(50); // percentage 0..100
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  const updatePosFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const pct = clampPct((relX / rect.width) * 100);
    setPos((prev) => {
      const next = Math.round(pct);
      return prev === next ? prev : next;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return;
    const target = e.currentTarget as Element;
    try {
      target.setPointerCapture?.(e.pointerId);
      pointerIdRef.current = e.pointerId;
    } catch {}
    draggingRef.current = true;
    e.preventDefault();
    updatePosFromClientX(e.clientX);
    document.documentElement.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  const onPointerMoveWindow = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    updatePosFromClientX(e.clientX);
  };

  const onPointerUpWindow = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const el = containerRef.current;
    try {
      if (el && pointerIdRef.current !== null) {
        (el as Element).releasePointerCapture?.(pointerIdRef.current);
      }
    } catch {}
    pointerIdRef.current = null;
    document.documentElement.style.cursor = "";
    document.body.style.userSelect = "";
  };

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMoveWindow, { passive: false });
    window.addEventListener("pointerup", onPointerUpWindow);
    window.addEventListener("pointercancel", onPointerUpWindow);
    return () => {
      window.removeEventListener("pointermove", onPointerMoveWindow);
      window.removeEventListener("pointerup", onPointerUpWindow);
      window.removeEventListener("pointercancel", onPointerUpWindow);
      document.documentElement.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = String(pos);
  }, [pos]);

  // keyboard handler + larger steps with Shift
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const smallStep = 2;
    const largeStep = 10;
    const step = e.shiftKey ? largeStep : smallStep;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setPos((p) => clampPct(p - step));
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        setPos((p) => clampPct(p + step));
        break;
      case "Home":
        e.preventDefault();
        setPos(0);
        break;
      case "End":
        e.preventDefault();
        setPos(100);
        break;
      case "PageUp":
        e.preventDefault();
        setPos((p) => clampPct(p + largeStep));
        break;
      case "PageDown":
        e.preventDefault();
        setPos((p) => clampPct(p - largeStep));
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`${styles.baWrap} ${styles.gradientBorder} ${styles.elev2}`}
      style={{ position: "relative", borderRadius: 20, overflow: "hidden" }}
      aria-label="Before and after repair comparison"
    >
      <div className={styles.cardGlass} style={{ borderRadius: 18 }}>
        <div
          ref={containerRef}
          className={styles.imageWrap}
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
        >
          {/* After (base) */}
          <div className={styles.base}>
            <Image
              src={afterSrc}
              alt={`${alt} — after`}
              width={width}
              height={height}
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className={styles.image}
              decoding="async"
            />
          </div>

          {/* Before clipped */}
          <div
            className={styles.clip}
            aria-hidden
            style={{
              clipPath: `inset(0 ${100 - pos}% 0 0)`,
              WebkitClipPath: `inset(0 ${100 - pos}% 0 0)`,
            }}
          >
            <Image
              src={beforeSrc}
              alt={`${alt} — before`}
              width={width}
              height={height}
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className={styles.image}
              decoding="async"
            />
          </div>

          {/* Divider (glow animates on focus/drag) */}
          <div
            className={styles.divider}
            aria-hidden
            style={{ left: `${pos}%`, transform: "translateX(-1px)" }}
          />

          {/* Invisible range (keyboard accessible) */}
          <input
            ref={inputRef}
            aria-label="Slide to compare before and after"
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pos}
            className={styles.range}
          />

          {/* Thumb */}
          <div
            className={`${styles.handle} ${focused ? styles.handleFocus : ""}`}
            aria-hidden
            style={{ left: `${pos}%`, transform: "translate(-50%, -50%)", top: "50%" }}
          />
        </div>

        {/* small footer */}
        <div className={styles.footer}>
          <span>Before</span>
          <span className={styles.dot}>•</span>
          <span>After</span>
          <small style={{ marginLeft: 12, opacity: 0.75 }}>{pos}%</small>
        </div>
      </div>
    </div>
  );
}