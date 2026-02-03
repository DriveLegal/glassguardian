// components/media/ImageLightbox.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

type SimpleImage = string;
type PhotoObj = { file_url: string; photo_type?: string | null };

type ImageLightboxProps = {
  images: (SimpleImage | PhotoObj)[];
  initialIndex?: number;
  onClose: () => void;
  /** Optional: hide the thumbnail strip */
  hideThumbnails?: boolean;
  /** Optional: allow downloading the current image (default true) */
  allowDownload?: boolean;
};

function getUrl(img: SimpleImage | PhotoObj) {
  return typeof img === "string" ? img : img.file_url;
}
function getAlt(img: SimpleImage | PhotoObj, i: number) {
  if (typeof img === "string") return `image-${i + 1}`;
  return img.photo_type || `image-${i + 1}`;
}

export default function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
  hideThumbnails = false,
  allowDownload = true,
}: ImageLightboxProps) {
  const [index, setIndex] = React.useState(
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0))
  );
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const hadScrollY = React.useRef<number>(0);

  const hasImages = images && images.length > 0;
  const prev = React.useCallback(() => {
    if (!hasImages) return;
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [hasImages, images.length]);

  const next = React.useCallback(() => {
    if (!hasImages) return;
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [hasImages, images.length]);

  // Prevent background scroll while open
  React.useEffect(() => {
    setMounted(true);
    hadScrollY.current = window.scrollY;
    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevPosition = style.position;
    const prevTop = style.top;
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${hadScrollY.current}px`;
    return () => {
      style.overflow = prevOverflow;
      style.position = prevPosition;
      style.top = prevTop;
      window.scrollTo(0, hadScrollY.current);
    };
  }, []);

  // Keyboard controls
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onClose, prev]);

  // Click backdrop to close
  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === containerRef.current) onClose();
  }

  if (!mounted) return null;
  if (!hasImages) return null;

  const src = getUrl(images[index]);

  const content = (
    <div
      ref={containerRef}
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex flex-col"
      aria-modal="true"
      role="dialog"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="text-white/80 text-sm">
          {index + 1} / {images.length}
        </div>
        <div className="flex items-center gap-2">
          {allowDownload && (
            <a
              href={src}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-2 transition"
              aria-label="Download image"
              title="Download image"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-2 transition"
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* Main stage */}
      <div className="relative flex-1 overflow-hidden">
        {/* Prev */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition focus:outline-none"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Next */}
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition focus:outline-none"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Image */}
        <div className="h-full w-full flex items-center justify-center px-4 md:px-8">
          <AnimatePresence mode="popLayout">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              key={src}
              src={src}
              alt={getAlt(images[index], index)}
              className="max-h-[78vh] w-auto select-none rounded-lg shadow-2xl"
              initial={{ opacity: 0.2, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              draggable={false}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Thumbnails */}
      {!hideThumbnails && images.length > 1 && (
        <div className="w-full px-4 md:px-6 py-3 bg-black/60">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {images.map((img, i) => {
              const u = getUrl(img);
              const isActive = i === index;
              return (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`relative shrink-0 h-16 w-24 rounded-md overflow-hidden border transition ${
                    isActive
                      ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.5)]"
                      : "border-white/20 hover:border-white/40"
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt={getAlt(img, i)}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Render on body via portal to avoid stacking & z-index issues
  return createPortal(content, document.body);
}

/* Tip: add to globals.css for hidden scrollbar on thumbnail strip
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/