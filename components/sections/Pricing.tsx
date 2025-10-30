"use client";

import { motion } from "framer-motion";
import * as React from "react";

export default function Pricing() {
  const ref = React.useRef<HTMLElement>(null);
  const tiers = [
    { name: "Single chip", price: "$60", note: "Most common. Includes UV cure & polish." },
    { name: "Each add’l chip", price: "$25", note: "Same windshield, same visit." },
    { name: "Short crack", price: "$100", note: "Subject to length/position assessment." },
  ];

  return (
    <section id="pricing" ref={ref as any}>
      <div className="section-inner section-anchor">
        <h2 className="section-title">Price</h2>
        <p className="section-sub">Straightforward, no surprises. Multiple chips in the same visit are discounted.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
          {tiers.map((p, i) => (
            <motion.div
              key={p.name}
              className="gradient-border"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="card-glass" style={{ padding: 22, borderRadius: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{p.price}</div>
                </div>
                <p style={{ color: "var(--muted)" }}>{p.note}</p>
                <a className="gg-btn" href="/login">Book / Login</a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}