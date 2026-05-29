"use client";

import * as React from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type DashboardUser = {
  id: string;
  email: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
  };
};

export function cleanName(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const collapsed = raw.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : null;
}

export function buildNameFromMetadata(meta?: DashboardUser["user_metadata"]) {
  if (!meta) return null;

  return (
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName([meta.first_name, meta.last_name].filter(Boolean).join(" ") || null)
  );
}

async function getAccessTokenBestEffort(): Promise<string> {
  const { data: firstSession } = await supabaseClient.auth.getSession();
  let token = firstSession?.session?.access_token || "";

  if (!token) {
    await supabaseClient.auth.refreshSession().catch(() => {});
    const { data: secondSession } = await supabaseClient.auth.getSession();
    token = secondSession?.session?.access_token || "";
  }

  return token;
}

function mergeHeaders(base?: HeadersInit, extra?: Record<string, string>): HeadersInit {
  const headers = new Headers(base || undefined);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }

  return headers;
}

async function safeFetchJsonAuthed(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  try {
    const token = await getAccessTokenBestEffort().catch(() => "");
    const headers = mergeHeaders(init?.headers, {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    });

    const response = await fetch(url, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers,
    });

    const text = await response.text().catch(() => "");
    let json: any = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    return { ok: response.ok, status: response.status, json };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: error?.message || "Failed to fetch",
    };
  }
}

export function useDashboardUser() {
  const [user, setUser] = React.useState<DashboardUser | null>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [sessionMissing, setSessionMissing] = React.useState(false);

  const [appUserName, setAppUserName] = React.useState<string | null>(null);
  const [loadingAppUserName, setLoadingAppUserName] = React.useState(false);

  const hardRefresh = React.useCallback(() => {
    try {
      window.location.reload();
    } catch {}
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const result = await supabaseClient.auth
          .getUser()
          .catch(() => ({ data: { user: null } as any }));

        const authedUser = result?.data?.user ?? null;

        if (!mounted) return;

        if (authedUser) {
          setUser({
            id: authedUser.id,
            email: authedUser.email ?? null,
            user_metadata: authedUser.user_metadata as any,
          });
          setSessionMissing(false);
          setLoadingUser(false);
          return;
        }

        const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (!session?.user) return;

          setUser({
            id: session.user.id,
            email: session.user.email ?? null,
            user_metadata: session.user.user_metadata as any,
          });
          setSessionMissing(false);
          setLoadingUser(false);
        });

        unsubscribe = () => sub?.subscription?.unsubscribe?.();

        timeout = setTimeout(async () => {
          if (!mounted) return;

          const retry = await supabaseClient.auth
            .getUser()
            .catch(() => ({ data: { user: null } as any }));

          const retryUser = retry?.data?.user ?? null;

          if (retryUser) {
            setUser({
              id: retryUser.id,
              email: retryUser.email ?? null,
              user_metadata: retryUser.user_metadata as any,
            });
            setSessionMissing(false);
          } else {
            setSessionMissing(true);
          }

          setLoadingUser(false);
        }, 900);
      } catch {
        if (!mounted) return;
        setSessionMissing(true);
        setLoadingUser(false);
      }
    })();

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
      unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      const result = await safeFetchJsonAuthed("/api/user/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!cancelled) void result;
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.email) {
      setAppUserName(null);
      setLoadingAppUserName(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const email = user.email?.trim().toLowerCase();
      const metaName = buildNameFromMetadata(user.user_metadata);

      if (!email) {
        setAppUserName(metaName);
        setLoadingAppUserName(false);
        return;
      }

      setLoadingAppUserName(true);

      try {
        const { data, error } = await supabaseClient
          .from("app_users")
          .select("id, full_name")
          .eq("email", email)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setAppUserName(metaName);
          return;
        }

        const tableName = cleanName((data as any)?.full_name ?? null);
        setAppUserName(tableName || metaName);
      } catch {
        if (!cancelled) setAppUserName(metaName);
      } finally {
        if (!cancelled) setLoadingAppUserName(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.user_metadata]);

  const displayName = appUserName || buildNameFromMetadata(user?.user_metadata) || "there";

  return {
    user,
    loadingUser,
    sessionMissing,
    appUserName,
    loadingAppUserName,
    displayName,
    hardRefresh,
  };
}