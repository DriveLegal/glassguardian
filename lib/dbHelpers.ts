// lib/dbHelpers.ts
import { z, ZodTypeAny, ZodError } from "zod";
import { supabaseClient } from "./supabaseClient";

export interface CRUDHelper<T extends Record<string, any>> {
  getById: (id: string, select?: string) => Promise<T | null>;
  list: (opts?: {
    filter?: Partial<Record<keyof T, any>>;
    order?: { column: keyof T; ascending?: boolean; nullsFirst?: boolean };
    limit?: number;
    from?: number;
    to?: number;
    select?: string;
  }) => Promise<T[]>;
  create: (data: Partial<T> | Partial<T>[], select?: string) => Promise<T | T[]>;
  update: (id: string, patch: Partial<T>, select?: string) => Promise<T>;
  upsert: (
    data: Partial<T> | Partial<T>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean; select?: string }
  ) => Promise<T[]>;
  remove: (id: string) => Promise<void>;
}

export function createCRUDHelper<T extends Record<string, any>>(
  table: string,
  schema?: ZodTypeAny
): CRUDHelper<T> {
  const parse = (value: unknown): any => {
    if (!schema) return value as any;
    const res = schema.safeParse(value);
    if (!res.success) {
      const msg = res.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Schema validation failed for ${table}: ${msg}`);
    }
    return res.data as any;
  };

  const parseArray = (arr: unknown[]): any[] => {
    if (!schema) return arr as any[];
    const arraySchema = z.array(schema);
    const res = arraySchema.safeParse(arr);
    if (!res.success) {
      const msg = res.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Schema validation failed for ${table}[]: ${msg}`);
    }
    return res.data as any[];
  };

  const ensureOk = (error: any) => {
    if (error) {
      const msg = typeof error?.message === "string" ? error.message : JSON.stringify(error);
      throw new Error(`[Supabase:${table}] ${msg}`);
    }
  };

  return {
    async getById(id, select = "*") {
      const { data, error } = await supabaseClient
        .from(table)
        .select(select)
        .eq("id", id)
        .maybeSingle();
      ensureOk(error);
      if (!data) return null;
      return parse(data) as T;
    },

    async list(
      opts: {
        filter?: Partial<Record<keyof T, any>>;
        order?: { column: keyof T; ascending?: boolean; nullsFirst?: boolean };
        limit?: number;
        from?: number;
        to?: number;
        select?: string;
      } = {}
    ) {
      const { filter, order, limit, from, to, select = "*" } = opts;
      let q: any = supabaseClient.from(table).select(select);

      if (filter) {
        for (const [k, v] of Object.entries(filter)) {
          if (v === undefined) continue;
          if (Array.isArray(v)) q = q.in(k, v);
          else if (v === null) q = q.is(k, null);
          else q = q.eq(k, v);
        }
      }

      if (order?.column) {
        q = q.order(String(order.column), {
          ascending: order.ascending ?? true,
          nullsFirst: order.nullsFirst ?? false,
        });
      }

      if (typeof from === "number" && typeof to === "number") {
        q = q.range(from, to);
      } else if (typeof limit === "number") {
        q = q.limit(limit);
      }

      const { data, error } = await q;
      ensureOk(error);
      return parseArray((data ?? []) as any[]) as T[];
    },

    async create(data, select = "*") {
      const isArray = Array.isArray(data);
      const { data: inserted, error } = await supabaseClient
        .from(table)
        .insert(data as any)
        .select(select);
      ensureOk(error);

      if (isArray) return parseArray(inserted ?? []) as T[];
      const row = Array.isArray(inserted) ? inserted[0] : inserted;
      return parse(row) as T;
    },

    async update(id, patch, select = "*") {
      const { data, error } = await supabaseClient
        .from(table)
        .update(patch as any)
        .eq("id", id)
        .select(select)
        .maybeSingle();
      ensureOk(error);
      if (!data) throw new Error(`[Supabase:${table}] Update returned no row for id ${id}`);
      return parse(data) as T;
    },

    async upsert(data, opts) {
      const { onConflict, ignoreDuplicates, select = "*" } = opts ?? {};
      let q: any = supabaseClient.from(table).upsert(data as any, {
        onConflict,
        ignoreDuplicates,
      });
      q = q.select(select);
      const { data: rows, error } = await q;
      ensureOk(error);
      return parseArray(rows ?? []) as T[];
    },

    async remove(id) {
      const { error } = await supabaseClient.from(table).delete().eq("id", id);
      ensureOk(error);
    },
  };
}