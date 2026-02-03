"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export type SignatureCanvasProps = {
  /** Next.js requires *Action suffix for functions in client entry props */
  onSaveAction: (dataUrl: string) => void;
  disclaimer?: string;
  className?: string;
  /** canvas height in css px (auto DPR scaled internally) */
  height?: number;
};

export default function SignatureCanvas({
  onSaveAction,
  disclaimer,
  className,
  height = 220,
}: SignatureCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  const resizeCanvasForDPR = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    // white bg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  React.useEffect(() => {
    resizeCanvasForDPR();
    const onResize = () => resizeCanvasForDPR();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvasForDPR]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = getPos(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    const l = last.current || p;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827"; // slate-900
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    last.current = p;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    drawing.current = false;
    last.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    onSaveAction(dataUrl);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-2xl border-2 border-gray-200 bg-white shadow-inner p-4">
        <div className="text-sm text-gray-600 mb-3">Customer Signature</div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border border-gray-200 touch-none"
            style={{ height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
          <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-gray-200" />
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClear}>Clear</Button>
          <Button onClick={handleSave}>Save Signature</Button>
        </div>
      </div>

      {disclaimer && (
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">{disclaimer}</p>
      )}
    </div>
  );
}