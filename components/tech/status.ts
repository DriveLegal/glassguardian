// components/tech/status.ts
export function getNextStatus(currentStatus: string): string {
  const flow: Record<string, string> = {
    scheduled: "en_route",
    en_route: "on_site",
    on_site: "in_progress",
    in_progress: "curing",
    curing: "completed",
  };
  return flow[currentStatus] || currentStatus;
}

export function getNextStatusLabel(currentStatus: string): string {
  const labels: Record<string, string> = {
    scheduled: "Start Driving",
    en_route: "Arrive on Site",
    on_site: "Start Repair",
    in_progress: "Begin Curing",
    curing: "Mark Complete",
  };
  return labels[currentStatus] || "Update";
}

export function getStatusBadgeClasses(status?: string) {
  const map: Record<string, string> = {
    scheduled: "bg-purple-100 text-purple-800 border-purple-200",
    en_route: "bg-orange-100 text-orange-800 border-orange-200",
    on_site: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200",
    curing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return `border ${map[status ?? ""] || "bg-gray-100 text-gray-800 border-gray-200"}`;
}