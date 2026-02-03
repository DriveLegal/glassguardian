// components/tech/ShiftToggle.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

export default function ShiftToggle({
  onShift,
  setOnShift,
}: {
  onShift: boolean;
  setOnShift: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-600 mb-1">Shift Status</p>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              onShift ? "bg-green-500 animate-pulse" : "bg-slate-300"
            }`}
          />
          <p className="font-bold text-lg">{onShift ? "On Duty" : "Off Duty"}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={onShift ? "destructive" : "default"}
        onClick={() => setOnShift(!onShift)}
        className={onShift ? "" : "bg-green-600 hover:bg-green-700"}
      >
        {onShift ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
        {onShift ? "End Shift" : "Start Shift"}
      </Button>
    </div>
  );
}