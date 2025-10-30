// components/Background.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { seasonalConfig } from "@/lib/seasonal";

function isVideo(path?: string) {
  return !!path && /\.(webm|mp4)$/i.test(path);
}
function isImage(path?: string) {
  return !!path && /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(path);
}

export default function Background() {
  const { active, accents, overlayImage, overlayOpacity } = seasonalConfig;
  if (active === "none") return null;

  // Optional accent overrides
  useEffect(() => {
    if (!accents) return;
    const root = document.documentElement;
    if (accents.accentA) root.style.setProperty("--accentA", accents.accentA);
    if (accents.accentB) root.style.setProperty("--accentB", accents.accentB);
    if (accents.accentC) root.style.setProperty("--accentC", accents.accentC);
  }, [accents]);

  const wantsVideo = isVideo(overlayImage);
  const wantsImage = isImage(overlayImage);

  const [forceImage, setForceImage] = useState(false);
  const onVideoError = () => setForceImage(true);

  const baseOpacity = useMemo(() => {
    const v =
      typeof overlayOpacity === "number"
        ? overlayOpacity
        : overlayOpacity != null
        ? Number(overlayOpacity)
        : 0.14;
    return Number.isFinite(v) ? v : 0.14;
  }, [overlayOpacity]);

  // Shared fixed, non-layout style (prevents the blank gap)
  const fixedLayer: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    opacity: baseOpacity,
  };

  if (overlayImage && wantsVideo && !forceImage) {
    return (
      <motion.video
        className="seasonal-layer"
        src={overlayImage}
        autoPlay
        muted
        loop
        playsInline
        onError={onVideoError}
        // IMPORTANT: fixed, no layout height
        style={{ ...fixedLayer, objectFit: "cover", width: "100%", height: "100%" }}
        aria-hidden
        draggable={false}
        // Ambient drift
        animate={{ y: [0, -20, 0], opacity: [baseOpacity, baseOpacity + 0.03, baseOpacity] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  if (overlayImage && wantsImage) {
    return (
      <motion.div
        className="seasonal-layer"
        // IMPORTANT: fixed, no layout height
        style={{
          ...fixedLayer,
          backgroundImage: `url(${overlayImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "repeat",
        }}
        aria-hidden
        // Ambient drift
        animate={{ y: [0, -16, 0], opacity: [baseOpacity, baseOpacity + 0.03, baseOpacity] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  return null;
}