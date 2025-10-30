"use client";

import { motion } from "framer-motion";
import * as React from "react";

export default function About() {
  const ref = React.useRef<HTMLElement>(null);
  const items = [
    { t: "Fast on-site service", d: "Most repairs 20–40 minutes at your location." },
    { t: "Optical clarity", d: "Reduces the blemish significantly; most chips ~80–95% improved." },
    { t: "Stops spreading", d: "Reinforces the glass to help prevent cracks from growing." },
  ];
  return (
    <section id="about" ref={ref as any}>
      <div className="section-inner section-anchor">
        <h2 className="section-title">About the repair</h2>
        <p className="section-sub">
          We inject professional-grade resin into the chip/crack, cure it with UV, and finish with precision polishing.
          The result: structurally reinforced glass and dramatically reduced visibility.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {items.map((x, i) => (
            <motion.div
              key={x.t}
              className="gradient-border"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
            >
              <div className="card-glass" style={{ padding: 20, borderRadius: 18 }}>
                <h3 style={{ marginTop: 0 }}>{x.t}</h3>
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>{x.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}