// app/tech/(protected)/dashboard/schedule/page.tsx
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ScheduleNoSSR from "./ScheduleNoSSR";

export default function TechSchedulePage() {
  return <ScheduleNoSSR />;
}