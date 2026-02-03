"use client";

import * as React from "react";
import Link from "next/link";
import HeroBackground3D from "@/components/visual/HeroBackground3D"; // ✅ corrected path
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Shield,
  Tag,
  Wrench,
  BarChart3,
} from "lucide-react";

export default function AdminHomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D background */}
      <HeroBackground3D />

      {/* Soft overlay to increase contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-white/60 to-white/80" />

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-4 md:p-8">
        <AdminHeader
          title="Admin Portal"
          subtitle="Quick access to operations, customers, and analytics"
          right={
            <div className="flex gap-2">
              <Link href="/admin/analytics">
                <Button variant="outline">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </Link>
              <Link href="/admin/calendar">
                <Button variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar
                </Button>
              </Link>
            </div>
          }
        />

        {/* Quick Nav */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/appointments">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Appointments
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                View, schedule, and track today’s jobs.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/customers">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Customers
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Manage customer details and lifetime value.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/technicians">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-emerald-600" />
                  Technicians
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Assign jobs and monitor field performance.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/invoices">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Review payments and payouts.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/claims">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-600" />
                  Insurance Claims
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Process and track carrier submissions.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/pricing">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-600" />
                  Pricing Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Configure base prices and surcharges.
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/analytics">
            <Card className="border-none shadow-lg hover:shadow-2xl transition-all bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-pink-600" />
                  Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Metrics and trends across the business.
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}