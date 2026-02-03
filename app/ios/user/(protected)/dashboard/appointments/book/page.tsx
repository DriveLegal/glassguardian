// app/ios/user/(protected)/dashboard/appointments/book/page.tsx
import * as React from "react";
import { Suspense } from "react";
import IOSBookAppointmentClient from "./IOSBookAppointmentClient";

function BookingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        <p className="text-xs tracking-[0.25em] uppercase text-slate-400">
          Loading booking
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<BookingLoading />}>
      <IOSBookAppointmentClient />
    </Suspense>
  );
}