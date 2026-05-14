-- Emergency Alerts table
-- Patients trigger this when they click SOS or say "emergency"/"help"
CREATE TABLE public.emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT 'Patient needs help!',
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Patient can insert their own alerts
CREATE POLICY "alerts patient insert" ON public.emergency_alerts
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Patient can read their own alerts
CREATE POLICY "alerts patient read" ON public.emergency_alerts
  FOR SELECT USING (auth.uid() = patient_id);

-- Caregiver can read alerts for linked patients
CREATE POLICY "alerts caregiver read" ON public.emergency_alerts
  FOR SELECT USING (public.is_caregiver_of(auth.uid(), patient_id));

-- Caregiver can update (resolve) alerts for linked patients
CREATE POLICY "alerts caregiver update" ON public.emergency_alerts
  FOR UPDATE USING (public.is_caregiver_of(auth.uid(), patient_id));

-- Patient can update (resolve) their own alerts
CREATE POLICY "alerts patient update" ON public.emergency_alerts
  FOR UPDATE USING (auth.uid() = patient_id);

-- Enable Realtime for this table (run in Supabase dashboard if not auto-applied)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
