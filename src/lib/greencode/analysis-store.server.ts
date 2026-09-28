import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function createSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (apiKey.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createAnalysisStore() {
  const serverUrl = process.env["SUPABASE_URL"];
  const clientUrl = import.meta.env["VITE_SUPABASE_URL"];
  if (serverUrl && clientUrl && new URL(serverUrl).origin !== new URL(clientUrl).origin) {
    throw new Error("SUPABASE_URL and VITE_SUPABASE_URL point to different Supabase projects.");
  }
  const url = serverUrl ?? clientUrl;
  const apiKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !apiKey) {
    throw new Error("Analysis storage requires SUPABASE_URL and a Supabase publishable key.");
  }

  return createClient<Database>(url, apiKey, {
    global: { fetch: createSupabaseFetch(apiKey) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let store: ReturnType<typeof createAnalysisStore> | undefined;

export const analysisStore = new Proxy({} as ReturnType<typeof createAnalysisStore>, {
  get(_, property, receiver) {
    store ??= createAnalysisStore();
    return Reflect.get(store, property, receiver);
  },
});