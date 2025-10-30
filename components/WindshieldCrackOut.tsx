"use client";

import React, { useEffect, useRef, useState } from "react";

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

/** How much of the original stress range we want:
 *  0–100% (UI) → 0–5% (old visual). */
const STRESS_SCALE = 0.05;

export default function WindshieldCrackOut({
  height = 420,
  stress = 0.45,
  autoStart = true,
}: {
  height?: number;
  stress?: number;
  autoStart?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassContainerRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(autoStart);
  const [uiStress, setUiStress] = useState(stress);
  const [healing, setHealing] = useState(0);
  const raf = useRef<number | null>(null);

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
    const svg = encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
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
      </svg>`
    );
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
  const dpr = () =>
    typeof window !== "undefined"
      ? Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      : 1;

  // Effects
  const roadShockRef = useRef({ active: false, start: 0 });
  const tempSwingRef = useRef({ active: false, start: 0 });
  const doorSlamRef = useRef({ active: false, start: 0, duration: 400 });
  const roadLastMicro = useRef(0);

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
    ctx.quadraticCurveTo(x + w, y + bez(w / 2), x + w, y + r + bez(w / 2));
    ctx.lineTo(x + w, y + h - r + bez(w / 2));
    ctx.quadraticCurveTo(x + w, y + h + bez(w / 2), x + w - r, y + h + bez(w / 2));
    ctx.lineTo(x + r, y + h + bez(-w / 2));
    ctx.quadraticCurveTo(x, y + h + bez(-w / 2), x, y + h - r + bez(-w / 2));
    ctx.lineTo(x, y + r + bez(-w / 2));
    ctx.quadraticCurveTo(x, y + bez(-w / 2), x + r, y + bez(-w / 2));
  };

  const beginGlassClip = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
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
    return x >= cx - W / 2 && x <= cx + W / 2 && y >= cy - H / 2 && y <= cy + H / 2;
  };

  // ----- FRACTURE IGNITION -----
  const igniteFracture = () => {
    if (fullFractureRef.current) return;
    fullFractureRef.current = true;

    const s = uiStress * STRESS_SCALE;

    // Boost existing segments
    cracks.current = cracks.current.map((c) => ({
      ...c,
      life: c.life + 80 + Math.floor(s * 120),
      branchChance: Math.max(c.branchChance, 0.08 + s * 0.12),
      speed: c.speed * (1.08 + s * 0.42),
      width: Math.max(c.width, 0.9),
    }));

    // Big burst from each impact point
    const addBurst = (x: number, y: number) => {
      const power = 0.9 + s * 1.1;
      const rays = 20 + Math.floor(s * 30);
      const baseLen = 6 + Math.random() * 6;

      rings.current.push({ cx: x, cy: y, r: 10 + Math.random() * 6, alpha: 0.55 });

      for (let i = 0; i < rays; i++) {
        const jitter = (Math.random() - 0.5) * 0.25;
        const angle = (i / rays) * Math.PI * 2 + jitter;
        cracks.current.push({
          points: [{ x, y }, { x: x + Math.cos(angle) * baseLen, y: y + Math.sin(angle) * baseLen }],
          dir: angle,
          speed: 1.2 + power * 2.2,
          life: 120 + Math.floor(power * 180),
          width: 1.0 + Math.random() * 0.6,
          branchChance: 0.1 + s * 0.2,
        });
      }
    };

    impactPoints.current.forEach((p) => addBurst(p.x, p.y));
  };

  // ----- Impacts -----
  const impactAt = (x: number, y: number) => {
    if (impactsCount.current >= MAX_IMPACTS) return;

    const s = uiStress * STRESS_SCALE;

    impactPoints.current.push({ x, y });

    // Tiny chip before ignition
    const power = 0.4 + s * 0.4;
    const rays = 4 + Math.floor(s * 3);
    const seedLen = 1.5 + Math.random() * 2.0;

    rings.current.push({ cx: x, cy: y, r: 5 + Math.random() * 3, alpha: 0.5 });

    for (let i = 0; i < rays; i++) {
      const jitter = (Math.random() - 0.5) * 0.3;
      const angle = (i / rays) * Math.PI * 2 + jitter;
      cracks.current.push({
        points: [{ x, y }, { x: x + Math.cos(angle) * seedLen, y: y + Math.sin(angle) * seedLen }],
        dir: angle,
        speed: 0.6 + power * 1.0,
        life: 8 + Math.floor(power * 10),
        width: 0.7 + Math.random() * 0.4,
        branchChance: 0.005 + s * 0.01,
      });
    }

    // a couple micro scratches
    const micro = 2 + Math.floor(s * 3);
    for (let i = 0; i < micro; i++) {
      const a = Math.random() * Math.PI * 2;
      cracks.current.push({
        points: [{ x, y }],
        dir: a,
        speed: 0.45 + Math.random() * 0.6,
        life: 6 + Math.floor(Math.random() * 8),
        width: 0.5,
        branchChance: 0.005 + s * 0.01,
      });
    }

    flash.current = { t: performance.now(), x, y, life: 130 };
    impactsCount.current = Math.min(MAX_IMPACTS, impactsCount.current + 1);
  };

  const stepCracks = (w: number, h: number) => {
    const s = uiStress * STRESS_SCALE;

    const next: CrackPath[] = [];
    const MAX = 3000;
    for (const c of cracks.current) {
      if (c.life > 0) {
        const turn = (Math.random() - 0.5) * (0.10 + s * 0.14);
        c.dir += turn;
        const speed = c.speed * (0.92 + Math.random() * 0.14);
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
          const bDir = c.dir + (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.36);
          next.push({
            points: [{ ...(c.points[c.points.length - 2] || c.points[c.points.length - 1]) }],
            dir: bDir,
            speed: Math.max(0.6, c.speed * (0.7 + Math.random() * 0.4)),
            life: Math.max(8, Math.floor(c.life * (0.25 + Math.random() * 0.45))),
            width: Math.max(0.5, c.width * 0.6),
            branchChance: c.branchChance * (0.6 + Math.random() * 0.4),
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
      r.r += 0.28 + Math.random() * 0.28;
      r.alpha -= 0.006 + Math.random() * 0.006;
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
      const ey = (H / 2 - 6) * Math.sin(angle) - (Math.cos(angle) ** 2) * (H * bend);
      const size = 1 + (i % 4 === 0 ? 0.6 : 0);
      ctx.beginPath();
      ctx.arc(ex, ey, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawRings = (ctx: CanvasRenderingContext2D) => {
    if (!rings.current.length) return;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineCap = "round";
    for (const r of rings.current) {
      const a = r.alpha * (1 - healing);
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
    ctx.save();
    ctx.lineCap = "round";

    ctx.strokeStyle = `rgba(36,36,36,${0.95 * (1 - healing)})`;
    for (const c of cracks.current) {
      if (c.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(c.points[0].x, c.points[0].y);
      for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x, c.points[i].y);
      const k = Math.max(0.18, Math.min(1, c.life > 0 ? c.life / 100 : 0));
      ctx.lineWidth = c.life > 0 ? Math.max(0.35, c.width * (0.55 + 0.45 * k)) : Math.max(0.33, c.width * 0.4);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255,255,255,${0.26 * (1 - healing)})`;
    for (const c of cracks.current) {
      if (c.points.length < 2) continue;
      ctx.beginPath();
      const off = 0.5;
      ctx.moveTo(c.points[0].x + off, c.points[0].y + off);
      for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x + off, c.points[i].y + off);
      const k = Math.max(0.18, Math.min(1, c.life > 0 ? c.life / 100 : 0));
      ctx.lineWidth = c.life > 0 ? Math.max(0.25, c.width * 0.45 * k) : Math.max(0.22, c.width * 0.22);
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
    const r1 = 44 + k * 24;
    const grad = ctx.createRadialGradient(flash.current.x, flash.current.y, 0, flash.current.x, flash.current.y, r1);
    grad.addColorStop(0, `rgba(255,245,210,${0.18 * k})`);
    grad.addColorStop(0.6, `rgba(255,220,150,${0.08 * k})`);
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

  // ----- Temp Swing aura ONLY around windshield rim (slow + soft) -----
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

    const s = uiStress * STRESS_SCALE;

    // Slow angular travel (constant) + gentle wobble (scaled)
    const elapsed = (now - tempSwingRef.current.start) / 1000;
    const angularSpeed = 0.35; // radians/sec (keep slow)
    const theta = elapsed * angularSpeed;

    const grad = ctx.createConicGradient?.(theta, cx, cy); // CanvasGradient | undefined

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const auraWidth = Math.max(8, Math.min(14, Math.floor(H * 0.06)));

    const wobble = Math.sin(elapsed * (0.35 + s * 0.35) * Math.PI * 2) * (1 + s * 2);
    ctx.translate(wobble, wobble * 0.6);

    ctx.beginPath();
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.setLineDash([]);
    ctx.lineWidth = auraWidth;

    if (grad) {
      grad.addColorStop(0.00, "rgba(80,140,255,0.22)");
      grad.addColorStop(0.20, "rgba(120,110,255,0.24)");
      grad.addColorStop(0.50, "rgba(255,120,120,0.26)");
      grad.addColorStop(0.80, "rgba(120,110,255,0.24)");
      grad.addColorStop(1.00, "rgba(80,140,255,0.22)");
      ctx.strokeStyle = grad;
    } else {
      const lg = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
      lg.addColorStop(0, "rgba(80,140,255,0.22)");
      lg.addColorStop(0.5, "rgba(255,120,120,0.26)");
      lg.addColorStop(1, "rgba(80,140,255,0.22)");
      ctx.strokeStyle = lg;
    }

    ctx.shadowBlur = Math.max(6, auraWidth);
    ctx.shadowColor = "rgba(120,140,255,0.25)";
    ctx.globalAlpha = 0.9;

    ctx.stroke();
    ctx.restore();
  }

  // ----- Scene drawing (windshield-local transforms) -----
  const drawScene = (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => {
    const s = uiStress * STRESS_SCALE;

    // Background
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0.0, "#071028");
    sky.addColorStop(0.35, "#0f1e46");
    sky.addColorStop(0.6, "#0b1a33");
    sky.addColorStop(1, "#071029");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Horizon glow
    const hg = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.58);
    hg.addColorStop(0, "rgba(160,190,255,0.12)");
    hg.addColorStop(1, "rgba(160,190,255,0.00)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.38, w, h * 0.24);

    // Windshield-local offsets
    let offsetX = 0;
    let offsetY = 0;

    // Door slam
    if (doorSlamRef.current.active) {
      const elapsed = now - doorSlamRef.current.start;
      const dur = doorSlamRef.current.duration;
      if (elapsed < dur) {
        const progress = elapsed / dur;
        const amp = (1 - progress) * 10;
        offsetX += (Math.random() - 0.5) * amp;
        offsetY += (Math.random() - 0.5) * amp;
      } else {
        doorSlamRef.current.active = false;
      }
    }

    // Road shock (scaled)
    if (roadShockRef.current.active) {
      const elapsed = (now - roadShockRef.current.start) / 1000;
      const freq = 2.2 + s * 2.0;
      const amp = 4 + s * 8;
      offsetY += Math.sin(elapsed * freq * Math.PI * 2) * amp;

      if (fullFractureRef.current && now - roadLastMicro.current > 300 + (1 - s) * 800) {
        const { cx, cy, W, H } = getGlassRect(w, h);
        const mx = cx - W / 2 + Math.random() * W;
        const my = cy - H / 2 + Math.random() * H;
        const a = Math.random() * Math.PI * 2;
        cracks.current.push({
          points: [{ x: mx, y: my }],
          dir: a,
          speed: 0.4 + Math.random() * 0.6,
          life: 6 + Math.floor(Math.random() * 8),
          width: 0.4,
          branchChance: 0.01 + s * 0.02,
        });
        roadLastMicro.current = now;
      }
    }

    // Temp Swing wobble (scaled)
    if (tempSwingRef.current.active) {
      const elapsed = (now - tempSwingRef.current.start) / 1000;
      const tfreq = 0.35 + s * 0.35; // slower base + tiny stress scaling
      const twobble = Math.sin(elapsed * tfreq * Math.PI * 2) * (1.5 + s * 2.5);
      offsetX += twobble;
    }

    // Draw windshield with offsets
    ctx.save();
    ctx.translate(offsetX, offsetY);

    const { cx, cy, W, H, r, bend } = getGlassRect(w, h);

    // Vignette outside glass with cutout
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

    // Inside glass
    beginGlassClip(ctx, w, h);

    const tint = ctx.createLinearGradient(0, cy - H / 2, 0, cy + H / 2);
    tint.addColorStop(0, "rgba(210,230,255,0.10)");
    tint.addColorStop(1, "rgba(200,220,255,0.18)");
    ctx.fillStyle = tint;
    ctx.fillRect(cx - W / 2, cy - H / 2, W, H);

    // Subtle bands
    for (let i = 0; i < 5; i++) {
      const bandX = cx - W / 2 + (W * (i + 0.5)) / 5;
      const grd = ctx.createLinearGradient(bandX - 20, cy - H / 2, bandX + 20, cy + H / 2);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.5, `rgba(255,255,255,${0.02 + (i % 2) * 0.02})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(bandX - 20, cy - H / 2, 40, H);
    }

    // Curved highlight
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.45, cy - H * 0.18);
    ctx.quadraticCurveTo(cx, cy - H * 0.35, cx + W * 0.45, cy - H * 0.18);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.stroke();
    ctx.restore();

    // Defroster lines
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

    // Cracks & rings
    drawRings(ctx);
    drawCracks(ctx);

    endClip(ctx);

    // Frit / rim
    drawFrit(ctx, cx, cy, W, H, r, bend);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    pathRoundedBend(ctx, -W / 2, -H / 2, W, H, r, bend);
    ctx.stroke();
    ctx.restore();

    // Temp aura around the rim ONLY (after rim so it sits on top)
    drawTempAura(ctx, cx, cy, W, H, r, bend, now);

    // Impact flash
    drawFlash(ctx, now);

    ctx.restore(); // undo windshield translation

    // Rock in front
    drawRock(ctx);
  };

  // ----- Rock spawn/step -----
  const spawnRock = (w: number, h: number, tx: number, ty: number) => {
    if (impactsCount.current >= MAX_IMPACTS) return;

    const startX = Math.max(12, Math.min(w - 12, tx + (Math.random() - 0.5) * 40));
    const startY = -48 - Math.random() * 24;
    const dx = tx - startX;
    const dy = ty - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const travelSpeed = 5 + Math.random() * 3.5;
    const vx = (dx / dist) * travelSpeed + (Math.random() - 0.5) * 0.4;
    const vy = (dy / dist) * travelSpeed + (Math.random() - 0.5) * 0.25;

    rock.current.alive = true;
    rock.current.x = startX;
    rock.current.y = startY;
    rock.current.vx = vx;
    rock.current.vy = vy;
    rock.current.r = 5 + Math.random() * 7;
    rock.current.rot = Math.random() * Math.PI * 2;
    rock.current.rotVel = 0.06 + Math.random() * 0.18;
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

  // ----- Frame loop -----
  const draw = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pr = dpr();
    const w = Math.max(2, Math.floor(canvas.clientWidth * pr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * pr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    drawScene(ctx, w, h, performance.now());
  };

  const loop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pr = dpr();
    const w = canvas.width || Math.floor(canvas.clientWidth * pr);
    const h = canvas.height || Math.floor(canvas.clientHeight * pr);

    // Auto impacts (still tiny until ignition)
    if (
      running &&
      impactsCount.current < MAX_IMPACTS &&
      Math.random() < (0.001 + (uiStress * STRESS_SCALE) * 0.002) &&
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

    stepRock(canvas.width || w, canvas.height || h);
    stepCracks(canvas.width || w, canvas.height || h);

    draw();

    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    if (running) raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, uiStress]);

  // ----- Interactions & UI -----
  const onRepair = () => {
    setHealing(0);
    const start = performance.now();
    const dur = 900;
    let handle: number | null = null;
    const fade = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setHealing(k);
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
        if (glassContainerRef.current) {
          glassContainerRef.current.style.boxShadow = "";
          glassContainerRef.current.style.border = "";
        }
        setTimeout(() => setHealing(0), 120);
      }
    };
    handle = requestAnimationFrame(fade);
  };

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pr = dpr();
    const cw = canvas.width || Math.floor(canvas.clientWidth * pr);
    const ch = canvas.height || Math.floor(canvas.clientHeight * pr);
    const scaleX = cw / rect.width;
    const scaleY = ch / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (impactsCount.current >= MAX_IMPACTS) return;

    if (insideGlass(x, y, cw, ch)) {
      if (!rock.current.alive) {
        spawnRock(cw, ch, x, y);
      }
    }
  };

  const ensureIgnited = () => {
    if (!fullFractureRef.current) igniteFracture();
  };

  const toggleRoadShock = () => {
    const next = !roadShockRef.current.active;
    roadShockRef.current.active = next;
    if (next) {
      roadShockRef.current.start = performance.now();
      ensureIgnited();
    }
  };

  const toggleTempSwing = () => {
    const next = !tempSwingRef.current.active;
    tempSwingRef.current.active = next;
    if (next) {
      tempSwingRef.current.start = performance.now();
      ensureIgnited();
    } else if (glassContainerRef.current) {
      glassContainerRef.current.style.boxShadow = "";
      glassContainerRef.current.style.border = "";
    }
  };

  const triggerDoorSlam = () => {
    doorSlamRef.current.active = true;
    doorSlamRef.current.start = performance.now();
    ensureIgnited();
  };

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        padding: 6,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ borderRadius: 12, padding: 0, background: "transparent", width: "100%", maxWidth: 960 }}>
        <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <strong style={{ color: "var(--text)", minWidth: 60 }}>Stress</strong>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={uiStress}
              onChange={(e) => setUiStress(parseFloat(e.target.value))}
              style={{ width: 200 }}
              aria-label="Stress"
              title="0–100% slider maps to old 0–5% visual intensity"
            />
            <div style={{ color: "var(--text)", opacity: 0.85, minWidth: 48, textAlign: "right" }}>
              {(uiStress * 100).toFixed(0)}%
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="gg-btn" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Play"}
            </button>
            <button className="gg-btn" onClick={onRepair}>
              Repair
            </button>

            <button
              className="gg-btn"
              onClick={toggleRoadShock}
              title="Toggle road shock (bumpy road simulation)"
              style={{ background: roadShockRef.current.active ? "rgba(255,200,80,0.12)" : undefined }}
            >
              Road Shock
            </button>
            <button
              className="gg-btn"
              onClick={toggleTempSwing}
              title="Toggle temperature swings (rim aura only)"
              style={{ background: tempSwingRef.current.active ? "rgba(200,120,255,0.12)" : undefined }}
            >
              Temp Swing
            </button>
            <button className="gg-btn" onClick={triggerDoorSlam} title="Trigger a door-slam vibration">
              Door Slam
            </button>
          </div>
        </div>

        {/* Windshield-only wrapper (kept for layout; no temp glow applied here) */}
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
    </div>
  );
}