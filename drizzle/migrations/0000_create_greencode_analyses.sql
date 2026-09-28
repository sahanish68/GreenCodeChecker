CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_url text NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  branch text,
  commit_sha text,
  cloud_provider text,
  region text,
  carbon_score integer NOT NULL,
  estimated_energy_kwh numeric,
  estimated_emissions_g numeric,
  carbon_intensity numeric,
  languages jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.analyses TO anon;
GRANT SELECT, INSERT ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analyses are publicly readable"
  ON public.analyses FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create an analysis"
  ON public.analyses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX analyses_created_at_idx ON public.analyses (created_at DESC);