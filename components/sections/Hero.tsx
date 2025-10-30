"use client";

import { motion } from "framer-motion";
import * as React from "react";

export default function Hero() {
  const ref = React.useRef<HTMLElement>(null);
  return (
    <section id="Glass Guardian" className="hero" ref={ref as any}>
      <div className="section-inner section-anchor">
        <motion.div
          className="gradient-border"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ padding: 24, borderRadius: 24 }}
        >
          <div className="card-glass" style={{ padding: 36, borderRadius: 20 }}>
            <h1>Glass Guardian Chip and Crack Repair</h1>
            <p>
              Mobile chip & crack repair done right — insurance-friendly, fast, and guaranteed.
              We come to you, restore clarity, and back it with a 1 year warranty.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18 }}>
              <a className="gg-btn" href="#pricing">See Price</a>
              <a className="gg-btn" href="#billing">Insurance</a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}