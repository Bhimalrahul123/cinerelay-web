-- ==============================================================================
-- CineRelay Database Migration: Community Giveaways & Ticket Contest Platform
-- ==============================================================================
-- Apply this migration in your Supabase SQL Editor (Dashboard > SQL Editor)
-- Enables community users to host and participate in movie ticket & gift card giveaways.

-- 1. Create giveaways table
CREATE TABLE IF NOT EXISTS public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  host_name text DEFAULT 'CineRelay Member',
  host_email text,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Movie Tickets', -- 'Movie Tickets', 'Gift Cards', 'Events'
  prize_details text NOT NULL,
  prize_value numeric DEFAULT 0,
  venue text,
  movie_title text,
  tmdb_movie_id integer,
  end_time timestamptz NOT NULL,
  winners_count integer NOT NULL DEFAULT 1,
  claim_instructions text,
  status text NOT NULL DEFAULT 'active', -- 'active', 'ended'
  winners jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Create giveaway entries table
CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text DEFAULT 'Cinephile Entry',
  user_email text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_giveaway_user UNIQUE(giveaway_id, user_id)
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_giveaways_status ON public.giveaways (status);
CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON public.giveaways (end_time);
CREATE INDEX IF NOT EXISTS idx_giveaways_category ON public.giveaways (category);
CREATE INDEX IF NOT EXISTS idx_giveaways_host_id ON public.giveaways (host_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_id ON public.giveaway_entries (giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user_id ON public.giveaway_entries (user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

-- 5. Policies on public.giveaways
DROP POLICY IF EXISTS "Public can view all giveaways" ON public.giveaways;
CREATE POLICY "Public can view all giveaways"
ON public.giveaways FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create giveaways" ON public.giveaways;
CREATE POLICY "Authenticated users can create giveaways"
ON public.giveaways FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update their own giveaways" ON public.giveaways;
CREATE POLICY "Hosts can update their own giveaways"
ON public.giveaways FOR UPDATE
TO authenticated
USING (auth.uid() = host_id);

-- 6. Policies on public.giveaway_entries
DROP POLICY IF EXISTS "Public can view giveaway entries count" ON public.giveaway_entries;
CREATE POLICY "Public can view giveaway entries count"
ON public.giveaway_entries FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can enter giveaways" ON public.giveaway_entries;
CREATE POLICY "Authenticated users can enter giveaways"
ON public.giveaway_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. Grant Table Privileges
GRANT SELECT, INSERT, UPDATE ON TABLE public.giveaways TO authenticated, anon;
GRANT SELECT, INSERT ON TABLE public.giveaway_entries TO authenticated, anon;
