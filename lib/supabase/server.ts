import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies can't be set here; middleware handles refresh
          }
        },
      },
    }
  );
}

// NOTE: a service-role client belongs in lib/supabase/admin.ts (createServiceClient,
// which is `import "server-only"`). Do NOT add a service-role factory here — this
// module has no server-only guard, so a service-role key could leak into a client
// bundle. (A prior unused `createAdminClient` was removed 2026-06-23.)
