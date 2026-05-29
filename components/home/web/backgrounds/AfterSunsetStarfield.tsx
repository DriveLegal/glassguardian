// components/home/web/backgrounds/AfterSunsetStarfield.tsx
"use client";

import * as React from "react";

type Props = {
  className?: string;
  density?: number;
  disableComet?: boolean;
  intensity?: number; // 0.6–1.4 typical

  /**
   * ✅ “Galactus on the horizon” titan logo (canvas-only)
   */
  showHorizonTitan?: boolean;
  titanLogoSrc?: string; // e.g. "/branding/glass-guardian-gold.png"
  titanOpacity?: number; // subtle: 0.05–0.16
  titanScale?: number; // relative to width: 1.05–1.55 typical
  titanHorizonCut?: number; // 0..1 (how much is hidden below horizon)
};

/**
 * ✅ HARD SINGLETON LOCK:
 * If this component gets mounted twice (layout + page, accidental duplicate, dev strict remount),
 * we allow only ONE instance to run RAF/comet at a time — kills “double comet / parallel streak”.
 */
const GG_STARFIELD_SINGLETON_KEY = "__GG_AFTER_SUNSET_STARFIELD_SINGLETON__";

export default function AfterSunsetStarfield({
  className,
  density = 1,
  disableComet = false,
  intensity = 1,

  showHorizonTitan = true,
  titanLogoSrc = "/branding/glass-guardian-gold.png",
  titanOpacity = 0.04,
  titanScale = 1.0,
  titanHorizonCut = 0.2,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const stateRef = React.useRef<{
    w: number;
    h: number;
    dpr: number;

    stars: Star[];
    comet: Comet;
    t: number;
    prefersReduced: boolean;

    lastW: number;
    lastH: number;
    lastTs: number;

    mtnSeed: number;
    mtnPts: number[];
    treeSeeds: TreeSeed[];
    treeSeedBase: number;

    // offscreen buffer for reflections
    off: HTMLCanvasElement | null;
    offCtx: CanvasRenderingContext2D | null;

    // titan logo cache
    logoImg: HTMLImageElement | null;
    logoReady: boolean;
    logoSrc: string;
  } | null>(null);

  React.useEffect(() => {
    // ✅ SINGLETON CLAIM (prevents duplicate animation instances)
    const ownerId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const ww = typeof window !== "undefined" ? (window as any) : null;
    if (!ww) return;

    const existing = ww[GG_STARFIELD_SINGLETON_KEY] as
      | { active: boolean; ownerId: string | null }
      | undefined;

    if (existing?.active) {
      // Another instance is already running (this is what causes “double comet”).
      return;
    }

    ww[GG_STARFIELD_SINGLETON_KEY] = { active: true, ownerId };

    const canvas = canvasRef.current;
    if (!canvas) {
      // release claim if we can't run
      const cur = ww[GG_STARFIELD_SINGLETON_KEY];
      if (cur?.ownerId === ownerId)
        ww[GG_STARFIELD_SINGLETON_KEY] = { active: false, ownerId: null };
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      const cur = ww[GG_STARFIELD_SINGLETON_KEY];
      if (cur?.ownerId === ownerId)
        ww[GG_STARFIELD_SINGLETON_KEY] = { active: false, ownerId: null };
      return;
    }

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const mulIntensity = (a: number) => clamp(a * intensity, 0, 1);

    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

    // ✅ COMET TIMING:
    // first comet 3s after visit, then 15s after that, then 23s after that (repeats at ~23s)
    const COMET_SCHEDULE_MS = [3_000, 15_000, 23_000];
    const COMET_JITTER_MS = 650;

    /* ---------------- Helpers ---------------- */

    const mkStars = (w: number, h: number, densityMul: number): Star[] => {
      const base = (w * h) / 9500;
      const count = Math.max(240, Math.floor(base * densityMul * 1.25));

      const stars: Star[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        const big = r > 0.88;
        const radius = big ? 1.2 + Math.random() * 2.0 : 0.5 + Math.random() * 1.0;

        stars[i] = {
          x: Math.random() * w,
          y: Math.random() * (h * 0.82),
          radius,
          baseAlpha: 0.16 + Math.random() * 0.74,
          tw: 0.0015 + Math.random() * 0.011,
          phase: Math.random() * Math.PI * 2,
          hueShift: Math.random(),
        };
      }
      return stars;
    };

    const mkComet = (): Comet => ({
      active: false,
      nextMs: COMET_SCHEDULE_MS[0] + Math.random() * COMET_JITTER_MS,
      scheduleIndex: 0,
      x: -340,
      y: 120,
      vx: 16,
      vy: 6,
      tail: 420,
      glow: 22,
      wobble: Math.random() * Math.PI * 2,
    });

    // smoother distant mountains profile
    const mkMountainProfile = (seed: number): number[] => {
      const pts: number[] = [];
      const n = 34;
      let s = seed % 2147483647;
      const rnd = () => {
        s = (s * 48271) % 2147483647;
        return (s & 0x7fffffff) / 2147483647;
      };

      for (let i = 0; i <= n; i++) {
        const x = i / n;

        const roll = 0.2 + rnd() * 0.18;
        const peak = rnd() > 0.93 ? 0.1 + rnd() * 0.16 : 0;
        const y = clamp(roll + peak, 0.14, 0.54);

        pts.push(x, y);
      }
      return pts;
    };

    const ensureOffscreen = (w: number, h: number, dpr: number) => {
      const s = (stateRef.current ?? null) as any;
      if (!s) return;

      if (!s.off) s.off = document.createElement("canvas");
      const off = s.off as HTMLCanvasElement;

      const need =
        off.width !== Math.floor(w * dpr) || off.height !== Math.floor(h * dpr);

      if (need) {
        off.width = Math.floor(w * dpr);
        off.height = Math.floor(h * dpr);
        s.offCtx = off.getContext("2d", { alpha: true }) as CanvasRenderingContext2D | null;
        if (s.offCtx) s.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (s.offCtx) {
        s.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    // deterministic-ish tiny RNG (for tree placement)
    const makeRng = (seed: number) => {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      return () => {
        s = (s * 48271) % 2147483647;
        return (s & 0x7fffffff) / 2147483647;
      };
    };

    // build tree seeds along the ridge (small, far)
    const mkTreeSeeds = (seed: number, count: number): TreeSeed[] => {
      const rnd = makeRng(seed);
      const arr: TreeSeed[] = [];
      for (let i = 0; i < count; i++) {
        const u = Math.pow(rnd(), 0.65);
        const x01 = clamp(u * 0.96 + 0.02, 0.02, 0.98);
        const scale = 0.55 + rnd() * 0.85;
        const a = 0.35 + rnd() * 0.35;
        const jitter = (rnd() - 0.5) * 0.006;
        arr.push({ x01: clamp(x01 + jitter, 0.02, 0.98), s: scale, a });
      }
      return arr;
    };

    // ✅ load titan logo
    const ensureLogoLoaded = (src: string) => {
      const s = stateRef.current;
      if (!s) return;

      if (s.logoSrc === src && s.logoImg && s.logoReady) return;

      s.logoReady = false;
      s.logoSrc = src;

      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.src = src;

      img.onload = () => {
        const st = stateRef.current;
        if (!st) return;
        if (st.logoSrc !== src) return;
        st.logoImg = img;
        st.logoReady = true;
      };
      img.onerror = () => {
        const st = stateRef.current;
        if (!st) return;
        if (st.logoSrc !== src) return;
        st.logoImg = null;
        st.logoReady = false;
      };
    };

    const resize = () => {
      const w = Math.floor(window.innerWidth);
      const h = Math.floor(window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const prev = stateRef.current;
      const s =
        prev ??
        ({
          w,
          h,
          dpr,
          stars: [],
          comet: mkComet(),
          t: 0,
          prefersReduced,
          lastW: 0,
          lastH: 0,
          lastTs: 0,
          mtnSeed: Math.floor(Math.random() * 1e9),
          mtnPts: [],
          treeSeeds: [],
          treeSeedBase: Math.floor(Math.random() * 1e9),
          off: null,
          offCtx: null,

          logoImg: null,
          logoReady: false,
          logoSrc: "",
        } as any);

      s.w = w;
      s.h = h;
      s.dpr = dpr;
      s.prefersReduced = prefersReduced;

      const sizeChanged = Math.abs(s.lastW - w) > 40 || Math.abs(s.lastH - h) > 40;

      if (!s.stars.length || sizeChanged) {
        s.stars = mkStars(w, h, density);
        s.lastW = w;
        s.lastH = h;

        s.mtnSeed = Math.floor(Math.random() * 1e9);
        s.mtnPts = mkMountainProfile(s.mtnSeed);

        s.treeSeedBase = Math.floor(Math.random() * 1e9);
        const treeCount = Math.max(40, Math.floor(w / 18));
        s.treeSeeds = mkTreeSeeds(s.treeSeedBase, treeCount);

        s.comet.active = false;
        s.comet.scheduleIndex = 0;
        s.comet.nextMs = COMET_SCHEDULE_MS[0] + Math.random() * COMET_JITTER_MS;
      }

      stateRef.current = s as any;
      ensureOffscreen(w, h, dpr);

      if (showHorizonTitan && titanLogoSrc) ensureLogoLoaded(titanLogoSrc);
    };

    /* ---------------- Drawing (base scene) ---------------- */

    const drawSky = (gctx: CanvasRenderingContext2D, w: number, h: number) => {
      const grad = gctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(3, 5, 20, 0.99)");
      grad.addColorStop(0.42, "rgba(9, 7, 35, 0.96)");
      grad.addColorStop(0.7, "rgba(16, 10, 52, 0.88)");
      grad.addColorStop(0.84, "rgba(32, 16, 70, 0.64)");
      grad.addColorStop(0.93, "rgba(78, 44, 108, 0.28)");
      grad.addColorStop(1, "rgba(5, 7, 18, 0.99)");

      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, w, h);

      const horizonY = h * 0.84;
      const bloom = gctx.createRadialGradient(
        w * 0.52,
        horizonY + 10,
        0,
        w * 0.52,
        horizonY + 10,
        Math.max(w, h) * 0.95
      );
      bloom.addColorStop(0, `rgba(255,170,110,${mulIntensity(0.12)})`);
      bloom.addColorStop(0.22, `rgba(255,120,170,${mulIntensity(0.08)})`);
      bloom.addColorStop(0.55, `rgba(120,100,220,${mulIntensity(0.05)})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");

      gctx.fillStyle = bloom;
      gctx.fillRect(0, 0, w, h);
    };

    const drawStars = (
      gctx: CanvasRenderingContext2D,
      stars: Star[],
      t: number,
      reduced: boolean
    ) => {
      for (const st of stars) {
        const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(st.phase + t * st.tw);
        const a = clamp(st.baseAlpha * tw, 0, 1);
        const alpha = mulIntensity(a);

        let r = 245,
          g = 245,
          b = 255;
        if (st.hueShift < 0.25) {
          r = 220;
          g = 230;
          b = 255;
        } else if (st.hueShift > 0.82) {
          r = 255;
          g = 235;
          b = 220;
        }

        gctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        gctx.beginPath();
        gctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        gctx.fill();
      }
    };

    const advanceCometSchedule = (comet: Comet) => {
      comet.scheduleIndex = Math.min(COMET_SCHEDULE_MS.length - 1, comet.scheduleIndex + 1);
      const base = COMET_SCHEDULE_MS[comet.scheduleIndex];
      comet.nextMs = base + Math.random() * COMET_JITTER_MS;
    };

    /**
     * ✅ IMPORTANT:
     * We keep OFFSCREEN reflection buffer comet-free (prevents “ghost comet” artifacts),
     * and we paint a dedicated comet reflection pass into the water (so reflection shows it cleanly).
     */
    const drawComet = (
      gctx: CanvasRenderingContext2D,
      comet: Comet,
      w: number,
      h: number,
      reduced: boolean,
      t: number,
      dtMsCountdown: number
    ) => {
      if (disableComet || reduced) return;

      if (!comet.active) {
        comet.nextMs -= dtMsCountdown;

        if (comet.nextMs <= 0) {
          comet.active = true;
          comet.x = -360;
          comet.y = 40 + Math.random() * (h * 0.38);
          comet.vx = 16 + Math.random() * 10;
          comet.vy = 5 + Math.random() * 6;
          comet.tail = 420 + Math.random() * 320;
          comet.glow = 20 + Math.random() * 18;
          comet.wobble = Math.random() * Math.PI * 2;
        }
        return;
      }

      const wob = Math.sin(comet.wobble + t * 0.08) * 0.6;
      comet.wobble += 0.04;

      const tailX = comet.x - comet.tail * 1.06;
      const tailY = comet.y - comet.tail * 0.44 + wob * 12;

      const tailG = gctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
      tailG.addColorStop(0, `rgba(255,255,255,${mulIntensity(0.92)})`);
      tailG.addColorStop(0.14, `rgba(180,240,255,${mulIntensity(0.68)})`);
      tailG.addColorStop(0.32, `rgba(80,220,255,${mulIntensity(0.48)})`);
      tailG.addColorStop(0.7, `rgba(40,140,255,${mulIntensity(0.14)})`);
      tailG.addColorStop(1, "rgba(20,80,220,0)");

      gctx.strokeStyle = tailG;
      gctx.lineWidth = 3.2;
      gctx.beginPath();
      gctx.moveTo(comet.x, comet.y);
      gctx.lineTo(tailX, tailY);
      gctx.stroke();

      gctx.save();
      gctx.shadowColor = "rgba(120,220,255,0.92)";
      gctx.shadowBlur = comet.glow;
      gctx.fillStyle = `rgba(220,255,255,${mulIntensity(0.98)})`;
      gctx.beginPath();
      gctx.arc(comet.x, comet.y, 3.2, 0, Math.PI * 2);
      gctx.fill();
      gctx.restore();

      comet.x += comet.vx;
      comet.y += comet.vy;

      if (comet.x > w + 500 || comet.y > h + 320 || comet.y < -260) {
        comet.active = false;
        advanceCometSchedule(comet);
      }
    };

    // ✅ FIXED: logo-aware clip window so we don't chop the titan
    const drawHorizonTitan = (
      gctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      t: number,
      s: NonNullable<typeof stateRef.current>
    ) => {
      if (!showHorizonTitan) return;
      if (!s.logoReady || !s.logoImg) return;

      const horizonY = h * 0.84;

      const baseA = mulIntensity(clamp(titanOpacity, 0.02, 0.22));

      // titan size
      const W = w * clamp(titanScale, 0.9, 2.0);
      const aspect = s.logoImg.naturalHeight
        ? s.logoImg.naturalWidth / s.logoImg.naturalHeight
        : 2.0;
      const H = W / Math.max(0.5, aspect);

      // position: sitting on horizon, slightly cut below horizon
      const cut = clamp(titanHorizonCut, 0, 0.6);
      const centerX = w * 0.5;
      const centerY = horizonY - H * (0.5 - cut);

      // subtle drift
      const drift = Math.sin(t * 0.00035) * 1.25;

      // ✅ IMPORTANT: make clip region depend on logo size (prevents "only bottom shows")
      const clipTop = Math.max(0, horizonY - Math.max(h * 0.62, H * 0.92));
      const clipBot = Math.min(h, horizonY + Math.max(h * 0.22, H * 0.26));

      gctx.save();
      gctx.beginPath();
      gctx.rect(0, clipTop, w, clipBot - clipTop);
      gctx.clip();

      // 1) titan in atmosphere
      gctx.globalAlpha = baseA;
      gctx.globalCompositeOperation = "screen";
      gctx.filter = "blur(1.2px) saturate(1.06) contrast(1.02)";
      gctx.drawImage(s.logoImg, centerX - W / 2, centerY - H / 2 + drift, W, H);

      // ✅ subtle soft gold glow (single pass)
      gctx.save();
      gctx.globalAlpha = baseA * 0.55;
      gctx.globalCompositeOperation = "screen";
      gctx.filter = "blur(10px) saturate(1.15)";
      gctx.drawImage(s.logoImg, centerX - W / 2, centerY - H / 2 + drift, W, H);

      // warm gold tint bloom (very subtle)
      gctx.filter = "blur(16px)";
      gctx.fillStyle = "rgba(255, 204, 120, 0.18)";
      gctx.fillRect(0, clipTop, w, clipBot - clipTop);
      gctx.restore();

      // 2) atmospheric wash
      gctx.filter = "none";
      gctx.globalCompositeOperation = "source-over";
      const haze = gctx.createLinearGradient(0, clipTop, 0, clipBot);
      haze.addColorStop(0, `rgba(8,10,22,${mulIntensity(0.0)})`);
      haze.addColorStop(0.38, `rgba(14,12,36,${mulIntensity(0.22)})`);
      haze.addColorStop(0.72, `rgba(34,18,66,${mulIntensity(0.32)})`);
      haze.addColorStop(1, `rgba(0,0,0,${mulIntensity(0.58)})`);
      gctx.fillStyle = haze;
      gctx.fillRect(0, clipTop, w, clipBot - clipTop);

      // 3) cloud layers in front
      const drawCloudBand = (
        yBase: number,
        amp: number,
        speed: number,
        alpha: number,
        blurPx: number
      ) => {
        const a = mulIntensity(alpha);
        if (a <= 0) return;

        const segs = 80;
        const step = w / segs;

        gctx.save();
        gctx.globalAlpha = a;
        gctx.filter = `blur(${blurPx}px)`;

        const cg = gctx.createLinearGradient(0, yBase - amp * 2, 0, yBase + amp * 2);
        cg.addColorStop(0, "rgba(255,255,255,0)");
        cg.addColorStop(0.35, "rgba(255,255,255,0.22)");
        cg.addColorStop(0.6, "rgba(255,255,255,0.18)");
        cg.addColorStop(1, "rgba(255,255,255,0)");
        gctx.fillStyle = cg;

        gctx.beginPath();
        gctx.moveTo(0, clipBot);
        gctx.lineTo(0, yBase);

        const tt = t * speed;
        for (let i = 0; i <= segs; i++) {
          const x = i * step;
          const n =
            Math.sin(x * 0.008 + tt) * 0.55 +
            Math.sin(x * 0.018 - tt * 0.8) * 0.28 +
            Math.sin(x * 0.033 + tt * 1.35) * 0.17;
          const y = yBase + n * amp;
          gctx.lineTo(x, y);
        }

        gctx.lineTo(w, clipBot);
        gctx.closePath();
        gctx.fill();

        gctx.restore();
      };

      drawCloudBand(horizonY - 26, 34, 0.00125, 0.18, 10);
      drawCloudBand(horizonY - 8, 20, 0.00165, 0.22, 7);

      // 4) rim glow
      gctx.save();
      gctx.globalAlpha = mulIntensity(0.22);
      gctx.globalCompositeOperation = "screen";
      gctx.filter = "blur(10px)";
      const rim = gctx.createRadialGradient(
        centerX,
        horizonY + 8,
        0,
        centerX,
        horizonY + 8,
        Math.max(w, h) * 0.28
      );
      rim.addColorStop(0, "rgba(255,200,140,0.42)");
      rim.addColorStop(0.38, "rgba(180,140,255,0.18)");
      rim.addColorStop(1, "rgba(0,0,0,0)");
      gctx.fillStyle = rim;
      gctx.fillRect(0, clipTop, w, clipBot - clipTop);
      gctx.restore();

      gctx.restore();
    };

    const drawBaseSceneNoComet = (
      gctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      s: NonNullable<typeof stateRef.current>,
      ts: number
    ) => {
      gctx.clearRect(0, 0, w, h);
      drawSky(gctx, w, h);
      drawStars(gctx, s.stars, s.t, s.prefersReduced);
      drawHorizonTitan(gctx, w, h, ts, s);
    };

    /* ---------------- Foreground ---------------- */

    const buildMountainPoints = (w: number, horizonY: number, pts: number[]) => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] * w;
        const peakHeight = 18 + pts[i + 1] * 105;
        out.push({ x, y: horizonY - peakHeight });
      }
      return out;
    };

    const drawSmoothMountainPath = (
      gctx: CanvasRenderingContext2D,
      pts: { x: number; y: number }[],
      startY: number
    ) => {
      if (pts.length < 2) return;

      gctx.beginPath();
      gctx.moveTo(0, startY);
      gctx.lineTo(pts[0].x, pts[0].y);

      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        gctx.quadraticCurveTo(p0.x, p0.y, mx, my);
      }

      const last = pts[pts.length - 1];
      gctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
    };

    const getRidgeYAtX = (mpts: { x: number; y: number }[], x: number) => {
      for (let i = 0; i < mpts.length - 1; i++) {
        const a = mpts[i];
        const b = mpts[i + 1];
        if (x >= a.x && x <= b.x) {
          const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
          return a.y + (b.y - a.y) * t;
        }
      }
      if (x < mpts[0].x) return mpts[0].y;
      return mpts[mpts.length - 1].y;
    };

    const drawTinyTree = (
      gctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      alpha: number
    ) => {
      gctx.save();
      gctx.globalAlpha = alpha;

      gctx.fillStyle = "rgba(0,0,0,0.45)";
      gctx.fillRect(x - size * 0.06, y, size * 0.12, size * 0.24);

      gctx.fillStyle = "rgba(8,10,18,0.72)";
      gctx.beginPath();
      gctx.moveTo(x, y - size * 0.85);
      gctx.lineTo(x - size * 0.55, y + size * 0.05);
      gctx.lineTo(x + size * 0.55, y + size * 0.05);
      gctx.closePath();
      gctx.fill();

      gctx.globalAlpha = alpha * 0.35;
      gctx.strokeStyle = "rgba(255,190,130,0.35)";
      gctx.lineWidth = 0.8;
      gctx.stroke();

      gctx.restore();
    };

    const drawFarMountainsWithTrees = (
      gctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      pts: number[],
      treeSeeds: TreeSeed[]
    ) => {
      const horizonY = h * 0.84;

      const haze = gctx.createLinearGradient(0, horizonY - 240, 0, horizonY + 140);
      haze.addColorStop(0, "rgba(0,0,0,0)");
      haze.addColorStop(0.52, `rgba(26,18,54,${mulIntensity(0.18)})`);
      haze.addColorStop(1, `rgba(0,0,0,${mulIntensity(0.52)})`);
      gctx.fillStyle = haze;
      gctx.fillRect(0, horizonY - 240, w, 380);

      const mpts = buildMountainPoints(w, horizonY, pts);

      drawSmoothMountainPath(gctx, mpts, horizonY);
      gctx.lineTo(w, horizonY);
      gctx.lineTo(w, h);
      gctx.lineTo(0, h);
      gctx.closePath();

      /**
       * ✅ FIX: mountains must be (nearly) opaque so the comet doesn't "shine through" hills.
       */
      gctx.fillStyle = `rgba(6,8,22,${mulIntensity(0.98)})`;
      gctx.fill();

      gctx.save();
      const baseTreeAlpha = mulIntensity(0.22);
      for (const tr of treeSeeds) {
        const x = tr.x01 * w;
        const ridgeY = getRidgeYAtX(mpts, x);
        const y = ridgeY + 1.5;

        const size = 6.0 * tr.s;
        const a = baseTreeAlpha * tr.a;

        drawTinyTree(gctx, x, y, size, a);
      }
      gctx.restore();

      gctx.save();
      gctx.globalAlpha = mulIntensity(0.08);
      gctx.strokeStyle = "rgba(255,180,120,0.55)";
      gctx.lineWidth = 1.0;
      drawSmoothMountainPath(gctx, mpts, horizonY);
      gctx.stroke();
      gctx.restore();
    };

    /**
     * ✅ NEW: dedicated comet reflection pass (water-only)
     * This makes the reflection show the comet cleanly without reintroducing the “double comet” artifact.
     */
    const drawCometReflection = (
      gctx: CanvasRenderingContext2D,
      comet: Comet,
      w: number,
      h: number,
      t: number
    ) => {
      if (disableComet) return;
      if (!comet.active) return;

      const horizonY = h * 0.84;
      const waterTop = horizonY;
      const waterH = h - waterTop;
      if (waterH <= 2) return;

      // Mirror across the horizon (slightly compressed for "perspective")
      const mirrorY = (y: number) => horizonY + (horizonY - y) * 0.92;

      const wob = Math.sin(comet.wobble + t * 0.08) * 0.6;

      const hx = comet.x;
      const hy = mirrorY(comet.y);

      const tailX = comet.x - comet.tail * 1.06;
      const tailY = mirrorY(comet.y - comet.tail * 0.44 + wob * 12);

      // Fade as it goes deeper into water
      const depth = (hy - waterTop) / Math.max(1, waterH);
      const depthFade = clamp(1 - depth, 0, 1);

      const baseA = mulIntensity(0.22 * depthFade);
      if (baseA <= 0.001) return;

      gctx.save();
      gctx.beginPath();
      gctx.rect(0, waterTop, w, waterH);
      gctx.clip();

      // A little blur + ripple softness
      gctx.globalCompositeOperation = "screen";
      gctx.globalAlpha = baseA;

      // main streak
      const tailG = gctx.createLinearGradient(hx, hy, tailX, tailY);
      tailG.addColorStop(0, `rgba(255,255,255,${mulIntensity(0.62)})`);
      tailG.addColorStop(0.18, `rgba(170,235,255,${mulIntensity(0.42)})`);
      tailG.addColorStop(0.46, `rgba(90,205,255,${mulIntensity(0.22)})`);
      tailG.addColorStop(1, "rgba(20,80,220,0)");

      // Slight smear to feel like water distortion
      const smear = Math.sin(t * 0.035 + hy * 0.06) * 2.6;

      gctx.filter = "blur(1.35px)";
      gctx.strokeStyle = tailG;
      gctx.lineWidth = 2.6;
      gctx.beginPath();
      gctx.moveTo(hx + smear, hy);
      gctx.lineTo(tailX + smear * 0.65, tailY);
      gctx.stroke();

      // head glow
      gctx.filter = "blur(2.6px)";
      gctx.globalAlpha = baseA * 0.85;
      gctx.fillStyle = `rgba(210,255,255,${mulIntensity(0.85)})`;
      gctx.beginPath();
      gctx.arc(hx + smear, hy, 2.4, 0, Math.PI * 2);
      gctx.fill();

      // micro sparkle bloom right under horizon
      gctx.filter = "blur(6px)";
      gctx.globalAlpha = baseA * 0.22;
      gctx.fillStyle = "rgba(180,240,255,0.9)";
      gctx.fillRect(hx - 22, waterTop + 2, 44, 10);

      gctx.restore();
    };

    /**
     * ✅ UPDATED FIX (HOME gray slab issue):
     * - Water base is darker + LESS OPAQUE (prevents “flat gray rectangle”)
     * - Reflection slices use SCREEN blend (so stars/logo survive overlays)
     * - No extra “mirror punch” transform pass (that was the #1 source of banding/rectangles under overlays)
     * - Keeps comet reflection pass separate
     */
    const drawWater = (
      gctx: CanvasRenderingContext2D,
      off: HTMLCanvasElement,
      w: number,
      h: number,
      t: number,
      comet: Comet,
      reduced: boolean
    ) => {
      const horizonY = h * 0.84;
      const waterTop = horizonY;
      const waterH = h - waterTop;
      if (waterH <= 1) return;

      // ✅ 1) Base water (less opaque, not a slab)
      const wg = gctx.createLinearGradient(0, waterTop, 0, h);
      wg.addColorStop(0, `rgba(3, 4, 10, ${mulIntensity(0.22)})`);
      wg.addColorStop(0.35, `rgba(2, 2, 6, ${mulIntensity(0.44)})`);
      wg.addColorStop(1, `rgba(0, 0, 0, ${mulIntensity(0.78)})`);
      gctx.fillStyle = wg;
      gctx.fillRect(0, waterTop, w, waterH);

      // ✅ Clip to water only
      gctx.save();
      gctx.beginPath();
      gctx.rect(0, waterTop, w, waterH);
      gctx.clip();

      const time = t * 0.035;
      const sliceH = 3;

      // ✅ 2) Reflection slices that survive HOME overlays
      gctx.globalCompositeOperation = "screen";

      const dpr = stateRef.current?.dpr ?? 1;
      const srcW = Math.floor(w * dpr);

      for (let y = 0; y < waterH; y += sliceH) {
        const fade = 1 - y / Math.max(1, waterH);

        // stronger near horizon, fades into depth
        const nearHorizonBoost = 0.55 + 0.75 * Math.pow(fade, 0.85);

        // (stronger than before, but still tasteful)
        const alpha = mulIntensity(0.22 * fade * nearHorizonBoost);

        // sample from above the horizon (mirror pull)
        const srcY = Math.max(0, Math.floor((waterTop - y - sliceH) * dpr));
        const srcH = Math.max(1, Math.floor(sliceH * dpr));

        // wave wobble
        const wob =
          Math.sin(y * 0.06 + time) * 3.2 +
          Math.sin(y * 0.018 + time * 1.3) * 2.0;

        gctx.globalAlpha = alpha;

        gctx.drawImage(
          off,
          0,
          srcY,
          srcW,
          srcH,
          wob,
          waterTop + y,
          w,
          sliceH
        );
      }

      // restore normal blending
      gctx.globalAlpha = 1;
      gctx.globalCompositeOperation = "source-over";
      gctx.restore();
      gctx.filter = "none";

      // ✅ 3) Comet reflection (water-only)
      if (!reduced) {
        drawCometReflection(gctx, comet, w, h, t);
      }

      // ✅ 4) Subtle water highlight lines (reduced so it won't gray-out)
      gctx.save();
      gctx.globalAlpha = mulIntensity(0.10);
      gctx.strokeStyle = "rgba(180,240,255,0.70)";
      gctx.lineWidth = 1;

      const lines = 7;
      for (let i = 0; i < lines; i++) {
        const yy = waterTop + (i + 1) * (waterH / (lines + 1));
        const amp = 8 + i * 2.3;
        const freq = 0.012 + i * 0.0015;

        gctx.beginPath();
        for (let x = 0; x <= w; x += 18) {
          const yv =
            yy +
            Math.sin(x * freq + time * (1.25 + i * 0.08)) * amp * 0.22 +
            Math.sin(x * freq * 2.4 + time * 0.9) * amp * 0.12;
          if (x === 0) gctx.moveTo(x, yv);
          else gctx.lineTo(x, yv);
        }
        gctx.stroke();
      }
      gctx.restore();

      // ✅ 5) Warm sheen near the horizon (helps “water reads as water”)
      const sheen = gctx.createLinearGradient(0, waterTop, 0, waterTop + waterH * 0.32);
      sheen.addColorStop(0, `rgba(255,170,120,${mulIntensity(0.09)})`);
      sheen.addColorStop(0.45, `rgba(120,180,255,${mulIntensity(0.06)})`);
      sheen.addColorStop(1, "rgba(0,0,0,0)");
      gctx.fillStyle = sheen;
      gctx.fillRect(0, waterTop, w, waterH * 0.42);
    };

    const drawVignette = (gctx: CanvasRenderingContext2D, w: number, h: number) => {
      const v = gctx.createRadialGradient(
        w * 0.5,
        h * 0.3,
        120,
        w * 0.5,
        h * 0.3,
        Math.max(w, h)
      );
      v.addColorStop(0, `rgba(120,70,220,${mulIntensity(0.05)})`);
      v.addColorStop(0.55, `rgba(0,0,0,${mulIntensity(0.14)})`);
      v.addColorStop(1, `rgba(0,0,0,${mulIntensity(0.72)})`);
      gctx.fillStyle = v;
      gctx.fillRect(0, 0, w, h);
    };

    /* ---------------- Tick ---------------- */

    const tick = (ts: number) => {
      const s = stateRef.current;
      if (!s) return;

      if (showHorizonTitan && titanLogoSrc) ensureLogoLoaded(titanLogoSrc);

      const last = s.lastTs || ts;
      const realDt = ts - last;
      const dtMsCountdown = Math.min(250, Math.max(0, realDt));
      s.lastTs = ts;

      const { w, h } = s;

      // 1) OFFSCREEN buffer = reflection source (NO COMET)
      if (s.off && s.offCtx) {
        drawBaseSceneNoComet(s.offCtx, w, h, s, ts);
      }

      // 2) MAIN canvas
      ctx.clearRect(0, 0, w, h);

      if (s.off) {
        ctx.globalAlpha = 1;
        ctx.drawImage(
          s.off,
          0,
          0,
          Math.floor(w * s.dpr),
          Math.floor(h * s.dpr),
          0,
          0,
          w,
          h
        );
      } else {
        drawBaseSceneNoComet(ctx, w, h, s, ts);
      }

      // 3) Draw the COMET ONCE (sky layer), behind mountains
      drawComet(ctx, s.comet, w, h, s.prefersReduced, s.t, dtMsCountdown);

      // 4) Mountains (opaque enough to block comet)
      drawFarMountainsWithTrees(ctx, w, h, s.mtnPts, s.treeSeeds);

      // 5) Water reflection uses OFFSCREEN (stars+logo) + dedicated comet reflection pass
      if (s.off) drawWater(ctx, s.off, w, h, s.t, s.comet, s.prefersReduced);

      // 6) Vignette
      drawVignette(ctx, w, h);

      s.t += 1;
      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      stateRef.current = null;

      // ✅ RELEASE SINGLETON (only if we own it)
      const cur = ww[GG_STARFIELD_SINGLETON_KEY] as
        | { active: boolean; ownerId: string | null }
        | undefined;
      if (cur?.ownerId === ownerId)
        ww[GG_STARFIELD_SINGLETON_KEY] = { active: false, ownerId: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    density,
    disableComet,
    intensity,

    showHorizonTitan,
    titanLogoSrc,
    titanOpacity,
    titanScale,
    titanHorizonCut,
  ]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className || ""}`}
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 top-[84%] h-[60%] w-[180%] -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-35"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,150,95,0.16), rgba(170,90,205,0.08), rgba(0,0,0,0))",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

/* ---------------- Types ---------------- */

type Star = {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  tw: number;
  phase: number;
  hueShift: number;
};

type TreeSeed = {
  x01: number; // 0..1
  s: number; // scale
  a: number; // alpha multiplier
};

type Comet = {
  active: boolean;
  nextMs: number; // ms until next comet
  scheduleIndex: number; // 0->3s, 1->15s, 2->23s (then stays at 2)
  x: number;
  y: number;
  vx: number;
  vy: number;
  tail: number;
  glow: number;
  wobble: number;
};