// app/tools/generate-assets/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

// ---- helpers ----
function downloadCanvasPNG(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function downloadCanvasJPG(canvas: HTMLCanvasElement, filename: string, quality = 0.92) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/jpeg", quality);
}

function rand(seed: number) {
  // Mulberry32
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Very cheap value noise for normals
function valueNoise(width: number, height: number, r: () => number) {
  const data = new Float32Array(width * height);
  const grid = 64; // coarse grid
  for (let y = 0; y < height; y++) {
    const gy = Math.floor((y / height) * grid);
    const ty = (y / height) * grid - gy;
    for (let x = 0; x < width; x++) {
      const gx = Math.floor((x / width) * grid);
      const tx = (x / width) * grid - gx;

      const r00 = r(), r10 = r(), r01 = r(), r11 = r();
      const a = r00 * (1 - tx) + r10 * tx;
      const b = r01 * (1 - tx) + r11 * tx;
      const v = a * (1 - ty) + b * ty;
      data[y * width + x] = v;
    }
  }
  return data;
}

function normalsFromHeight(
  heightMap: Float32Array,
  width: number,
  height: number,
  strength = 2.0
) {
  const toIndex = (x: number, y: number) =>
    Math.max(0, Math.min(height - 1, y)) * width +
    Math.max(0, Math.min(width - 1, x));

  const out = new Uint8ClampedArray(width * height * 4); // RGBA
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hL = heightMap[toIndex(x - 1, y)];
      const hR = heightMap[toIndex(x + 1, y)];
      const hU = heightMap[toIndex(x, y - 1)];
      const hD = heightMap[toIndex(x, y + 1)];
      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const nx = dx / len, ny = dy / len, nz = dz / len;

      const r = Math.round((nx * 0.5 + 0.5) * 255);
      const g = Math.round((ny * 0.5 + 0.5) * 255);
      const b = Math.round((nz * 0.5 + 0.5) * 255);

      const i = (y * width + x) * 4;
      out[i + 0] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}

export default function GenerateAssets() {
  // Big defaults for crispness
  const [w, setW] = useState(2400);
  const [h, setH] = useState(1200);

  // Crack parameters
  const [seedCrack, setSeedCrack] = useState(1337);
  const [branches, setBranches] = useState(5);
  const [segments, setSegments] = useState(120);
  const [thickness, setThickness] = useState(1.6);
  const [opacity, setOpacity] = useState(0.95);

  // Normal map parameters
  const [seedNorm, setSeedNorm] = useState(999);
  const [strength, setStrength] = useState(1.6);

  const crackCanvasRef = useRef<HTMLCanvasElement>(null);
  const normCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw crack alpha PNG
  const drawCracks = () => {
    const canvas = crackCanvasRef.current!;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    const rnd = rand(seedCrack);
    const ox = w * (0.4 + rnd() * 0.2);
    const oy = h * (0.5 + rnd() * 0.1);

    for (let b = 0; b < branches; b++) {
      const baseAngle = (Math.PI * 2 * b) / branches + rnd() * 0.4;
      let x = ox, y = oy;
      let angle = baseAngle;
      const t = thickness * (0.85 + rnd() * 0.3);

      ctx.beginPath();
      ctx.moveTo(x, y);

      for (let i = 0; i < segments; i++) {
        angle += (rnd() - 0.5) * 0.35;
        const step = Math.max(w, h) * 0.004 * (0.9 + rnd() * 0.5);
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
        ctx.lineTo(x, y);

        // tiny chance to branch
        if (rnd() < 0.06 && i > 12) {
          const branchAngle = angle + (rnd() - 0.5) * 1.2;
          let bx = x, by = y;
          ctx.moveTo(bx, by);
          for (let j = 0; j < segments * 0.25; j++) {
            const step2 = step * (0.8 + rnd() * 0.6);
            bx += Math.cos(branchAngle + (rnd() - 0.5) * 0.25) * step2;
            by += Math.sin(branchAngle + (rnd() - 0.5) * 0.25) * step2;
            ctx.lineTo(bx, by);
          }
          ctx.moveTo(x, y);
        }
      }

      ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
      ctx.lineWidth = t;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // subtle bloom
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.filter = "blur(2px)";
      ctx.stroke();
      ctx.restore();
    }
  };

  // Draw normals JPG
  const drawNormals = () => {
    const canvas = normCanvasRef.current!;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    const r = rand(seedNorm);
    const heights = valueNoise(w, h, r);
    const normals = normalsFromHeight(heights, w, h, strength);

    const img = new ImageData(normals, w, h);
    ctx.putImageData(img, 0, 0);
  };

  useEffect(() => {
    drawCracks();
    drawNormals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Generate Hi-Def Assets</h1>
      <p style={{ color: "var(--muted)" }}>
        Create <code>crack-alpha.png</code> (transparent) and <code>glass-normals.jpg</code> (normal map), then save them into <code>/public/media/</code>.
      </p>

      <div style={{ display: "grid", gap: 24 }}>
        {/* Shared size */}
        <div className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
          <strong>Output size</strong>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <label>W <input type="number" value={w} onChange={e => setW(Math.max(800, Number(e.target.value)||2400))} style={{ width: 100 }} /></label>
            <label>H <input type="number" value={h} onChange={e => setH(Math.max(400, Number(e.target.value)||1200))} style={{ width: 100 }} /></label>
          </div>
        </div>

        {/* Crack */}
        <div className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>crack-alpha.png</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <label>Seed <input type="number" value={seedCrack} onChange={e=>setSeedCrack(Number(e.target.value)||0)} /></label>
            <label>Branches <input type="number" min={3} max={12} value={branches} onChange={e=>setBranches(Math.max(1, Number(e.target.value)||5))} /></label>
            <label>Segments <input type="number" min={40} max={240} value={segments} onChange={e=>setSegments(Math.max(10, Number(e.target.value)||120))} /></label>
            <label>Thickness(px) <input type="number" min={0.5} max={3} step={0.1} value={thickness} onChange={e=>setThickness(Math.max(0.5, Number(e.target.value)||1.6))} /></label>
            <label>Opacity <input type="number" min={0.3} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(Math.min(1, Math.max(0.3, Number(e.target.value)||0.95)))} /></label>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="gg-btn" onClick={drawCracks}>Regenerate</button>
            <button
              className="gg-btn"
              onClick={() => crackCanvasRef.current && downloadCanvasPNG(crackCanvasRef.current, "crack-alpha.png")}
            >
              Download PNG
            </button>
          </div>

          <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
            <canvas ref={crackCanvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        </div>

        {/* Normals */}
        <div className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>glass-normals.jpg</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <label>Seed <input type="number" value={seedNorm} onChange={e=>setSeedNorm(Number(e.target.value)||0)} /></label>
            <label>Strength <input type="number" min={0.5} max={4} step={0.1} value={strength} onChange={e=>setStrength(Math.min(4, Math.max(0.5, Number(e.target.value)||1.6)))} /></label>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="gg-btn" onClick={drawNormals}>Regenerate</button>
            <button
              className="gg-btn"
              onClick={() => normCanvasRef.current && downloadCanvasJPG(normCanvasRef.current, "glass-normals.jpg", 0.92)}
            >
              Download JPG
            </button>
          </div>

          <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
            <canvas ref={normCanvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        </div>
      </div>
    </div>
  );
}