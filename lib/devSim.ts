// lib/devSim.ts
// Developer simulation for full app usage without a real Supabase session.
// Reads gg_dev_role cookie and returns a mock user plus realistic dummy data.

export type DevRole = "admin" | "tech" | "user";

/** Safe cookie read on client (no regex; avoids escape pitfalls) */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie;
  if (!raw) return null;
  const parts = raw.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    if (key === name) {
      const val = part.slice(eq + 1);
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

export function readDevRoleFromCookie(): DevRole | null {
  const v = (getCookie("gg_dev_role") || "").toLowerCase();
  if (v === "admin" || v === "tech" || v === "user") return v;
  return null;
}

// Minimal shape aligned with your dashboard types:
export type DevUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string | null; role?: DevRole };
};

export function makeDevUser(role: DevRole): DevUser {
  const email = `${role}.dev@example.com`;
  const full_name =
    role === "admin" ? "Dev Admin" : role === "tech" ? "Dev Technician" : "Dev User";
  return {
    id: `dev-${role}`,
    email,
    user_metadata: { full_name, role },
  };
}

/** ---- Mock data helpers (appointments, vehicles, warranties) ---- */

export type DevAppointment = {
  id: string;
  customer_email: string;
  service_type: string; // e.g. "chip_repair"
  status: string;       // requested|scheduled|en_route|on_site|in_progress|completed|cancelled
  scheduled_date: string; // ISO
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  service_address?: string | null;
  eta_minutes?: number | null;
};

export type DevVehicle = {
  id: string;
  owner_email: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
};

export type DevWarranty = {
  id: string;
  customer_email: string;
  warranty_number: string;
  status: "active" | "expired" | "void";
  expiration_date: string; // ISO
};

// helpers
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function iso(d: Date) {
  return d.toISOString();
}

export async function devFetchAppointments(email: string): Promise<DevAppointment[]> {
  const now = new Date();
  return [
    {
      id: "apt_dev_1",
      customer_email: email,
      service_type: "chip_repair",
      status: "scheduled",
      scheduled_date: iso(addDays(now, 1)),
      scheduled_time_start: "10:00 AM",
      scheduled_time_end: "11:00 AM",
      service_address: "123 Demo St, Sample City, CA",
      eta_minutes: null,
    },
    {
      id: "apt_dev_2",
      customer_email: email,
      service_type: "crack_repair",
      status: "en_route",
      scheduled_date: iso(now),
      scheduled_time_start: "2:00 PM",
      scheduled_time_end: "3:00 PM",
      service_address: "456 Test Ave, Sandbox, CA",
      eta_minutes: 18,
    },
    {
      id: "apt_dev_3",
      customer_email: email,
      service_type: "chip_repair",
      status: "completed",
      scheduled_date: iso(addDays(now, -7)),
      scheduled_time_start: "9:00 AM",
      scheduled_time_end: "9:45 AM",
      service_address: "789 Mock Blvd, Exampletown, CA",
      eta_minutes: null,
    },
  ];
}

export async function devFetchVehicles(email: string): Promise<DevVehicle[]> {
  return [
    {
      id: "veh_dev_1",
      owner_email: email,
      make: "Toyota",
      model: "Camry",
      year: 2018,
      plate: "7DEV123",
    },
    {
      id: "veh_dev_2",
      owner_email: email,
      make: "Tesla",
      model: "Model 3",
      year: 2022,
      plate: "DEVM0CK",
    },
  ];
}

export async function devFetchWarranties(email: string): Promise<DevWarranty[]> {
  const now = new Date();
  return [
    {
      id: "war_dev_1",
      customer_email: email,
      warranty_number: "GG-WAR-001",
      status: "active",
      expiration_date: iso(addDays(now, 180)),
    },
    {
      id: "war_dev_2",
      customer_email: email,
      warranty_number: "GG-WAR-002",
      status: "active",
      expiration_date: iso(addDays(now, 365)),
    },
  ];
}

/** Utility: map dev role to destination path (NO parentheses) */
export function roleToPath(role: DevRole) {
  if (role === "admin") return "/admin/portal";
  if (role === "tech") return "/tech/dashboard";
  return "/user/dashboard";
}