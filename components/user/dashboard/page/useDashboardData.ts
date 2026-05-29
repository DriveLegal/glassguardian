"use client";

import * as React from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type {
  VehicleServiceAppointment,
  VehicleServiceVehicle,
  VehicleServiceWarranty,
} from "@/components/user/dashboard/page/vehicleservice";

export type DashboardAppointment = VehicleServiceAppointment & {
  service_address?: string | null;
  eta_minutes?: string | null;
  crack_out_cause?: string | null;
  crack_out_notes?: string | null;
  crack_out_photo_url?: string | null;
  crack_out_at?: string | null;
  replacement_required?: boolean | null;
  created_at?: string | null;
};

export type DashboardVehicle = VehicleServiceVehicle;
export type DashboardWarranty = VehicleServiceWarranty;

export type TechInvoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  created_at: string | null;
  invoice_date: string | null;
  appointment_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address: string | null;
  subtotal_cents: number | null;
  total_cents: number | null;
  final_paid_cents: number | null;
  paid_at: string | null;
  payment_method: string | null;
};

export function useDashboardData(userEmail?: string | null) {
  const [appointments, setAppointments] = React.useState<DashboardAppointment[]>([]);
  const [vehicles, setVehicles] = React.useState<DashboardVehicle[]>([]);
  const [warranties, setWarranties] = React.useState<DashboardWarranty[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  const [invoices, setInvoices] = React.useState<TechInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);

  /* ============================================================
     MAIN DATA LOAD (FAST)
  ============================================================ */

  React.useEffect(() => {
    if (!userEmail) {
      setAppointments([]);
      setVehicles([]);
      setWarranties([]);
      setLoadingData(false);
      return;
    }

    let stopped = false;

    (async () => {
      setLoadingData(true);

      try {
        const email = userEmail.trim().toLowerCase();

        if (!email) {
          if (stopped) return;
          setAppointments([]);
          setVehicles([]);
          setWarranties([]);
          return;
        }

        const [aptRes, vehRes, warRes] = await Promise.all([
          supabaseClient
            .from("appointments")
            .select(`
              id,
              customer_email,
              service_type,
              status,
              scheduled_date,
              scheduled_time_start,
              scheduled_time_end,
              vehicle_id,
              service_address,
              crack_out_cause,
              crack_out_notes,
              crack_out_photo_url,
              crack_out_at,
              replacement_required,
              created_at
            `)
            .eq("customer_email", email)
            .order("created_at", { ascending: false })
            .limit(10),

          supabaseClient
            .from("vehicles")
            .select(`
              id,
              owner_email,
              make,
              model,
              year,
              license_plate,
              color
            `)
            .eq("owner_email", email),

          supabaseClient
            .from("warranties")
            .select(`
              id,
              customer_email,
              warranty_number,
              status,
              expiration_date
            `)
            .eq("customer_email", email)
            .eq("status", "active"),
        ]);

        if (stopped) return;

        setAppointments((aptRes.data as DashboardAppointment[]) || []);
        setVehicles((vehRes.data as DashboardVehicle[]) || []);
        setWarranties((warRes.data as DashboardWarranty[]) || []);
      } catch {
        if (!stopped) {
          setAppointments([]);
          setVehicles([]);
          setWarranties([]);
        }
      } finally {
        if (!stopped) setLoadingData(false);
      }
    })();

    return () => {
      stopped = true;
    };
  }, [userEmail]);

  /* ============================================================
     INVOICES (FAST)
  ============================================================ */

  React.useEffect(() => {
    if (!userEmail) {
      setInvoices([]);
      setLoadingInvoices(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const email = userEmail.trim().toLowerCase();

      if (!email) {
        if (!cancelled) setInvoices([]);
        return;
      }

      setLoadingInvoices(true);

      try {
        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .select(`
            id,
            invoice_number,
            status,
            created_at,
            invoice_date,
            appointment_id,
            customer_email,
            customer_name,
            service_address,
            subtotal_cents,
            total_cents,
            final_paid_cents,
            paid_at,
            payment_method
          `)
          .eq("customer_email", email)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) throw error;

        if (!cancelled) {
          setInvoices((data as unknown as TechInvoice[]) || []);
        }
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  /* ============================================================
     DERIVED STATE
  ============================================================ */

  const activeAppointments = React.useMemo(() => {
    return appointments.filter((appointment) => {
      const status = (appointment.status ?? "").toLowerCase();
      return !["completed", "cancelled", "canceled", "paid"].includes(status);
    });
  }, [appointments]);

  const hasCompletedJob = React.useMemo(() => {
    return appointments.some((appointment) => {
      const status = (appointment.status ?? "").toLowerCase();
      return status === "completed" || status === "paid";
    });
  }, [appointments]);

  const showPostCompleteMessage =
    hasCompletedJob && activeAppointments.length === 0 && warranties.length === 0;

  return {
    appointments,
    vehicles,
    warranties,
    invoices,
    loadingData,
    loadingInvoices,
    activeAppointments,
    showPostCompleteMessage,
    showRecentInvoicesPanel: invoices.length > 0,
  };
}