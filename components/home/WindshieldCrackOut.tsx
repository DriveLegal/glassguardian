// components/home/WindshieldCrackOut.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/* -----------------------------------------------------------
   TS augmentation: optional createConicGradient on 2D context
----------------------------------------------------------- */
declare global {
  interface CanvasRenderingContext2D {
    createConicGradient?(
      startAngle: number,
      x: number,
      y: number
    ): CanvasGradient;
  }
}

type Vec = { x: number; y: number };
type CrackPath = {
  points: Vec[];
  dir: number;
  speed: number;
  life: number;
  width: number;
  branchChance: number;
};
type Ring = { cx: number; cy: number; r: number; alpha: number };

/**
 * ✅ Make stress actually matter.
 * Old: 0..1 mapped to 0..0.05 (too subtle)
 * New: 0..1 mapped to 0..0.22 with a nonlinear curve
 */
const STRESS_SCALE = 0.22;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * ✅ Nonlinear response curve:
 * - gives more range in the middle/high end
 * - still controllable at the low end
 */
const stressCurve = (u: number) => Math.pow(clamp01(u), 1.25);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(!!mq.matches);
    apply();
    if (typeof mq.addEventListener === "function")
      mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (typeof mq.removeEventListener === "function")
        mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);
  return reduced;
}

export default function WindshieldCrackOut({
  height = 420,
  stress = 0.45,
  autoStart = true,
}: {
  height?: number;
  stress?: number;
  autoStart?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassContainerRef = useRef<HTMLDivElement | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

  const [running, setRunning] = useState<boolean>(
    prefersReducedMotion ? false : !!autoStart
  );
  const [uiStress, setUiStress] = useState<number>(clamp01(stress));
  const [healing, setHealing] = useState<number>(0);
  const raf = useRef<number | null>(null);

  // Ref mirrors
  const runningRef = useRef(running);
  const uiStressRef = useRef(uiStress);
  const healingRef = useRef(healing);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    uiStressRef.current = clamp01(uiStress);
  }, [uiStress]);
  useEffect(() => {
    healingRef.current = clamp01(healing);
  }, [healing]);

  // Visibility / lifecycle guards
  const visibleRef = useRef(true);
  const inViewRef = useRef(true);

  const cracks = useRef<CrackPath[]>([]);
  const rings = useRef<Ring[]>([]);
  const flash = useRef<{ t: number; x: number; y: number; life: number }>({
    t: 0,
    x: 0,
    y: 0,
    life: 0,
  });

  // Impact memory (for later ignition)
  const impactPoints = useRef<Vec[]>([]);
  const fullFractureRef = useRef(false);

  // Rock projectile
  const rock = useRef({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 6,
    rot: 0,
    rotVel: 0.12,
    tx: 0,
    ty: 0,
  });

  // Rock sprite
  const spriteImg = useRef<HTMLImageElement | null>(null);
  const spriteLoaded = useRef(false);

  useEffect(() => {
    const img = new Image();
    const svgStr = `
      <svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
        <defs>
          <radialGradient id='g' cx='30%' cy='30%'>
            <stop offset='0' stop-color='#ffffff' stop-opacity='0.85'/>
            <stop offset='0.45' stop-color='#d9d9d9' stop-opacity='0.95'/>
            <stop offset='1' stop-color='#6b6b6b' stop-opacity='0.95'/>
          </radialGradient>
        </defs>
        <g>
          <ellipse cx='64' cy='64' rx='42' ry='36' fill='url(#g)' />
          <path d='M32,64 C36,48 52,36 70,36 C88,36 104,48 100,64 C96,80 80,92 62,92 C44,92 30,80 32,64 Z' fill='rgba(0,0,0,0.06)' />
          <circle cx='52' cy='50' r='6' fill='rgba(255,255,255,0.55)' />
        </g>
      </svg>
    `.trim();
    const svg = encodeURIComponent(svgStr);
    img.src = `data:image/svg+xml;charset=utf-8,${svg}`;
    img.onload = () => {
      spriteImg.current = img;
      spriteLoaded.current = true;
    };
    img.onerror = () => {
      spriteImg.current = null;
      spriteLoaded.current = false;
    };
  }, []);

  // Auto-rock targeting rotation
  const spawnIndex = useRef(0);

  // Impact limit
  const impactsCount = useRef(0);
  const MAX_IMPACTS = 2;

  // DPR clamp
  const dpr = useCallback(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  }, []);

  // Effects
  const roadShockRef = useRef({ active: false, start: 0 });
  const tempSwingRef = useRef({ active: false, start: 0 });
  const doorSlamRef = useRef({ active: false, start: 0, duration: 400 });
  const roadLastMicro = useRef(0);

  // Canvas sizing cache
  const sizeRef = useRef({ w: 0, h: 0, pr: 1 });

  // ✅ Stress helper: “effective” stress used everywhere (0..~0.22)
  const stressS = () => stressCurve(uiStressRef.current) * STRESS_SCALE;

  // ----- Windshield geometry -----
  const getGlassRect = (w: number, h: number) => {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const W = w * 0.82;
    const H = h * 0.36;
    const r = Math.max(12, Math.min(28, Math.round(h * 0.06)));
    const bend = 0.12;
    return { cx, cy, W, H, r, bend };
  };

  const pathRoundedBend = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    bend = 0.12
  ) => {
    const bez = (xx: number) => -((xx / (w / 2)) ** 2) * (h * bend);
    ctx.moveTo(x + r, y + bez(-w / 2));
    ctx.lineTo(x + w - r, y + bez(w / 2));
    ctx.quadraticCurveTo(
      x + w,
      y + bez(w / 2),
      x + w,
      y + r + bez(w / 2)
    );
    ctx.lineTo(x + w, y + h - r + bez(w / 2));
    ctx.quadraticCurveTo(
      x + w,
      y + h + bez(w / 2),
      x + w - r,
      y + h + bez(w / 2)
    );
    ctx.lineTo(x + r, y + h + bez(-w / 2));
    ctx.quadraticCurveTo(
      x,
      y + h + bez(-w / 2),
      x,
      y + h - r + bez(-w / 2)
    );
    ctx.lineTo(x, y + r + bez(-w / 2));
    ctx.quadraticCurveTo(x, y + bez(-w / 2), x + r, y + bez(-w / 2));
  };

  const beginGlassClip = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) => {
    const { cx, cy, W, H, r, bend } = getGlassRect(w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.clip();
    ctx.translate(-cx, -cy);
  };
  const endClip = (ctx: CanvasRenderingContext2D) => ctx.restore();

  const insideGlass = (x: number, y: number, w: number, h: number) => {
    const { cx, cy, W, H } = getGlassRect(w, h);
    return (
      x >= cx - W / 2 &&
      x <= cx + W / 2 &&
      y >= cy - H / 2 &&
      y <= cy + H / 2
    );
  };

  // ----- FRACTURE IGNITION -----
  const igniteFracture = useCallback(() => {
    if (fullFractureRef.current) return;
    fullFractureRef.current = true;

    const s = stressS();

    cracks.current = cracks.current.map((c) => ({
      ...c,
      life: c.life + 110 + Math.floor(s * 420),
      branchChance: Math.max(c.branchChance, 0.09 + s * 0.55),
      speed: c.speed * (1.1 + s * 1.1),
      width: Math.max(c.width, 1.0),
    }));

    const addBurst = (x: number, y: number) => {
      const power = 1.0 + s * 3.0;
      const rays = 22 + Math.floor(s * 90);
      const baseLen = 7 + Math.random() * 8;

      rings.current.push({
        cx: x,
        cy: y,
        r: 10 + Math.random() * 6,
        alpha: 0.6,
      });

      for (let i = 0; i < rays; i++) {
        const jitter = (Math.random() - 0.5) * 0.28;
        const angle = (i / rays) * Math.PI * 2 + jitter;
        cracks.current.push({
          points: [
            { x, y },
            { x: x + Math.cos(angle) * baseLen, y: y + Math.sin(angle) * baseLen },
          ],
          dir: angle,
          speed: 1.35 + power * 2.6,
          life: 130 + Math.floor(power * 220),
          width: 1.05 + Math.random() * 0.75,
          branchChance: 0.01 + s * 0.55,
        });
      }
    };

    impactPoints.current.forEach((p) => addBurst(p.x, p.y));
  }, []);

  // ----- Impacts -----
  const impactAt = useCallback((x: number, y: number) => {
    if (impactsCount.current >= MAX_IMPACTS) return;

    const s = stressS();

    impactPoints.current.push({ x, y });

    const power = 0.45 + s * 1.2;
    const rays = 2 + Math.floor(s * 2);
    const seedLen = 1.8 + Math.random() * 2.4;

    rings.current.push({ cx: x, cy: y, r: 5 + Math.random() * 3, alpha: 0.55 });

    for (let i = 0; i < rays; i++) {
      const jitter = (Math.random() - 0.5) * 0.35;
      const angle = (i / rays) * Math.PI * 2 + jitter;
      cracks.current.push({
        points: [{ x, y }, { x: x + Math.cos(angle) * seedLen, y: y + Math.sin(angle) * seedLen }],
        dir: angle,
        speed: 0.75 + power * 1.15,
        life: 10 + Math.floor(power * 16),
        width: 0.75 + Math.random() * 0.55,
        branchChance: 0.01 + s * 0.12,
      });
    }

    const micro = 0 + Math.floor(s * 8);
    for (let i = 0; i < micro; i++) {
      const a = Math.random() * Math.PI * 2;
      cracks.current.push({
        points: [{ x, y }],
        dir: a,
        speed: 0.55 + Math.random() * 0.8,
        life: 7 + Math.floor(Math.random() * 12),
        width: 0.45,
        branchChance: 0.01 + s * 0.12,
      });
    }

    flash.current = { t: performance.now(), x, y, life: 150 + Math.floor(s * 260) };
    impactsCount.current = Math.min(MAX_IMPACTS, impactsCount.current + 1);
  }, []);

  const stepCracks = (w: number, h: number) => {
    const s = stressS();

    const next: CrackPath[] = [];
    const MAX = 3000;
    for (const c of cracks.current) {
      if (c.life > 0) {
        const turn = (Math.random() - 0.5) * (0.11 + s * 0.75);
        c.dir += turn;

        const speed = c.speed * (0.9 + Math.random() * 0.2) * (1 + s * 0.35);
        const last = c.points[c.points.length - 1];
        const nx = last.x + Math.cos(c.dir) * speed;
        const ny = last.y + Math.sin(c.dir) * speed;

        if (!insideGlass(nx, ny, w, h)) {
          c.life = 0;
          next.push(c);
          continue;
        }

        c.points.push({ x: nx, y: ny });
        c.life -= 1;

        if (Math.random() < c.branchChance && cracks.current.length + next.length < MAX) {
          const bDir = c.dir + (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.55 + s * 0.6);
          next.push({
            points: [{ ...(c.points[c.points.length - 2] || c.points[c.points.length - 1]) }],
            dir: bDir,
            speed: Math.max(0.6, c.speed * (0.7 + Math.random() * 0.55)),
            life: Math.max(8, Math.floor(c.life * (0.25 + Math.random() * 0.55))),
            width: Math.max(0.5, c.width * 0.65),
            branchChance: c.branchChance * (0.7 + Math.random() * 0.55),
          });
        }

        next.push(c);
      } else {
        next.push(c);
      }
    }
    cracks.current = next;

    for (let i = rings.current.length - 1; i >= 0; i--) {
      const r = rings.current[i];
      r.r += 0.28 + Math.random() * (0.3 + s * 0.6);
      r.alpha -= 0.006 + Math.random() * (0.008 + s * 0.02);
      if (r.alpha <= 0.01) rings.current.splice(i, 1);
    }
  };

  // ----- Drawing helpers -----
  const drawFrit = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    W: number,
    H: number,
    r: number,
    bend: number
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const dots = 160;
    for (let i = 0; i < dots; i++) {
      const t = i / dots;
      const angle = t * Math.PI * 2;
      const ex = (W / 2 - 6) * Math.cos(angle);
      const ey = (H / 2 - 6) * Math.sin(angle) - Math.cos(angle) ** 2 * (H * bend);
      const size = 1 + (i % 4 === 0 ? 0.6 : 0);
      ctx.beginPath();
      ctx.arc(ex, ey, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawRings = (ctx: CanvasRenderingContext2D) => {
    if (!rings.current.length) return;
    const heal = healingRef.current;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineCap = "round";
    for (const r of rings.current) {
      const a = r.alpha * (1 - heal);
      if (a <= 0.01) continue;
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = `rgba(40,40,40,${a})`;
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, r.r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.36})`;
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, r.r + 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawCracks = (ctx: CanvasRenderingContext2D) => {
    if (!cracks.current.length) return;
    const heal = healingRef.current;
    ctx.save();
    ctx.lineCap = "round";

    ctx.strokeStyle = `rgba(36,36,36,${0.95 * (1 - heal)})`;
    for (const c of cracks.current) {
      if (c.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(c.points[0].x, c.points[0].y);
      for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x, c.points[i].y);
      const k = Math.max(0.18, Math.min(1, c.life > 0 ? c.life / 120 : 0));
      ctx.lineWidth = c.life > 0 ? Math.max(0.4, c.width * (0.6 + 0.55 * k)) : Math.max(0.35, c.width * 0.45);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255,255,255,${0.28 * (1 - heal)})`;
    for (const c of cracks.current) {
      if (c.points.length < 2) continue;
      ctx.beginPath();
      const off = 0.6;
      ctx.moveTo(c.points[0].x + off, c.points[0].y + off);
      for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x + off, c.points[i].y + off);
      const k = Math.max(0.18, Math.min(1, c.life > 0 ? c.life / 120 : 0));
      ctx.lineWidth = c.life > 0 ? Math.max(0.28, c.width * 0.5 * k) : Math.max(0.24, c.width * 0.25);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawFlash = (ctx: CanvasRenderingContext2D, now: number) => {
    if (!flash.current.life) return;
    const elapsed = now - flash.current.t;
    if (elapsed > flash.current.life) {
      flash.current.life = 0;
      return;
    }
    const k = 1 - elapsed / flash.current.life;
    if (k <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const r1 = 44 + k * 30;
    const grad = ctx.createRadialGradient(
      flash.current.x,
      flash.current.y,
      0,
      flash.current.x,
      flash.current.y,
      r1
    );
    grad.addColorStop(0, `rgba(255,245,210,${0.22 * k})`);
    grad.addColorStop(0.6, `rgba(255,220,150,${0.11 * k})`);
    grad.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(flash.current.x, flash.current.y, r1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  };

  const drawRock = (ctx: CanvasRenderingContext2D) => {
    if (!rock.current.alive) return;
    const size = Math.max(12, rock.current.r * 2.2);
    ctx.save();
    ctx.translate(rock.current.x, rock.current.y);
    ctx.rotate(rock.current.rot);
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.ellipse(6, 6, rock.current.r * 0.9, rock.current.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (spriteLoaded.current && spriteImg.current) {
      ctx.drawImage(spriteImg.current, -size / 2, -size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.fillStyle = "#6b6b6b";
      ctx.ellipse(0, 0, rock.current.r, rock.current.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.arc(-rock.current.r * 0.32, -rock.current.r * 0.32, rock.current.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  function drawTempAura(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    W: number,
    H: number,
    r: number,
    bend: number,
    now: number
  ) {
    if (!tempSwingRef.current.active) return;

    const s = stressS();
    const elapsed = (now - tempSwingRef.current.start) / 1000;
    const angularSpeed = 0.35;
    const theta = elapsed * angularSpeed;

    const grad = ctx.createConicGradient?.(theta, cx, cy);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const auraWidth = Math.max(8, Math.min(16, Math.floor(H * 0.06 + s * 18)));

    const wobble =
      Math.sin(elapsed * (0.35 + s * 1.2) * Math.PI * 2) * (1.5 + s * 10);
    ctx.translate(wobble, wobble * 0.6);

    ctx.beginPath();
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.setLineDash([]);
    ctx.lineWidth = auraWidth;

    if (grad) {
      grad.addColorStop(0.0, "rgba(80,140,255,0.22)");
      grad.addColorStop(0.2, "rgba(120,110,255,0.26)");
      grad.addColorStop(0.5, "rgba(255,120,120,0.28)");
      grad.addColorStop(0.8, "rgba(120,110,255,0.26)");
      grad.addColorStop(1.0, "rgba(80,140,255,0.22)");
      ctx.strokeStyle = grad;
    } else {
      const lg = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
      lg.addColorStop(0, "rgba(80,140,255,0.22)");
      lg.addColorStop(0.5, "rgba(255,120,120,0.28)");
      lg.addColorStop(1, "rgba(80,140,255,0.22)");
      ctx.strokeStyle = lg;
    }

    ctx.shadowBlur = Math.max(6, auraWidth);
    ctx.shadowColor = "rgba(120,140,255,0.28)";
    ctx.globalAlpha = 0.95;

    ctx.stroke();
    ctx.restore();
  }

  const drawScene = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0.0, "#071028");
    sky.addColorStop(0.35, "#0f1e46");
    sky.addColorStop(0.6, "#0b1a33");
    sky.addColorStop(1, "#071029");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const hg = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.58);
    hg.addColorStop(0, "rgba(160,190,255,0.12)");
    hg.addColorStop(1, "rgba(160,190,255,0.00)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.38, w, h * 0.24);

    let offsetX = 0;
    let offsetY = 0;

    if (doorSlamRef.current.active) {
      const elapsed = now - doorSlamRef.current.start;
      const dur = doorSlamRef.current.duration;
      if (elapsed < dur) {
        const progress = elapsed / dur;
        const amp = (1 - progress) * 12;
        offsetX += (Math.random() - 0.5) * amp;
        offsetY += (Math.random() - 0.5) * amp;
      } else {
        doorSlamRef.current.active = false;
      }
    }

    if (roadShockRef.current.active) {
      const s = stressS();
      const elapsed = (now - roadShockRef.current.start) / 1000;
      const freq = 2.2 + s * 5.0;
      const amp = 4 + s * 34;
      offsetY += Math.sin(elapsed * freq * Math.PI * 2) * amp;

      if (fullFractureRef.current && now - roadLastMicro.current > 260 + (1 - s) * 650) {
        const { cx, cy, W, H } = getGlassRect(w, h);
        const mx = cx - W / 2 + Math.random() * W;
        const my = cy - H / 2 + Math.random() * H;
        const a = Math.random() * Math.PI * 2;
        cracks.current.push({
          points: [{ x: mx, y: my }],
          dir: a,
          speed: 0.4 + Math.random() * 0.6,
          life: 6 + Math.floor(Math.random() * 10),
          width: 0.45,
          branchChance: 0.02 + stressS() * 0.22,
        });
        roadLastMicro.current = now;
      }
    }

    if (tempSwingRef.current.active) {
      const s = stressS();
      const elapsed = (now - tempSwingRef.current.start) / 1000;
      const tfreq = 0.35 + s * 1.2;
      const twobble = Math.sin(elapsed * tfreq * Math.PI * 2) * (1.5 + s * 10);
      offsetX += twobble;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);

    const { cx, cy, W, H, r, bend } = getGlassRect(w, h);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.translate(cx, cy);
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    beginGlassClip(ctx, w, h);

    const tint = ctx.createLinearGradient(0, cy - H / 2, 0, cy + H / 2);
    tint.addColorStop(0, "rgba(210,230,255,0.10)");
    tint.addColorStop(1, "rgba(200,220,255,0.18)");
    ctx.fillStyle = tint;
    ctx.fillRect(cx - W / 2, cy - H / 2, W, H);

    for (let i = 0; i < 5; i++) {
      const bandX = cx - W / 2 + (W * (i + 0.5)) / 5;
      const grd = ctx.createLinearGradient(bandX - 20, cy - H / 2, bandX + 20, cy + H / 2);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.5, `rgba(255,255,255,${0.02 + (i % 2) * 0.02})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(bandX - 20, cy - H / 2, 40, H);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.45, cy - H * 0.18);
    ctx.quadraticCurveTo(cx, cy - H * 0.35, cx + W * 0.45, cy - H * 0.18);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#ffffff";
    for (let i = 0; i < 6; i++) {
      const y = cy + H * 0.18 + i * 6;
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.45, y);
      ctx.lineTo(cx + W * 0.45, y);
      ctx.stroke();
    }
    ctx.restore();

    drawRings(ctx);
    drawCracks(ctx);

    endClip(ctx);

    drawFrit(ctx, cx, cy, W, H, r, bend);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.stroke();
    ctx.restore();

    drawTempAura(ctx, cx, cy, W, H, r, bend, now);
    drawFlash(ctx, now);

    ctx.restore();

    drawRock(ctx);
  };

  const spawnRock = (w: number, h: number, tx: number, ty: number) => {
    if (impactsCount.current >= MAX_IMPACTS) return;

    const startX = Math.max(12, Math.min(w - 12, tx + (Math.random() - 0.5) * 40));
    const startY = -48 - Math.random() * 24;
    const dx = tx - startX;
    const dy = ty - startY;
    const dist = Math.hypot(dx, dy) || 1;

    // ✅ Faster travel at higher stress (more dramatic)
    const s = stressS();
    const travelSpeed = 5 + Math.random() * 3.5 + s * 16;

    const vx = (dx / dist) * travelSpeed + (Math.random() - 0.5) * (0.4 + s * 1.2);
    const vy = (dy / dist) * travelSpeed + (Math.random() - 0.5) * (0.25 + s * 0.8);

    rock.current.alive = true;
    rock.current.x = startX;
    rock.current.y = startY;
    rock.current.vx = vx;
    rock.current.vy = vy;
    rock.current.r = 5 + Math.random() * 7 + s * 7;
    rock.current.rot = Math.random() * Math.PI * 2;
    rock.current.rotVel = 0.06 + Math.random() * 0.18 + s * 0.25;
    rock.current.tx = tx;
    rock.current.ty = ty;
  };

  const stepRock = (w: number, h: number) => {
    if (!rock.current.alive) return;

    rock.current.x += rock.current.vx;
    rock.current.y += rock.current.vy;
    rock.current.vy += 0.14;
    rock.current.rot += rock.current.rotVel;

    const { cx, cy, W, H } = getGlassRect(w, h);
    const glassTop = cy - H / 2;

    const threshold = Math.max(6, rock.current.r * 0.9);
    const dx = rock.current.x - rock.current.tx;
    const dy = rock.current.y - rock.current.ty;
    const distToTarget = Math.hypot(dx, dy);

    if (distToTarget < threshold) {
      const impactX = rock.current.tx;
      const impactY = rock.current.ty;
      rock.current.alive = false;
      impactAt(impactX, impactY);
      return;
    }

    const topMargin = glassTop + Math.max(rock.current.r, H * 0.08);
    if (rock.current.y > topMargin && insideGlass(rock.current.x, rock.current.y, w, h)) {
      const impactX = rock.current.x;
      const impactY = rock.current.y;
      rock.current.alive = false;
      impactAt(impactX, impactY);
      return;
    }

    if (rock.current.x < -120 || rock.current.x > w + 120 || rock.current.y > h + 200) {
      rock.current.alive = false;
    }
  };

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pr = dpr();
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width * pr));
    const h = Math.max(2, Math.floor(rect.height * pr));

    if (sizeRef.current.w !== w || sizeRef.current.h !== h || sizeRef.current.pr !== pr) {
      sizeRef.current = { w, h, pr };
      canvas.width = w;
      canvas.height = h;
    }
  }, [dpr]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    syncCanvasSize();

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    drawScene(ctx, w, h, performance.now());
  }, [syncCanvasSize]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!visibleRef.current || !inViewRef.current || !runningRef.current) {
      raf.current = null;
      return;
    }

    const w = canvas.width || 2;
    const h = canvas.height || 2;

    const s = stressS();

    // ✅ Higher stress = more frequent auto rocks (very noticeable)
    const autoChance = 0.001 + s * 0.02;

    if (
      impactsCount.current < MAX_IMPACTS &&
      Math.random() < autoChance &&
      cracks.current.length < 2500 &&
      !rock.current.alive
    ) {
      const { cx, cy, W, H } = getGlassRect(w, h);
      const targets = [
        { x: cx + (Math.random() - 0.5) * W * 0.06, y: cy + (Math.random() - 0.5) * H * 0.06 },
        { x: cx - W * 0.34 + (Math.random() - 0.5) * W * 0.04, y: cy + H * 0.26 + Math.random() * H * 0.02 },
        { x: cx + W * 0.34 + (Math.random() - 0.5) * W * 0.04, y: cy + (Math.random() - 0.5) * H * 0.06 },
      ];
      const t = targets[spawnIndex.current % targets.length];
      spawnIndex.current = (spawnIndex.current + 1) % targets.length;
      spawnRock(w, h, t.x, t.y);
    }

    stepRock(w, h);
    stepCracks(w, h);
    draw();

    raf.current = requestAnimationFrame(loop);
  }, [draw]);

  const startLoop = useCallback(() => {
    if (raf.current != null) return;
    if (!runningRef.current) return;
    if (!visibleRef.current || !inViewRef.current) return;
    raf.current = requestAnimationFrame(loop);
  }, [loop]);

  const stopLoop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setRunning(false);
      runningRef.current = false;
      stopLoop();
    }
  }, [prefersReducedMotion, stopLoop]);

  useEffect(() => {
    const onVis = () => {
      const vis = typeof document !== "undefined" ? !document.hidden : true;
      visibleRef.current = vis;
      if (!vis) stopLoop();
      else startLoop();
    };
    if (typeof document !== "undefined") {
      onVis();
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }
  }, [startLoop, stopLoop]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const any = entries.some((e) => e.isIntersecting);
        inViewRef.current = any;
        if (!any) stopLoop();
        else startLoop();
      },
      { threshold: [0, 0.1], rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [startLoop, stopLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") {
      syncCanvasSize();
      return;
    }
    const ro = new ResizeObserver(() => {
      syncCanvasSize();
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw, syncCanvasSize]);

  useEffect(() => {
    runningRef.current = running;
    if (running) startLoop();
    else stopLoop();
  }, [running, startLoop, stopLoop]);

  const onRepair = useCallback(() => {
    setHealing(0);
    const start = performance.now();
    const dur = 900;
    let handle: number | null = null;

    const fade = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setHealing(k);
      healingRef.current = k;

      if (k < 1) {
        handle = requestAnimationFrame(fade);
      } else {
        cracks.current = [];
        rings.current = [];
        flash.current.life = 0;
        impactsCount.current = 0;
        impactPoints.current = [];
        fullFractureRef.current = false;
        roadShockRef.current.active = false;
        tempSwingRef.current.active = false;
        doorSlamRef.current.active = false;
        rock.current.alive = false;

        if (glassContainerRef.current) {
          glassContainerRef.current.style.boxShadow = "";
          glassContainerRef.current.style.border = "";
        }

        setTimeout(() => {
          setHealing(0);
          healingRef.current = 0;
          draw();
        }, 120);
      }
    };

    handle = requestAnimationFrame(fade);
    return () => {
      if (handle != null) cancelAnimationFrame(handle);
    };
  }, [draw]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (impactsCount.current >= MAX_IMPACTS) return;

      const rect = canvas.getBoundingClientRect();
      const pr = dpr();
      const cw = canvas.width || Math.floor(rect.width * pr);
      const ch = canvas.height || Math.floor(rect.height * pr);

      const scaleX = cw / rect.width;
      const scaleY = ch / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (insideGlass(x, y, cw, ch)) {
        if (!rock.current.alive) spawnRock(cw, ch, x, y);
      }
    },
    [dpr]
  );

  const ensureIgnited = useCallback(() => {
    if (!fullFractureRef.current) igniteFracture();
  }, [igniteFracture]);

  const toggleRoadShock = useCallback(() => {
    const next = !roadShockRef.current.active;
    roadShockRef.current.active = next;
    if (next) {
      roadShockRef.current.start = performance.now();
      ensureIgnited();
    }
    draw();
  }, [ensureIgnited, draw]);

  const toggleTempSwing = useCallback(() => {
    const next = !tempSwingRef.current.active;
    tempSwingRef.current.active = next;
    if (next) {
      tempSwingRef.current.start = performance.now();
      ensureIgnited();
    } else if (glassContainerRef.current) {
      glassContainerRef.current.style.boxShadow = "";
      glassContainerRef.current.style.border = "";
    }
    draw();
  }, [ensureIgnited, draw]);

  const triggerDoorSlam = useCallback(() => {
    doorSlamRef.current.active = true;
    doorSlamRef.current.start = performance.now();
    ensureIgnited();
    draw();
  }, [ensureIgnited, draw]);

  const stressLabel = useMemo(() => `${Math.round(clamp01(uiStress) * 100)}%`, [uiStress]);

  return (
    <div
      ref={hostRef}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        padding: 6,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ borderRadius: 12, padding: 0, background: "transparent", width: "100%", maxWidth: 960 }}>
        <div className="ws-toolbar">
          <div className="ws-stress">
            <strong className="ws-stress-label">Stress</strong>
            <input
              className="ws-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={uiStress}
              onChange={(e) => setUiStress(clamp01(parseFloat(e.target.value)))}
              aria-label="Stress"
            />
            <div className="ws-stress-val">{stressLabel}</div>
          </div>

          <div className="ws-actions">
            <button className="gg-btn ws-btn" onClick={() => setRunning((r) => !r)} aria-pressed={running}>
              {running ? "Pause" : "Play"}
            </button>
            <button className="gg-btn ws-btn" onClick={onRepair}>
              Repair
            </button>
            <button
              className="gg-btn ws-btn"
              onClick={toggleRoadShock}
              title="Toggle road shock (bumpy road simulation)"
              aria-pressed={roadShockRef.current.active}
              style={{ background: roadShockRef.current.active ? "rgba(255,200,80,0.12)" : undefined }}
            >
              Road Shock
            </button>
            <button
              className="gg-btn ws-btn"
              onClick={toggleTempSwing}
              title="Toggle temperature swings (rim aura only)"
              aria-pressed={tempSwingRef.current.active}
              style={{ background: tempSwingRef.current.active ? "rgba(200,120,255,0.12)" : undefined }}
            >
              Temp Swing
            </button>
            <button className="gg-btn ws-btn" onClick={triggerDoorSlam} title="Trigger a door-slam vibration">
              Door Slam
            </button>
          </div>
        </div>

        <div
          ref={glassContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "auto",
            borderRadius: 12,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointer}
            style={{
              width: "96%",
              height: "92%",
              display: "block",
              background: "transparent",
              cursor: "crosshair",
              borderRadius: 12,
              touchAction: "manipulation",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              background: "rgba(255,255,255,0.04)",
              padding: "6px 10px",
              borderRadius: 10,
              color: "white",
              fontSize: 12,
              backdropFilter: "blur(4px)",
            }}
            aria-hidden
          >
            Impacts: {impactsCount.current} / {MAX_IMPACTS}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ws-toolbar {
          padding: 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .ws-stress {
          display: grid;
          grid-template-columns: auto minmax(160px, 240px) auto;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .ws-stress-label {
          color: var(--text);
          min-width: 60px;
        }
        .ws-range {
          width: 100%;
        }
        .ws-stress-val {
          color: var(--text);
          opacity: 0.85;
          min-width: 48px;
          text-align: right;
        }

        .ws-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .ws-btn {
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .ws-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .ws-stress {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .ws-stress-label {
            font-weight: 800;
          }
          .ws-stress-val {
            text-align: left;
          }

          .ws-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .ws-actions .ws-btn {
            width: 100%;
            padding: 12px 10px;
            border-radius: 12px;
          }
          .ws-actions .ws-btn:nth-child(1) {
            grid-column: span 1;
          }
          .ws-actions .ws-btn:nth-child(2) {
            grid-column: span 1;
          }
          .ws-actions .ws-btn:nth-child(3) {
            grid-column: span 2;
          }
        }

        @media (max-width: 360px) {
          .ws-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}