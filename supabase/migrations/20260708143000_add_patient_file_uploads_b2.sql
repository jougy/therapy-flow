DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_file_upload_status') THEN
    CREATE TYPE public.patient_file_upload_status AS ENUM ('pending', 'uploaded', 'failed', 'deleted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_file_upload_category') THEN
    CREATE TYPE public.patient_file_upload_category AS ENUM ('anamnesis', 'exam', 'image', 'document', 'other');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.patient_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'backblaze_b2',
  bucket_name text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL,
  checksum_sha256 text,
  category public.patient_file_upload_category NOT NULL DEFAULT 'other',
  status public.patient_file_upload_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  upload_expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  uploaded_at timestamptz,
  last_accessed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_file_uploads_provider_valid CHECK (provider = 'backblaze_b2'),
  CONSTRAINT patient_file_uploads_bucket_not_blank CHECK (btrim(bucket_name) <> ''),
  CONSTRAINT patient_file_uploads_object_key_not_blank CHECK (btrim(object_key) <> ''),
  CONSTRAINT patient_file_uploads_filename_not_blank CHECK (btrim(original_filename) <> ''),
  CONSTRAINT patient_file_uploads_size_valid CHECK (byte_size > 0 AND byte_size <= 52428800),
  CONSTRAINT patient_file_uploads_sha256_valid CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT patient_file_uploads_uploaded_status_valid CHECK (
    (status = 'uploaded' AND uploaded_at IS NOT NULL)
    OR (status <> 'uploaded')
  ),
  CONSTRAINT patient_file_uploads_deleted_status_valid CHECK (
    (status = 'deleted' AND deleted_at IS NOT NULL)
    OR (status <> 'deleted')
  ),
  CONSTRAINT patient_file_uploads_bucket_key_unique UNIQUE (bucket_name, object_key)
);

CREATE INDEX IF NOT EXISTS idx_patient_file_uploads_patient_created
ON public.patient_file_uploads (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_file_uploads_session
ON public.patient_file_uploads (session_id, created_at DESC)
WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_file_uploads_status
ON public.patient_file_uploads (status, upload_expires_at)
WHERE status = 'pending';

DROP TRIGGER IF EXISTS update_patient_file_uploads_updated_at ON public.patient_file_uploads;
CREATE TRIGGER update_patient_file_uploads_updated_at
BEFORE UPDATE ON public.patient_file_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_file_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read patient file uploads" ON public.patient_file_uploads;
CREATE POLICY "Users read patient file uploads" ON public.patient_file_uploads
FOR SELECT TO authenticated
USING (
  clinic_id IS NOT NULL
  AND public.current_user_can('patients.read', clinic_id)
);

DROP POLICY IF EXISTS "Users insert patient file uploads" ON public.patient_file_uploads;
CREATE POLICY "Users insert patient file uploads" ON public.patient_file_uploads
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by_user_id = auth.uid()
  AND clinic_id IS NOT NULL
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users update patient file uploads" ON public.patient_file_uploads;
CREATE POLICY "Users update patient file uploads" ON public.patient_file_uploads
FOR UPDATE TO authenticated
USING (
  clinic_id IS NOT NULL
  AND public.current_user_can('patients.write', clinic_id)
)
WITH CHECK (
  clinic_id IS NOT NULL
  AND public.current_user_can('patients.write', clinic_id)
);

DROP POLICY IF EXISTS "Users delete patient file uploads" ON public.patient_file_uploads;
CREATE POLICY "Users delete patient file uploads" ON public.patient_file_uploads
FOR DELETE TO authenticated
USING (
  clinic_id IS NOT NULL
  AND public.current_user_can('patients.write', clinic_id)
);
