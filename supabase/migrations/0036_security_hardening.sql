-- 0036 — security hardening (2026-06-23): shared cross-instance rate limiting,
-- indexed auth-email existence check (replaces an O(users) scan + timing oracle),
-- and a pinned search_path on an existing trigger function (advisor WARN).
-- Applied to the RxShift Supabase (cnhpaxucnbgxazpbvtod) via MCP.

-- ── Shared, cross-instance rate limiter ─────────────────────────────────────
-- Serverless instances don't share memory, so the prior in-memory Map throttles
-- on /api/auth/login-link and /api/contact were bypassable (email-bomb vector).
-- This fixed-window counter lives in Postgres and is shared across instances.
CREATE TABLE IF NOT EXISTS public.rate_limit (
  bucket       text NOT NULL,        -- 'login-link:email' | 'login-link:ip' | 'contact:ip' | 'contact:email'
  identifier   text NOT NULL,        -- the email or IP being limited
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier)
);
ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies => deny-all to anon/authenticated. Only the service role (RLS-bypass)
-- and the SECURITY DEFINER function below ever touch this table.

-- Atomic fixed-window check: increments (bucket, identifier) and returns TRUE if
-- allowed (count <= p_max within the window), FALSE if exceeded. Resets on elapse.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text, p_identifier text, p_max integer, p_window_seconds integer
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit AS rl (bucket, identifier, window_start, count)
  VALUES (p_bucket, p_identifier, now(), 1)
  ON CONFLICT (bucket, identifier) DO UPDATE
    SET count = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_seconds)
                     THEN 1 ELSE rl.count + 1 END,
        window_start = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_seconds)
                            THEN now() ELSE rl.window_start END
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

-- ── Indexed existence check for auth users ──────────────────────────────────
-- /api/auth/login-link scanned ALL auth users page-by-page to detect a known
-- email — slow and a timing oracle for account enumeration. Indexed lookup,
-- service-role only.
CREATE OR REPLACE FUNCTION public.auth_user_email_exists(p_email text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email));
$$;
REVOKE ALL ON FUNCTION public.auth_user_email_exists(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_email_exists(text) TO service_role;

-- ── Advisor fix: pin a mutable search_path on an existing trigger function ──
ALTER FUNCTION public.touch_leads_updated_at() SET search_path = public;
