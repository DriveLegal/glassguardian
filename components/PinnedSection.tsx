// components/PinnedSection.tsx
"use client";

import * as React from "react";
import { motion, useScroll, useTransform } from "framer-motion";

type Step = { title: string; body: string };

export default function PinnedSection({
  id,
  steps,
  media,
}: {
  id: string;
  steps: Step[];
  media?: React.ReactNode; // e.g., an <img> or <video>
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Map scroll to active step index (0..steps.length-1)
  const activeIdx = useTransform(scrollYProgress, [0, 1], [0, steps.length - 1]);

  return (
    <section id={id} style={{ padding: "160px 20px" }}>
      <div ref={ref} style={{ height: steps.length * 80 + "vh" }}>
        {/* Sticky frame (stays while we scroll through steps) */}
        <div
          style={{
            position: "sticky",
            top: 84, // under your fixed header
            maxWidth: 1100,
            margin: "0 auto",
            height: "70vh",
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 24,
            alignItems: "center",
          }}
          className="section-anchor"
        >
          {/* Left: media */}
          <div className="gradient-border" style={{ borderRadius: 20 }}>
            <div className="card-glass" style={{ borderRadius: 18, overflow: "hidden", height: "100%" }}>
              {media}
            </div>
          </div>

          {/* Right: step stack */}
          <div style={{ position: "relative" }}>
            {steps.map((s, i) => {
              const start = i / steps.length;
              const end = (i + 1) / steps.length;
              const op = useTransform(scrollYProgress, [start, end], [1, 0.1]);
              const y = useTransform(scrollYProgress, [start, end], [0, -20]);

              return (
                <motion.div
                  key={s.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: op,
                    y,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{s.title}</h3>
                  <p className="section-sub" style={{ margin: 0 }}>{s.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}