// components/tech/CompletedJobRow.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

export default function CompletedJobRow({ job }: { job: AnyObj }) {
  return (
    <Card className="border-none bg-white/70 backdrop-blur shadow-md shadow-slate-900/5 opacity-90 hover:opacity-100 transition-opacity">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-semibold text-slate-900">
                {(job.service_type ?? "").replace(/_/g, " ").toUpperCase()}
              </p>
              {job.service_address && (
                <p className="text-sm text-slate-600">{String(job.service_address).split(",")[0]}</p>
              )}
            </div>
          </div>
          {job.actual_end_time && (
            <p className="text-sm text-slate-600">
              Completed at {format(new Date(job.actual_end_time), "h:mm a")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}