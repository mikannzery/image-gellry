import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { SupabaseCookieOptions } from "@/lib/supabase/types";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove(name: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {}
      },
    },
  });
}
