// components/user/dashboard/appointments/id/ServiceDetailsCard.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar, MapPin, Car, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnyObj = Record<string, any>;

export default function ServiceDetailsCard({
  appointment,
  vehicle,
  cardClassName,
}: {
  appointment: AnyObj;
  vehicle: AnyObj | null | undefined;
  cardClassName: string;
}) {
  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <FileText className="w-5 h-5" />
          Service Details
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-slate-100">
        {vehicle && (
          <div className="flex items-center gap-3 p-4 bg-slate-900/80 rounded-lg border border-slate-700">
            <Car className="w-8 h-8 text-sky-400" />
            <div>
              <p className="font-semibold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
              {vehicle.color && (
                <p className="text-sm text-slate-300">{vehicle.color}</p>
              )}
              {vehicle.license_plate && (
                <p className="text-sm text-slate-300">
                  Plate: {vehicle.license_plate}
                </p>
              )}
            </div>
          </div>
        )}

        {appointment?.scheduled_date && (
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-300 mt-0.5" />
            <div>
              <p className="font-medium">
                {format(
                  new Date(appointment.scheduled_date),
                  "EEEE, MMMM d, yyyy"
                )}
              </p>
              {appointment.scheduled_time_start && (
                <p className="text-sm text-slate-300">
                  {appointment.scheduled_time_start}
                  {appointment.scheduled_time_end
                    ? ` - ${appointment.scheduled_time_end}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {appointment?.service_address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-300 mt-0.5" />
            <p className="text-sm text-slate-200">{appointment.service_address}</p>
          </div>
        )}

        {appointment?.damage_description && (
          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-400/50">
            <p className="text-sm font-medium text-amber-200 mb-1">
              Damage Description:
            </p>
            <p className="text-sm text-amber-100">
              {appointment.damage_description}
            </p>
          </div>
        )}

        {appointment?.notes_customer && (
          <div className="p-4 bg-sky-500/10 rounded-lg border border-sky-400/50">
            <p className="text-sm font-medium text-sky-200 mb-1">
              Special Instructions:
            </p>
            <p className="text-sm text-sky-100">{appointment.notes_customer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}