// components/shared/appointments/TechnicianCard.tsx
"use client";

import * as React from "react";
import { User as UserIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TechnicianCard({
  technician,
}: {
  technician: Record<string, any> | null;
}) {
  if (!technician) return null;

  return (
    <Card className="border border-slate-800 bg-slate-950/80 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <UserIcon className="w-5 h-5" />
          Your Technician
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">
              {(technician.full_name?.charAt(0) || "T") as string}
            </span>
          </div>

          <div>
            <p className="font-semibold text-slate-50">{technician.full_name}</p>

            {technician.phone && (
              <p className="text-sm text-slate-300">{technician.phone}</p>
            )}

            {technician.tech_rating && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-yellow-400">★</span>
                <span className="text-sm font-medium text-slate-100">
                  {Number(technician.tech_rating).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}