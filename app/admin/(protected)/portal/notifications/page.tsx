// app/admin/notifications/page.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Search,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

type NotificationRow = {
  id: string;
  recipient_email: string;
  subject: string;
  message: string;
  notification_type: string;
  status: "queued" | "sent" | "delivered" | "failed";
  sent_at: string; // ISO
  appointment_id?: string | null;
};

const NOTIF_TYPES: {
  value: string;
  label: string;
  icon: string;
  colorKey:
    | "blue"
    | "purple"
    | "orange"
    | "indigo"
    | "cyan"
    | "yellow"
    | "green"
    | "emerald"
    | "gray";
}[] = [
  { value: "appointment_booked", label: "Booking", icon: "📅", colorKey: "blue" },
  { value: "estimate_ready", label: "Estimate", icon: "💰", colorKey: "purple" },
  { value: "tech_en_route", label: "En Route", icon: "🚗", colorKey: "orange" },
  { value: "tech_arrived", label: "Arrived", icon: "📍", colorKey: "indigo" },
  { value: "repair_started", label: "Started", icon: "🔧", colorKey: "cyan" },
  { value: "repair_curing", label: "Curing", icon: "⏱️", colorKey: "yellow" },
  { value: "repair_completed", label: "Complete", icon: "✅", colorKey: "green" },
  { value: "warranty_issued", label: "Warranty", icon: "🛡️", colorKey: "emerald" },
];

// Static color classes so Tailwind can tree-shake correctly
const TYPE_BG_CLASS: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
  orange: "from-orange-500 to-orange-600",
  indigo: "from-indigo-500 to-indigo-600",
  cyan: "from-cyan-500 to-cyan-600",
  yellow: "from-yellow-500 to-yellow-600",
  green: "from-green-500 to-green-600",
  emerald: "from-emerald-500 to-emerald-600",
  gray: "from-gray-500 to-gray-600",
};

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  queued: "bg-gray-100 text-gray-800",
};

export default function AdminNotificationsPage() {
  const [filter, setFilter] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState<string>("");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["all-notifications"],
    queryFn: async (): Promise<NotificationRow[]> => {
      // Expect a table named `notification_logs` with these columns
      const { data, error } = await supabaseClient
        .from("notification_logs")
        .select(
          "id, recipient_email, subject, message, notification_type, status, sent_at, appointment_id"
        )
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    staleTime: 15_000,
  });

  const filteredNotifications = React.useMemo(() => {
    return (notifications ?? []).filter((n) => {
      const matchesFilter = filter === "all" || n.notification_type === filter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        n.recipient_email?.toLowerCase().includes(q) ||
        n.subject?.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [notifications, filter, searchTerm]);

  const stats = React.useMemo(() => {
    const total = notifications.length;
    const delivered = notifications.filter((n) => n.status === "delivered").length;
    const failed = notifications.filter((n) => n.status === "failed").length;
    const last24h = notifications.filter((n) => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(n.sent_at) > dayAgo;
    }).length;
    return { total, delivered, failed, last24h };
  }, [notifications]);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-10 h-10 text-blue-600" />
            Notification Center
          </h1>
          <p className="text-gray-600 mt-2 text-lg">Monitor all automated notifications</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Sent", value: stats.total, icon: Mail, gradient: "from-blue-500 to-blue-600" },
            { label: "Delivered", value: stats.delivered, icon: CheckCircle, gradient: "from-green-500 to-green-600" },
            { label: "Failed", value: stats.failed, icon: XCircle, gradient: "from-red-500 to-red-600" },
            { label: "Last 24h", value: stats.last24h, icon: Clock, gradient: "from-purple-500 to-purple-600" },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card className={`border-none shadow-xl bg-gradient-to-br ${stat.gradient} text-white`}>
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-10 h-10 mx-auto mb-3 opacity-90" />
                  <p className="text-4xl font-bold mb-1">{stat.value}</p>
                  <p className="text-sm opacity-90">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by email or subject..."
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>

              {/* Show a subset of types in the tab row (you can expand if needed) */}
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="h-12 flex flex-wrap">
                  <TabsTrigger value="all">All Types</TabsTrigger>
                  {NOTIF_TYPES.slice(0, 4).map((t) => (
                    <TabsTrigger key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-10 text-center text-gray-600">
              Loading notifications…
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif, idx) => {
              const type = NOTIF_TYPES.find((t) => t.value === notif.notification_type);
              const grad = TYPE_BG_CLASS[type?.colorKey ?? "gray"];
              const statusClass = STATUS_BADGE[notif.status] ?? STATUS_BADGE["queued"];

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <Card className="border-none shadow-lg hover:shadow-xl transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 bg-gradient-to-br ${grad}`}
                        >
                          <span className="text-2xl">{type?.icon ?? "📧"}</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">{notif.subject}</h3>
                              <p className="text-sm text-gray-600">{notif.recipient_email}</p>
                            </div>
                            <div className="text-right">
                              <Badge className={statusClass}>{notif.status}</Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {notif.sent_at ? format(new Date(notif.sent_at), "MMM d, h:mm a") : "—"}
                              </p>
                            </div>
                          </div>

                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                            {notif.message}
                          </p>

                          {notif.appointment_id && (
                            <p className="text-xs text-gray-500 mt-2">
                              Appointment: {notif.appointment_id.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {filteredNotifications.length === 0 && !isLoading && (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="py-20 text-center">
                  <Bell className="w-20 h-20 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">No Notifications</h3>
                  <p className="text-gray-600">No notifications match your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}