// components/sections/Billing.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

export default function Billing() {
  const ref = React.useRef<HTMLElement>(null);

  return (
    <section id="billing" ref={ref as any}>
      <div className="section-inner section-anchor">
        <h2 className="section-title">Billing &amp; insurance</h2>
        <p className="section-sub">
          We work with major insurers for chip &amp; crack repair. Many policies waive deductibles for repairs,
           making the repair no cost for the customer. Find out more by booking an appointment. One of our technicians
           will contact you asap with more information
        </p>

        <motion.div
          className="gradient-border"
          style={{ padding: 2, borderRadius: 20 }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card-glass" style={{ padding: 24, borderRadius: 18 }}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>Guidance with NoFault Glass-Only Claims</li>
              <li>Instant PDF invoice by email</li>
              <li>NO COST for repairs</li>
            </ul>

            {/* ✅ Centered buttons */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <button
                className="gg-btn"
                onClick={() => {
                  try {
                    window.dispatchEvent(new CustomEvent("gg:open-booking"));
                  } catch {
                    // ignore
                  }
                }}
              >
                Book
              </button>

              <a className="gg-btn" href="#pricing">
                See out-of-pocket price
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}