// components/tech/TodayEmpty.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function TodayEmpty() {
  return (
    <Card className="border-2 border-dashed border-slate-300 bg-white/60 backdrop-blur shadow-sm">
      <CardContent className="py-16 text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No Jobs Scheduled</h3>
        <p className="text-slate-600">Enjoy your day off or check back later for assignments</p>
      </CardContent>
    </Card>
  );
}