// lib/hooks/useAppointmentRealtime.ts
"use client";

import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

export function useAppointmentRealtime({
  appointmentId,
  userEmail,
  queryClient,
}: {
  appointmentId?: string;
  userEmail?: string | null;
  queryClient: QueryClient;
}) {
  React.useEffect(() => {
    if (!appointmentId || !userEmail) return;

    const apptChannel = supabaseClient
      .channel(`gg_user_appt_${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload: any) => {
          const nextRow = payload?.new ?? null;

          if (nextRow) {
            queryClient.setQueryData(["appointment", appointmentId], (old: any) =>
              old ? { ...old, ...nextRow } : nextRow
            );
          }

          queryClient.invalidateQueries({
            queryKey: ["appointment", appointmentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["invoice_by_appt", appointmentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["appointment-waiver", appointmentId],
          });

          if (userEmail) {
            queryClient.invalidateQueries({
              queryKey: ["my-appointments", userEmail],
            });
          }
        }
      )
      .subscribe();

    const waiverChannel = supabaseClient
      .channel(`gg_user_appt_waiver_${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_waivers",
          filter: `appointment_id=eq.${appointmentId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["appointment-waiver", appointmentId],
          });
        }
      )
      .subscribe();

    return () => {
      try {
        supabaseClient.removeChannel(apptChannel);
      } catch {}
      try {
        supabaseClient.removeChannel(waiverChannel);
      } catch {}
    };
  }, [appointmentId, userEmail, queryClient]);
}