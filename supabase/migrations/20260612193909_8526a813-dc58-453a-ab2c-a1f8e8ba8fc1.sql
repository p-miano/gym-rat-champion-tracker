
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profile auto-create + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Months
CREATE TABLE public.months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  name TEXT NOT NULL,
  source_id BIGINT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(year, month)
);
GRANT SELECT ON public.months TO anon, authenticated;
GRANT ALL ON public.months TO service_role;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Months public read" ON public.months FOR SELECT USING (true);
CREATE POLICY "Admins manage months" ON public.months FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Athletes
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gymrats_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.athletes TO anon, authenticated;
GRANT ALL ON public.athletes TO service_role;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Athletes public read" ON public.athletes FOR SELECT USING (true);
CREATE POLICY "Admins manage athletes" ON public.athletes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Check-ins
CREATE TABLE public.check_ins (
  id BIGINT PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  duration_min INT,
  distance_km NUMERIC,
  location_latitude NUMERIC,
  location_longitude NUMERIC,
  location_name TEXT,
  has_photo BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  title TEXT,
  description TEXT,
  activity_type TEXT,
  reactions TEXT[] NOT NULL DEFAULT '{}',
  is_valid BOOLEAN NOT NULL DEFAULT true,
  invalid_reasons TEXT[] NOT NULL DEFAULT '{}',
  raw JSONB
);
CREATE INDEX idx_check_ins_month ON public.check_ins(month_id);
CREATE INDEX idx_check_ins_athlete ON public.check_ins(athlete_id);
CREATE INDEX idx_check_ins_occurred ON public.check_ins(occurred_at);
GRANT SELECT ON public.check_ins TO anon, authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Check-ins public read" ON public.check_ins FOR SELECT USING (true);
CREATE POLICY "Admins manage check-ins" ON public.check_ins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Month results
CREATE TABLE public.month_results (
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  active_days INT NOT NULL DEFAULT 0,
  total_checkins INT NOT NULL DEFAULT 0,
  total_minutes INT NOT NULL DEFAULT 0,
  total_distance_km NUMERIC NOT NULL DEFAULT 0,
  rank INT NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  is_last BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (month_id, athlete_id)
);
GRANT SELECT ON public.month_results TO anon, authenticated;
GRANT ALL ON public.month_results TO service_role;
ALTER TABLE public.month_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Month results public read" ON public.month_results FOR SELECT USING (true);
CREATE POLICY "Admins manage month results" ON public.month_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Annual awards
CREATE TABLE public.annual_awards (
  year INT NOT NULL,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  award_key TEXT NOT NULL,
  details JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (year, athlete_id, award_key)
);
GRANT SELECT ON public.annual_awards TO anon, authenticated;
GRANT ALL ON public.annual_awards TO service_role;
ALTER TABLE public.annual_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Awards public read" ON public.annual_awards FOR SELECT USING (true);
CREATE POLICY "Admins manage awards" ON public.annual_awards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
