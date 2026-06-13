UPDATE public.athletes SET display_mode = 'placeholder' WHERE display_mode NOT IN ('placeholder','real');
ALTER TABLE public.athletes DROP COLUMN IF EXISTS public_nickname;
ALTER TABLE public.athletes DROP CONSTRAINT IF EXISTS athletes_display_mode_check;
ALTER TABLE public.athletes ADD CONSTRAINT athletes_display_mode_check CHECK (display_mode IN ('placeholder','real'));