DROP POLICY IF EXISTS "Awards authenticated read" ON public.annual_awards;
DROP POLICY IF EXISTS "Check-ins authenticated read" ON public.check_ins;
DROP POLICY IF EXISTS "Months authenticated read" ON public.months;
DROP POLICY IF EXISTS "Month results authenticated read" ON public.month_results;
DROP POLICY IF EXISTS "Athletes authenticated read" ON public.athletes;
DROP POLICY IF EXISTS "valid_group_codes auth read" ON public.valid_group_codes;
DROP POLICY IF EXISTS "valid_groups authenticated read" ON public.valid_groups;
CREATE POLICY "Athletes self read" ON public.athletes FOR SELECT TO authenticated USING (claimed_by_user_id = auth.uid());