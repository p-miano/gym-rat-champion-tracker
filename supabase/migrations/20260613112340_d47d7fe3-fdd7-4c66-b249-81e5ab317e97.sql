
-- check_ins: remove public read; restrict to authenticated
DROP POLICY IF EXISTS "Check-ins public read" ON public.check_ins;
REVOKE SELECT ON public.check_ins FROM anon;
GRANT SELECT ON public.check_ins TO authenticated;
CREATE POLICY "Check-ins authenticated read"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (true);

-- profiles: remove public read; owner or admin only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO authenticated;
CREATE POLICY "Profiles owner read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
