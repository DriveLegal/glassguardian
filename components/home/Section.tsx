// components/Section.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

type Props = {
  id: string;
  index: number;       // used to stagger slightly
  className?: string;
  children: React.ReactNode;
};

export default function Section({ id, index, className = "", children }: Props) {
  return (
    <motion.section
      id={id}
      className={`gg-section ${className}`.trim()}
      initial={{ opacity: 0, y: 40, scale: 0.97, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: false, amount: 0.25 }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        delay: Math.min(index * 0.03, 0.12),
      }}
      style={{ willChange: "opacity, transform, filter" }}
    >
      <div className="section-inner section-anchor">{children}</div>
    </motion.section>
  );
}