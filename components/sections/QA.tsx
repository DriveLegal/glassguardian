"use client";

import { motion } from "framer-motion";
import * as React from "react";

export default function QA() {
  const ref = React.useRef<HTMLElement>(null);
  const faqs = [
    {
      q: "Will the blemish disappear completely?",
      a: "Most chips become 80–95% less visible. The main goal is structural: stop spreading and restore strength."
    },
    { q: "How long does it take?", a: "Typically 20–40 minutes. Complex cracks can take longer depending on length and position." },
    { q: "Is it safe to drive right after?", a: "Yes. The resin is UV-cured on site; you can drive immediately." },
    { q: "Do you guarantee the work?", a: "1 year warranty against spread on the repaired spot. Manage warranty details in your account." },
  ];

  return (
    <section id="qa" ref={ref as any}>
      <div className="section-inner section-anchor">
        <h2 className="section-title">Q&A</h2>
        <p className="section-sub">Answers to common questions about chip & crack repair.</p>

        <div style={{ display: "grid", gap: 12 }}>
          {faqs.map((item, i) => (
            <motion.details
              key={item.q}
              className="card-glass"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              style={{ padding: 18, borderRadius: 16 }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>{item.q}</summary>
              <p style={{ color: "var(--muted)", marginTop: 10 }}>{item.a}</p>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}