// components/Parallax.tsx
"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type Props = {
  strength?: number;   // pixels of max translateY
  scale?: number;      // slight upscale to hide edges while parallaxing
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export default function Parallax({ strength = 40, scale = 1.02, children, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [strength, -strength]);

  return (
    <motion.div ref={ref} className={className} style={{ y, scale, willChange: "transform", ...style }}>
      {children}
    </motion.div>
  );
}