import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Lazily constructed browser client. Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, "");
    if (!url || !anonKey) {
      throw new Error(
        "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    // Catch the classic mistake of pasting a key into the URL slot — a bad
    // URL surfaces later as an opaque "fetch failed" on auth/data calls.
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL must look like https://yourproject.supabase.co — it is currently "${url.slice(0, 24)}…", which is not a Supabase URL (was a key pasted there by mistake?)`
      );
    }
    client = createClient(url, anonKey);
  }
  return client;
}
