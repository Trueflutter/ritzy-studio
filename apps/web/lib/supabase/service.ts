import "server-only";

import { parseServerEnv } from "@ritzy-studio/config";
import type { Database } from "@ritzy-studio/db";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const env = parseServerEnv(process.env);

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
