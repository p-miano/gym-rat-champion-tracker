CREATE TABLE public.valid_group_codes (
  code text PRIMARY KEY,
  gymrats_group_id bigint NOT NULL,
  label text,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.valid_group_codes TO authenticated;
GRANT ALL ON public.valid_group_codes TO service_role;

ALTER TABLE public.valid_group_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "valid_group_codes auth read"
  ON public.valid_group_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "valid_group_codes admin manage"
  ON public.valid_group_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));