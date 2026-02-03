// components/AuthCTA.supabase.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  redirectAfterSignIn?: string;   // e.g. "/dashboard/book"
  className?: string;
  label?: string;
};

export function BookOrLoginSB({
  redirectAfterSignIn = "/dashboard/book",
  className,
  label = "Book / Login",
}: Props) {
  const router = useRouter();

  const onClick = async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) router.push("/dashboard/book");
      else router.push(`/uesr/login?redirect=${encodeURIComponent(redirectAfterSignIn)}`);
    } catch {
      router.push(`/user/login?redirect=${encodeURIComponent(redirectAfterSignIn)}`);
    }
  };

  return (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  );
}

export function SignInButtonOnlySB({
  redirectAfterSignIn = "/dashboard",
  className,
  label = "Sign In",
}: Props) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={() =>
        router.push(`/user/login?redirect=${encodeURIComponent(redirectAfterSignIn)}`)
      }
    >
      {label}
    </button>
  );
}