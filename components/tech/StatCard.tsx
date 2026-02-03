// components/tech/StatCard.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface StatCardProps {
  label: string;
  value: string | number;
  gradient: string; // e.g., "from-blue-500 to-blue-600"
}

export default function StatCard({ label, value, gradient }: StatCardProps) {
  return (
    <Card className={`border-none shadow-2xl bg-gradient-to-br ${gradient} text-white hover:shadow-blue-500/30`}>
      <CardContent className="p-6 text-center">
        <p className="text-3xl font-bold mb-1">{value}</p>
        <p className="text-xs opacity-90">{label}</p>
      </CardContent>
    </Card>
  );
}