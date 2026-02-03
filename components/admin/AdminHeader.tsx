"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Users,
  Wrench,
  DollarSign,
  Home,
  Shield,
  MessageSquare,
  Bell,
  Tag,
  LifeBuoy,
} from "lucide-react";
import { motion } from "framer-motion";

type AdminHeaderProps = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode; // optional actions (buttons, filters, etc.)
};

export default function AdminHeader({
  title = "Admin Portal",
  subtitle = "Manage your operations, customers, and analytics",
  right,
}: AdminHeaderProps) {
  const pathname = usePathname();

  const tabs = [
    { name: "Portal", href: "/admin/portal", icon: Home },
    { name: "Calendar", href: "/admin/calendar", icon: Calendar },
    { name: "Appointments", href: "/admin/appointments", icon: Calendar },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "Technicians", href: "/admin/technicians", icon: Wrench },
    { name: "Invoices", href: "/admin/invoices", icon: DollarSign },
    { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { name: "Claims", href: "/admin/claims", icon: Shield },
    { name: "Messages", href: "/admin/messages", icon: MessageSquare },
    { name: "Notifications", href: "/admin/notifications", icon: Bell },
    { name: "Pricing", href: "/admin/pricing", icon: Tag },
    { name: "Support", href: "/admin/support", icon: LifeBuoy },
  ];

  return (
    <header className="mb-10">
      {/* Title + Actions */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-600" />
            {title}
          </h1>
          <p className="text-gray-600 mt-1 text-lg">{subtitle}</p>
        </div>
        {right ? <div className="flex-shrink-0">{right}</div> : null}
      </div>

      {/* Tabs */}
      <nav
        aria-label="Admin navigation"
        className="relative z-10 flex justify-center overflow-x-auto whitespace-nowrap rounded-xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-sm"
      >
        <div className="flex gap-2 px-3 py-2">
          {tabs.map(({ name, href, icon: Icon }) => {
            const active =
              pathname === href ||
              // keep parents active for nested routes (e.g., /admin/appointments/123)
              (href !== "/admin/portal" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-blue-700"
                    : "text-slate-600 hover:text-blue-600 hover:bg-blue-50/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{name}</span>

                {active && (
                  <motion.div
                    layoutId="adminTabIndicator"
                    className="absolute inset-0 rounded-lg bg-blue-100/70 border border-blue-300/50"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}