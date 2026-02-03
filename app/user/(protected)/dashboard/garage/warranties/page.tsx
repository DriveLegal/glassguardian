// app/user/dashboard/warranties/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Shield,
  CheckCircle,
  Download,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AnyObj = Record<string, any>;

function getStatusColor(status?: string) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    claimed: "bg-blue-100 text-blue-800 border-blue-300",
    expired: "bg-gray-100 text-gray-800 border-gray-300",
    transferred: "bg-purple-100 text-purple-800 border-purple-300",
    voided: "bg-red-100 text-red-800 border-red-300",
  };
  return colors[status ?? ""] || "bg-gray-100 text-gray-800";
}

export default function MyWarrantiesPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState<string | null>(null);

  // Ensure authenticated user (redirect to login if missing)
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session?.user) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent("/user/dashboard/warranties")}`
        );
        return;
      }
      setEmail(session.user.email ?? null);
    })();
  }, [router]);

  const {
    data: warranties = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-warranties", email],
    enabled: !!email,
    queryFn: async () => {
      // Adjust table/column names if yours differ
      const { data, error } = await supabaseClient
        .from("warranties")
        .select("*")
        .eq("customer_email", email)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">
              We couldn’t load your warranties. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-600" />
            My Warranties
          </h1>
          <p className="text-gray-600 mt-1">
            Lifetime warranty coverage on all your repairs
          </p>
        </div>

        {/* Warranty Info Banner */}
        <Card className="mb-8 border-none shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Lifetime Warranty Protection
                </h3>
                <p className="text-gray-700 mb-3">
                  All chip and crack repairs come with our lifetime warranty. If
                  the damage spreads or worsens, we&apos;ll repair it again at
                  no cost or credit you toward a replacement.
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>✓ Covers workmanship and material defects</li>
                  <li>✓ Valid for the life of the windshield</li>
                  <li>✓ Transferable to new owners</li>
                  <li>✓ No deductible or hidden fees</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {warranties.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="py-16 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Warranties Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Warranties are issued automatically after each completed repair.
              </p>
              <Link href="/user/appointments">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  View Appointments
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {warranties.map((warranty) => (
              <Card
                key={warranty.id}
                className="border-none shadow-lg hover:shadow-xl transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          warranty.status === "active" ? "bg-green-500" : "bg-gray-400"
                        }`}
                      >
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          Warranty #{warranty.warranty_number}
                        </CardTitle>
                        <Badge className={`mt-1 border ${getStatusColor(warranty.status)}`}>
                          {String(warranty.status ?? "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Service:</span>
                      <span className="font-medium">{warranty.service_performed}</span>
                    </div>
                    {warranty.service_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Service Date:</span>
                        <span className="font-medium">
                          {format(new Date(warranty.service_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Coverage:</span>
                      <span className="font-medium capitalize">
                        {String(warranty.coverage_type ?? "").replace(/_/g, " ")}
                      </span>
                    </div>
                    {warranty.expiration_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-medium">
                          {format(new Date(warranty.expiration_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>

                  {warranty.status === "active" && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800 font-medium">
                        ✓ Your repair is fully covered under this warranty
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {warranty.qr_code_url && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a
                          href={warranty.qr_code_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1">
                      View Terms
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}