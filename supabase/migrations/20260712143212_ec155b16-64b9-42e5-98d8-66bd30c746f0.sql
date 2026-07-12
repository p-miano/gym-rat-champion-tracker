
DROP POLICY IF EXISTS "Awards public read" ON public.annual_awards;
CREATE POLICY "Awards authenticated read" ON public.annual_awards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Month results public read" ON public.month_results;
CREATE POLICY "Month results authenticated read" ON public.month_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Months public read" ON public.months;
CREATE POLICY "Months authenticated read" ON public.months FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "valid_groups public read" ON public.valid_groups;
CREATE POLICY "valid_groups authenticated read" ON public.valid_groups FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.annual_awards FROM anon;
REVOKE SELECT ON public.month_results FROM anon;
REVOKE SELECT ON public.months FROM anon;
REVOKE SELECT ON public.valid_groups FROM anon;
