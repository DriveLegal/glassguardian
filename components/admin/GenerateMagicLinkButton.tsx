// components/admin/GenerateMagicLinkButton.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail as MailIcon,
  Check,
  AlertCircle,
} from "lucide-react";

type Props = {
  email: string;
  warrantyId: string;
};

export function GenerateMagicLinkButton({ email, warrantyId }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    try {
      setLoading(true);
      setError(null);
      setSent(false);

      const res = await fetch("/api/admin/warranties/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, warrantyId }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors; we'll just rely on res.ok
      }

      if (!res.ok || data?.error) {
        throw new Error(
          data?.details ||
            data?.error ||
            "Failed to send magic login email"
        );
      }

      // ✅ Supabase has sent the magic login email
      setSent(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Something went wrong sending the email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="border-emerald-500/60 bg-slate-950/80 text-emerald-100 hover:border-emerald-400 hover:text-emerald-50 hover:bg-slate-900 shadow-[0_0_18px_rgba(16,185,129,0.55)]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
            Sending…
          </>
        ) : (
          <>
            <MailIcon className="w-4 h-4 mr-1" />
            Send Magic Login Email
          </>
        )}
      </Button>

      {sent && !error && (
        <p className="flex items-center gap-1 text-[10px] text-emerald-300 text-right">
          <Check className="w-3 h-3" />
          Magic login email sent to {email}.
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1 text-[10px] text-rose-300 text-right max-w-[240px]">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}