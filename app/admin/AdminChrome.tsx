// app/admin/AdminChrome.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); 

  // Keep your original title/subtitle mapping
  const top = pathname.split("/").slice(0, 3).join("/");
  const map: Record<string, { title: string; subtitle: string }> = {
    "/admin/portal":       { title: "Admin Portal",     subtitle: "Manage your operations, customers, and analytics" },
    "/admin/calendar":     { title: "Calendar",         subtitle: "Plan and track appointments" },
    "/admin/appointments": { title: "Appointments",     subtitle: "Schedule, assign, and progress jobs" },
    "/admin/customers":    { title: "Customers",        subtitle: "Profiles, activity, and value" },
    "/admin/technicians":  { title: "Technicians",      subtitle: "Field team and performance" },
    "/admin/invoices":     { title: "Invoices",         subtitle: "Billing and payments" },
    "/admin/analytics":    { title: "Analytics",        subtitle: "KPIs and trends" },
    "/admin/claims":       { title: "Claims",           subtitle: "Insurance claims & statuses" },
    "/admin/messages":     { title: "Messages",         subtitle: "Threads and communications" },
    "/admin/notifications":{ title: "Notifications",    subtitle: "System alerts and events" },
    "/admin/pricing":      { title: "Pricing",          subtitle: "Rules, surcharges, and packages" },
    "/admin/support":      { title: "Support",          subtitle: "Tools for help & ops" },
  };

  const meta = map[top] ?? { title: "Admin", subtitle: "Operations console" };

  return (
    <div className="px-4 md:px-8 py-6">
      <AdminHeader title={meta.title} subtitle={meta.subtitle} />
      {children}
    </div>
  );
}