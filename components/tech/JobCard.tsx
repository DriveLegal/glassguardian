// components/tech/JobCard.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Navigation, ArrowRight } from "lucide-react";

type AnyObj = Record<string, any>;

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  estimating: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  scheduled: "bg-purple-100 text-purple-800 border-purple-200",
  en_route: "bg-orange-100 text-orange-800 border-orange-200",
  on_site: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200",
  curing: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

export interface JobCardProps {
  job: AnyObj;
  onAdvance: () => void;
  advanceLabel: string;
  disableAdvance?: boolean;
  onOpenJob?: () => void; // optional "open details" handler
}

export default function JobCard({
  job,
  onAdvance,
  advanceLabel,
  disableAdvance,
  onOpenJob,
}: JobCardProps) {
  const address = job?.service_address ?? "";
  const status = String(job?.status ?? "");
  const service = (job?.service_type ?? "SERVICE").toString().replace(/_/g, " ").toUpperCase();

  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">{service}</div>
            <div className="mt-1 text-sm text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {job?.scheduled_time_start || "TBD"}
                {job?.scheduled_time_end ? ` – ${job.scheduled_time_end}` : ""}
              </span>
            </div>
          </div>
          <Badge className={`border ${STATUS_COLOR[status] ?? ""}`}>
            {status.replace(/_/g, " ")}
          </Badge>
        </div>

        {address && (
          <div className="text-sm text-gray-700 flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-gray-500" />
            <span>{address}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `https://maps.google.com/?q=${encodeURIComponent(address)}`,
                  "_blank"
                )
              }
            >
              <Navigation className="w-4 h-4 mr-1" />
              Navigate
            </Button>

            {/* Quick advance */}
            <Button size="sm" onClick={onAdvance} disabled={!!disableAdvance}>
              {advanceLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {onOpenJob && (
            <Button variant="outline" onClick={onOpenJob}>
              Open Job
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}