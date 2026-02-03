"use client";

import * as React from "react";

export default function UserLayoutTopDiamond() {
  return (
    <div
      aria-hidden
      className="relative flex h-[1.55rem] w-[1.55rem] items-center justify-center"
    >
      <div className="orb-shell">
        <div className="orb-core" />
        <div className="orb-halo" />
      </div>

      <style jsx>{`
        .orb-shell {
          width: 1.55rem;
          height: 1.55rem;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          filter: drop-shadow(0 6px 18px rgba(56, 189, 248, 0.32));
        }

        .orb-core {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 999px;
          border: 1px solid rgba(148, 196, 255, 0.95);
          overflow: hidden;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow:
            0 0 0 1px rgba(15, 23, 42, 0.9) inset,
            0 0 18px rgba(56, 189, 248, 0.7);

          background-image:
            radial-gradient(circle at 15% 10%, rgba(129, 230, 217, 0.9), transparent 55%),
            radial-gradient(circle at 80% 20%, rgba(96, 165, 250, 0.9), transparent 60%),
            radial-gradient(circle at 20% 85%, rgba(196, 181, 253, 0.9), transparent 55%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.85), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.94));
          background-blend-mode: screen;
          background-size: 180% 180%;

          /* ULTRA SLOW: clouds + hue */
          animation:
            orb-cloud-move 90s ease-in-out infinite alternate,
            orb-hue-shift 180s linear infinite;
        }

        .orb-halo {
          position: absolute;
          inset: -22%;
          border-radius: 999px;
          background: radial-gradient(
            circle at 50% 40%,
            rgba(191, 219, 254, 0.32),
            transparent 70%
          );
          mix-blend-mode: screen;
          pointer-events: none;
        }

        @keyframes orb-cloud-move {
          0% {
            background-position: 0% 30%;
            box-shadow:
              0 0 0 1px rgba(15, 23, 42, 0.9) inset,
              0 0 12px rgba(56, 189, 248, 0.45);
          }
          50% {
            background-position: 100% 70%;
            box-shadow:
              0 0 0 1px rgba(15, 23, 42, 0.9) inset,
              0 0 20px rgba(59, 130, 246, 0.72);
          }
          100% {
            background-position: 0% 50%;
            box-shadow:
              0 0 0 1px rgba(15, 23, 42, 0.9) inset,
              0 0 16px rgba(45, 212, 191, 0.68);
          }
        }

        @keyframes orb-hue-shift {
          0% {
            filter: hue-rotate(0deg) saturate(1);
          }
          25% {
            filter: hue-rotate(40deg) saturate(1.03);
          }
          50% {
            filter: hue-rotate(90deg) saturate(1.06);
          }
          75% {
            filter: hue-rotate(-30deg) saturate(1.03);
          }
          100% {
            filter: hue-rotate(0deg) saturate(1);
          }
        }
      `}</style>
    </div>
  );
}