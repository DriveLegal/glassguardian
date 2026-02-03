"use client";

export function useThreadKey() {
  return (m: any, agentEmail: string) => {
    const scope = m.appointment_id || "general";
    const counterpart = m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
    return `${scope}::${counterpart}`;
  };
}