// components/forms/SignatureCanvas.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Eraser, PenLine, Undo2 } from "lucide-react";

/**
 * Elite, production-ready signature canvas.
 *
 * NOTE: Canvas does NOT upload to Supabase Storage by itself.
 * It returns a PNG dataURL (cropped) to the parent, and the parent uploads.
 *
 * ✅ Finger-first (mobile) — pointer capture + touchAction none
 * ✅ Crisp lines (DPR scaling)
 * ✅ Smooth ink (velocity-based variable stroke width)
 * ✅ Undo (per-stroke)
 * ✅ Reliable resize (re-renders from stored strokes)
 * ✅ Cropped export (tight signature PNG instead of full blank canvas)
 * ✅ Controlled-mode safe (won’t wipe signature on pointer up)
 */

type ControlledProps = {
  valueDataUrl: string | null;
  onChangeDataUrl: (dataUrl: string | null) => void;
  disabled?: boolean;
  heightPx?: number;
  label?: string;
  showSaveButton?: false;
  disclaimer?: string;
  className?: string;
  exportCropped?: boolean; // default true
  syncDebounceMs?: number; // default 260
};

type LegacyProps = {
  onSave: (dataUrl: string) => void;
  disclaimer?: string;
  disabled?: boolean;
  heightPx?: number;
  label?: string;
  showSaveButton?: true;
  className?: string;
  exportCropped?: boolean; // default true
  syncDebounceMs?: number; // default 260
};

type Props = ControlledProps | LegacyProps;

function isControlled(p: Props): p is ControlledProps {
  return "onChangeDataUrl" in p;
}

type PtT = { x: number; y: number; t: number };
type Stroke = { pts: PtT[] };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function SignatureCanvas(props: Props) {
  const controlled = isControlled(props);
  const controlledProps: ControlledProps | null = controlled ? props : null;
  const legacyProps: LegacyProps | null = !controlled ? (props as LegacyProps) : null;

  const disabled = props.disabled ?? false;
  const heightPx = props.heightPx ?? 170;
  const label = props.label ?? "Draw signature (optional)";
  const disclaimer = props.disclaimer;
  const className = props.className ?? "";
  const exportCropped = props.exportCropped ?? true;
  const syncDebounceMs = props.syncDebounceMs ?? 260;

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);

  // Stored strokes (undo + redraw on resize)
  const strokesRef = React.useRef<Stroke[]>([]);
  const activeStrokeRef = React.useRef<Stroke | null>(null);

  const isDrawing = React.useRef(false);
  const lastPtRef = React.useRef<PtT | null>(null);
  const lastWidthRef = React.useRef<number>(2.6);

  const [isEmpty, setIsEmpty] = React.useState(true);

  // Controlled-mode: prevent repaint loops / wiping
  const lastEmittedUrlRef = React.useRef<string | null>(null);

  // Debounced controlled sync
  const syncTimer = React.useRef<number | null>(null);
  const pendingSync = React.useRef(false);

  const getBundle = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current ?? canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return null;
    if (!ctxRef.current) ctxRef.current = ctx;
    return { canvas, ctx };
  }, []);

  const getCssSize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { w: 1, h: 1 };
    const rect = canvas.getBoundingClientRect();
    return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
  }, []);

  const applyDprTransformAndStyle = React.useCallback(() => {
    const bundle = getBundle();
    if (!bundle) return;
    const { canvas, ctx } = bundle;

    const dpr = window.devicePixelRatio || 1;

    const css = getCssSize();
    const targetW = Math.max(1, Math.floor(css.w * dpr));
    const targetH = Math.max(1, Math.floor(css.h * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Draw in CSS px
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.strokeStyle = "rgba(226,232,240,0.95)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    (ctx as any).imageSmoothingEnabled = true;
  }, [getBundle, getCssSize]);

  const clearDeviceCanvas = React.useCallback(() => {
    const bundle = getBundle();
    if (!bundle) return;
    const { canvas, ctx } = bundle;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    applyDprTransformAndStyle();
  }, [applyDprTransformAndStyle, getBundle]);

  const getXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x: clamp(x, 0, rect.width), y: clamp(y, 0, rect.height) };
  };

  const computeWidth = React.useCallback((prev: PtT, cur: PtT) => {
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Math.max(1, cur.t - prev.t);
    const v = dist / dt; // px/ms

    const minW = 1.6;
    const maxW = 4.2;

    const vn = clamp(v / 1.0, 0, 1.2);
    const raw = maxW - (maxW - minW) * vn;

    const last = lastWidthRef.current;
    const smoothed = last * 0.75 + raw * 0.25;
    lastWidthRef.current = smoothed;

    return smoothed;
  }, []);

  const drawDot = React.useCallback((pt: PtT, radius: number) => {
    const bundle = getBundle();
    if (!bundle) return;
    const { ctx } = bundle;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = String(ctx.strokeStyle);
    ctx.fill();
  }, [getBundle]);

  const drawSegment = React.useCallback(
    (prev: PtT, cur: PtT) => {
      const bundle = getBundle();
      if (!bundle) return;
      const { ctx } = bundle;

      const w = computeWidth(prev, cur);
      ctx.lineWidth = w;

      const midX = (prev.x + cur.x) / 2;
      const midY = (prev.y + cur.y) / 2;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.quadraticCurveTo(cur.x, cur.y, cur.x, cur.y);
      ctx.stroke();
    },
    [computeWidth, getBundle]
  );

  const redrawAll = React.useCallback(() => {
    clearDeviceCanvas();

    const strokes = strokesRef.current;
    let any = false;

    for (const s of strokes) {
      const pts = s.pts;
      if (!pts.length) continue;
      any = true;

      lastWidthRef.current = 2.6;

      if (pts.length === 1) {
        drawDot(pts[0], 2.2);
        continue;
      }

      for (let i = 1; i < pts.length; i++) {
        drawSegment(pts[i - 1], pts[i]);
      }
    }

    setIsEmpty(!any);
  }, [clearDeviceCanvas, drawDot, drawSegment]);

  const exportDataUrl = React.useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const strokes = strokesRef.current;
    if (!strokes.length) return null;

    if (!exportCropped) {
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const s of strokes) {
      for (const p of s.pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;

    const pad = 10;
    const css = canvas.getBoundingClientRect();

    const cropX = clamp(minX - pad, 0, css.width);
    const cropY = clamp(minY - pad, 0, css.height);
    const cropW = clamp(maxX - minX + pad * 2, 1, css.width - cropX);
    const cropH = clamp(maxY - minY + pad * 2, 1, css.height - cropY);

    const dpr = window.devicePixelRatio || 1;

    const sx = Math.floor(cropX * dpr);
    const sy = Math.floor(cropY * dpr);
    const sw = Math.ceil(cropW * dpr);
    const sh = Math.ceil(cropH * dpr);

    if (sw <= 0 || sh <= 0) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let imageData: ImageData | null = null;
    try {
      imageData = ctx.getImageData(sx, sy, sw, sh);
    } catch {
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    }

    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext("2d");
    if (!tctx) return null;
    tctx.putImageData(imageData, 0, 0);

    try {
      return tmp.toDataURL("image/png");
    } catch {
      return null;
    }
  }, [exportCropped]);

  const flushControlledSyncNow = React.useCallback(() => {
    if (!controlledProps) return;
    const url = exportDataUrl();
    lastEmittedUrlRef.current = url;
    controlledProps.onChangeDataUrl(url);
  }, [controlledProps, exportDataUrl]);

  const scheduleControlledSync = React.useCallback(
    (delayMs: number) => {
      if (!controlledProps) return;

      pendingSync.current = true;

      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        syncTimer.current = null;
        if (!pendingSync.current) return;
        pendingSync.current = false;

        const url = exportDataUrl();
        lastEmittedUrlRef.current = url;
        controlledProps.onChangeDataUrl(url);
      }, delayMs);
    },
    [controlledProps, exportDataUrl]
  );

  const clear = React.useCallback(() => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    isDrawing.current = false;
    lastPtRef.current = null;
    lastWidthRef.current = 2.6;

    clearDeviceCanvas();
    setIsEmpty(true);

    if (controlledProps) {
      lastEmittedUrlRef.current = null;
      controlledProps.onChangeDataUrl(null);
    }
  }, [clearDeviceCanvas, controlledProps]);

  const undo = React.useCallback(() => {
    const strokes = strokesRef.current;
    if (!strokes.length) return;

    strokes.pop();
    activeStrokeRef.current = null;
    isDrawing.current = false;
    lastPtRef.current = null;
    lastWidthRef.current = 2.6;

    redrawAll();

    if (controlledProps) {
      const url = exportDataUrl();
      lastEmittedUrlRef.current = url;
      controlledProps.onChangeDataUrl(url);
    }
  }, [controlledProps, exportDataUrl, redrawAll]);

  const resize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${heightPx}px`;

    applyDprTransformAndStyle();
    redrawAll();
  }, [applyDprTransformAndStyle, heightPx, redrawAll]);

  React.useEffect(() => {
    resize();
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => resize());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [resize]);

  const paintDataUrl = React.useCallback(
    async (dataUrl: string | null) => {
      // Reset strokes because we cannot reconstruct from bitmap.
      strokesRef.current = [];
      activeStrokeRef.current = null;
      isDrawing.current = false;
      lastPtRef.current = null;
      lastWidthRef.current = 2.6;

      clearDeviceCanvas();

      if (!dataUrl) {
        setIsEmpty(true);
        return;
      }

      const bundle = getBundle();
      if (!bundle) return;
      const { canvas, ctx } = bundle;

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          const cssW = canvas.width / dpr;
          const cssH = canvas.height / dpr;

          ctx.clearRect(0, 0, cssW, cssH);
          ctx.drawImage(img, 0, 0, cssW, cssH);

          setIsEmpty(false);
          resolve();
        };
        img.onerror = () => {
          setIsEmpty(true);
          resolve();
        };
        img.src = dataUrl;
      });
    },
    [clearDeviceCanvas, getBundle]
  );

  React.useEffect(() => {
    if (!controlledProps) return;

    const incoming = controlledProps.valueDataUrl ?? null;

    // if drawing, don't repaint
    if (isDrawing.current) return;

    // ignore values we emitted
    if (incoming && lastEmittedUrlRef.current && incoming === lastEmittedUrlRef.current) return;
    if (!incoming && !lastEmittedUrlRef.current) return;

    paintDataUrl(incoming);
  }, [controlledProps, paintDataUrl]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const { x, y } = getXY(e);
    const now = performance.now();
    const pt: PtT = { x, y, t: now };

    isDrawing.current = true;
    setIsEmpty(false);

    const stroke: Stroke = { pts: [pt] };
    strokesRef.current.push(stroke);
    activeStrokeRef.current = stroke;

    lastPtRef.current = pt;
    lastWidthRef.current = 3.2;

    drawDot(pt, 2.4);
    scheduleControlledSync(Math.max(120, syncDebounceMs));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (!isDrawing.current) return;

    e.preventDefault();

    const stroke = activeStrokeRef.current;
    if (!stroke) return;

    const { x, y } = getXY(e);
    const now = performance.now();
    const pt: PtT = { x, y, t: now };

    const prev = lastPtRef.current;
    if (!prev) {
      stroke.pts.push(pt);
      lastPtRef.current = pt;
      drawDot(pt, 2.2);
      scheduleControlledSync(syncDebounceMs);
      return;
    }

    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.6) return;

    stroke.pts.push(pt);
    drawSegment(prev, pt);
    lastPtRef.current = pt;

    scheduleControlledSync(syncDebounceMs);
  };

  const finishStroke = () => {
    if (!isDrawing.current) return;

    isDrawing.current = false;
    activeStrokeRef.current = null;
    lastPtRef.current = null;
    lastWidthRef.current = 2.6;

    if (controlledProps) flushControlledSyncNow();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    finishStroke();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    finishStroke();
  };

  const saveLegacy = () => {
    if (!legacyProps) return;
    const url = exportDataUrl();
    if (url) legacyProps.onSave(url);
  };

  const showSave =
    (!controlledProps && (props.showSaveButton === true || props.showSaveButton === undefined));

  const canUndo = strokesRef.current.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <PenLine className="h-4 w-4 text-emerald-300" />
            {label}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={undo}
              disabled={disabled || !canUndo}
              className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={clear}
              disabled={disabled || isEmpty}
              className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40">
          <canvas
            ref={canvasRef}
            className={disabled ? "w-full pointer-events-none" : "w-full"}
            style={{
              height: `${heightPx}px`,
              touchAction: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
              display: "block",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        </div>

        <p className="text-xs text-slate-400 pt-2">Tip: if you skip drawing, we’ll record a typed signature.</p>
      </motion.div>

      {disclaimer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl border border-sky-400/20 bg-sky-500/10"
        >
          <p className="text-[0.7rem] font-semibold text-sky-100 mb-1 tracking-wider">DISCLAIMER</p>
          <p className="text-xs text-sky-100/90 leading-relaxed">{disclaimer}</p>
        </motion.div>
      )}

      {!controlledProps && showSave && (
        <div className="flex gap-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={clear}
              disabled={disabled || isEmpty}
              className="w-full h-12 font-semibold border-white/15 bg-white/5 hover:bg-white/10 text-slate-100"
            >
              CLEAR
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
            <Button
              type="button"
              onClick={saveLegacy}
              disabled={disabled || isEmpty}
              className="w-full h-12 font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_12px_35px_rgba(16,185,129,0.18)]"
            >
              SAVE
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}