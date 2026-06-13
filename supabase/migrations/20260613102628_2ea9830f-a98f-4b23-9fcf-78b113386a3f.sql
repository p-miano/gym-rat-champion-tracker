
-- 1) valid_groups table
CREATE TABLE IF NOT EXISTS public.valid_groups (
  gymrats_group_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.valid_groups TO anon, authenticated;
GRANT ALL ON public.valid_groups TO service_role;
ALTER TABLE public.valid_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "valid_groups public read" ON public.valid_groups FOR SELECT TO public USING (true);
CREATE POLICY "valid_groups admin manage" ON public.valid_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) athletes: privacy + claim columns
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS public_nickname TEXT,
  ADD COLUMN IF NOT EXISTS show_google_photo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_photo_url TEXT;

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_display_mode_check;
ALTER TABLE public.athletes
  ADD CONSTRAINT athletes_display_mode_check
  CHECK (display_mode IN ('placeholder','nickname','real'));

CREATE UNIQUE INDEX IF NOT EXISTS athletes_claimed_by_user_id_key
  ON public.athletes(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;

-- Allow a claimed user to update only their own athlete row
DROP POLICY IF EXISTS "Athletes self update privacy" ON public.athletes;
CREATE POLICY "Athletes self update privacy" ON public.athletes FOR UPDATE TO authenticated
  USING (claimed_by_user_id = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid());

-- 3) profiles: link to athlete + onboarding marker
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_athlete_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Allow user to read own profile (already public-read, but ensure UPDATE works for new cols already covered)

-- 4) update handle_new_user to auto-promote paulamiano@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  is_owner BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_owner := lower(COALESCE(NEW.email,'')) = 'paulamiano@gmail.com';
  IF user_count = 1 OR is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Backfill: if paulamiano@gmail.com already exists, promote
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'paulamiano@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
