
DROP POLICY IF EXISTS "Athletes public read" ON public.athletes;
CREATE POLICY "Athletes authenticated read"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (true);
