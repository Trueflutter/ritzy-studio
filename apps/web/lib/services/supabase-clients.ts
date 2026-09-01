import type { Database } from "@ritzy-studio/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Structural client types for the service layer. Services take clients as
// parameters (the action wrappers construct them), so service modules and their
// tests never import the "server-only" client factories.

export type UserSupabaseClient = SupabaseClient<Database>;
export type ServiceSupabaseClient = SupabaseClient<Database>;
