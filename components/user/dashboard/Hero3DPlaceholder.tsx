// components/dashboard/Hero3DPlaceholder.tsx
"use client";

import React from "react";

export default function Hero3DPlaceholder() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div
        className="h-full w-full rounded-xl"
        style={{
          background:
            "radial-gradient(circle at 10% 20%, rgba(148,163,184,0.06), transparent 20%), radial-gradient(circle at 90% 80%, rgba(14,165,233,0.06), transparent 25%)",
        }}
      />
    </div>
  );
}