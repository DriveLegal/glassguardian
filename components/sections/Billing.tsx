"use client";

import * as React from "react";

export default function Billing() {
  const ref = React.useRef<HTMLElement>(null);
  return (
    <section id="billing" ref={ref as any}>
      <div className="section-inner section-anchor">
        <h2 className="section-title">Billing & insurance</h2>
        <p className="section-sub">
          We work with major insurers for chip & crack repair. Many policies waive deductibles for repairs.
          Prefer to pay out of pocket? No problem — transparent, flat pricing below.
        </p>
        <div className="gradient-border" style={{ padding: 2, borderRadius: 20 }}>
          <div className="card-glass" style={{ padding: 24, borderRadius: 18 }}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>Direct-to-insurer billing support (where applicable)</li>
              <li>Digital receipts for quick reimbursement</li>
              <li>Instant PDF invoice by email</li>
            </ul>
            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="gg-btn" href="#pricing">See out-of-pocket price</a>
              <a className="gg-btn" href="/login">Login for warranty</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}