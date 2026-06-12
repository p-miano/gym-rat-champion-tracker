
DELETE FROM public.annual_awards WHERE year = 2026;
INSERT INTO public.annual_awards (year, athlete_id, award_key, details) VALUES
(2026, 'fe3ec965-168c-4e72-b66b-8032c259e5a3', 'voucher_limit', '{"weeks_at_three":4}'::jsonb),
(2026, 'f30e2a4d-a685-4b2d-8f0c-68d8fa39bc01', 'calendar_cheater', '{"compressed_weeks":9}'::jsonb),
(2026, '62ea2215-6330-497d-bcd4-269221b1c526', 'dorflex_sponsor', '{"times_last":2}'::jsonb),
(2026, 'f30e2a4d-a685-4b2d-8f0c-68d8fa39bc01', 'flexible_iron', '{"matches":7}'::jsonb),
(2026, 'f30e2a4d-a685-4b2d-8f0c-68d8fa39bc01', 'no_borders', '{"far_checkins":12,"base_lat":-22.8132,"base_lng":-47.2351,"home_checkins":45}'::jsonb),
(2026, 'e2b3b50e-4eca-487a-b9d7-3d51ec240e83', 'wod_comedian', '{"laughs":4}'::jsonb),
(2026, '1a19b2f8-6f89-462a-8af0-07457584a271', 'hypochondriac', '{"complaints":1}'::jsonb),
(2026, '461d2746-982d-4a0a-9225-72697be5dd2d', 'mile_eater', '{"total_km":171}'::jsonb),
(2026, '461d2746-982d-4a0a-9225-72697be5dd2d', 'early_bird', '{"early_checkins":33}'::jsonb);
