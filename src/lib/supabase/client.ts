"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | undefined;

export function createClientSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

