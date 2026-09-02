// Recording fake Supabase client for service tests. Chainable like the real
// PostgREST builder; every terminal await resolves through the responder with a
// full record of table, operation, filters, and payload. Test-only.

export type RecordedCall = {
  table: string;
  op: "select" | "update" | "insert" | "upsert" | "delete";
  filters: Array<[string, unknown]>;
  not: Array<[string, unknown]>;
  neq: Array<[string, unknown]>;
  contains: Array<[string, unknown]>;
  gte: Array<[string, unknown]>;
  lt: Array<[string, unknown]>;
  in: Array<[string, unknown]>;
  columns?: string;
  order: Array<[string, unknown]>;
  limit?: number;
  payload?: Record<string, unknown>;
  upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
  single: boolean;
};

export type StorageCall = {
  bucket: string;
  op: "createSignedUrl" | "download" | "upload";
  path: string;
};

export type Responder = (call: RecordedCall) => { data?: unknown; error?: { message: string } | null };

export type StorageResponder = (call: StorageCall) => { data?: unknown; error?: { message: string } | null };

export function fakeSupabase(respond: Responder, respondStorage: StorageResponder = () => ({ data: null })) {
  const calls: RecordedCall[] = [];
  const storageCalls: StorageCall[] = [];

  function from(table: string) {
    const call: RecordedCall = {
      table,
      op: "select",
      filters: [],
      not: [],
      neq: [],
      contains: [],
      gte: [],
      lt: [],
      in: [],
      order: [],
      single: false
    };
    const builder: Record<string, unknown> = {
      select(columns?: string) {
        call.columns = columns;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        call.op = "update";
        call.payload = payload;
        return builder;
      },
      insert(payload: Record<string, unknown>) {
        call.op = "insert";
        call.payload = payload;
        return builder;
      },
      delete() {
        call.op = "delete";
        return builder;
      },
      upsert(payload: Record<string, unknown>, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        call.op = "upsert";
        call.payload = payload;
        call.upsertOptions = options;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      not(column: string, operator: string, value: unknown) {
        call.not.push([column, `${operator}:${value}`]);
        return builder;
      },
      neq(column: string, value: unknown) {
        call.neq.push([column, value]);
        return builder;
      },
      contains(column: string, value: unknown) {
        call.contains.push([column, value]);
        return builder;
      },
      gte(column: string, value: unknown) {
        call.gte.push([column, value]);
        return builder;
      },
      lt(column: string, value: unknown) {
        call.lt.push([column, value]);
        return builder;
      },
      in(column: string, value: unknown) {
        call.in.push([column, value]);
        return builder;
      },
      order(column: string, options?: unknown) {
        call.order.push([column, options]);
        return builder;
      },
      limit(count: number) {
        call.limit = count;
        return builder;
      },
      single() {
        call.single = true;
        return builder;
      },
      maybeSingle() {
        call.single = true;
        return builder;
      },
      then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
        calls.push(call);
        const result = respond(call);
        return resolve({ data: result.data ?? null, error: result.error ?? null });
      }
    };
    return builder;
  }

  const storage = {
    from(bucket: string) {
      return {
        async createSignedUrl(path: string) {
          const call: StorageCall = { bucket, op: "createSignedUrl", path };
          storageCalls.push(call);
          const result = respondStorage(call);
          return { data: result.data ?? null, error: result.error ?? null };
        },
        async download(path: string) {
          const call: StorageCall = { bucket, op: "download", path };
          storageCalls.push(call);
          const result = respondStorage(call);
          return { data: result.data ?? null, error: result.error ?? null };
        },
        async upload(path: string) {
          const call: StorageCall = { bucket, op: "upload", path };
          storageCalls.push(call);
          const result = respondStorage(call);
          return { data: result.data ?? null, error: result.error ?? null };
        }
      };
    }
  };

  return { client: { from, storage } as never, calls, storageCalls };
}
