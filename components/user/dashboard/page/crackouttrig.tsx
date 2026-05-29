// components/user/dashboard/page/crackouttrig.tsx
"use client";

import * as React from "react";

import {
  CrackOutApologyDialog,
  findCrackOutAppointment,
  type CrackOutAppointment,
} from "@/components/user/dashboard/page/crackout";

export type CrackOutTriggerAppointment = CrackOutAppointment & {
  [x: string]: any;
};

export default function CrackOutTrigger({
  appointments,
}: {
  appointments: CrackOutTriggerAppointment[];
}) {
  const [apologyOpen, setApologyOpen] = React.useState(false);
  const [apologyAppointment, setApologyAppointment] =
    React.useState<CrackOutTriggerAppointment | null>(null);

  React.useEffect(() => {
    const candidate = findCrackOutAppointment(appointments);
    if (!candidate) return;

    const key = `gg_ack_crackout_${candidate.id}`;

    try {
      const alreadyAcknowledged = window.localStorage.getItem(key) === "1";
      if (alreadyAcknowledged) return;

      setApologyAppointment(candidate);
      setApologyOpen(true);
      window.localStorage.setItem(key, "1");
    } catch {
      setApologyAppointment(candidate);
      setApologyOpen(true);
    }
  }, [appointments]);

  if (!apologyAppointment) return null;

  return (
    <CrackOutApologyDialog
      appointment={apologyAppointment}
      open={apologyOpen}
      onOpenChangeAction={(value: boolean) => setApologyOpen(value)}
    />
  );
}