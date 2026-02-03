"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export type ComposerProps = {
  pending?: boolean;
  defaultSubject?: string;
  onSend: (payload: { subject?: string | null; body: string; appointment_id?: string | null }) => void;
};

export function Composer({ pending, defaultSubject = "", onSend }: ComposerProps) {
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        onSend({ subject: subject || null, body });
        setBody("");
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3">
        <Input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-white/70 backdrop-blur border-slate-200 shadow-sm"
        />
        <Textarea
          placeholder="Type your message…"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="bg-white/70 backdrop-blur border-slate-200 shadow-sm"
        />
      </div>
      <div className="flex items-center justify-end">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 shadow-lg" disabled={pending}>
          {pending ? "Sending..." : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>
    </form>
  );
}