ALTER TABLE public.patient_file_uploads
ADD COLUMN IF NOT EXISTS original_byte_size bigint,
ADD COLUMN IF NOT EXISTS stored_byte_size bigint,
ADD COLUMN IF NOT EXISTS original_content_type text,
ADD COLUMN IF NOT EXISTS stored_content_type text,
ADD COLUMN IF NOT EXISTS storage_encoding text,
ADD COLUMN IF NOT EXISTS compression_profile text,
ADD COLUMN IF NOT EXISTS image_width integer,
ADD COLUMN IF NOT EXISTS image_height integer,
ADD COLUMN IF NOT EXISTS page_count integer;

UPDATE public.patient_file_uploads
SET
  original_byte_size = COALESCE(original_byte_size, byte_size),
  stored_byte_size = COALESCE(stored_byte_size, byte_size),
  original_content_type = COALESCE(original_content_type, content_type),
  stored_content_type = COALESCE(stored_content_type, content_type),
  compression_profile = COALESCE(compression_profile, 'original')
WHERE original_byte_size IS NULL
  OR stored_byte_size IS NULL
  OR original_content_type IS NULL
  OR stored_content_type IS NULL
  OR compression_profile IS NULL;

ALTER TABLE public.patient_file_uploads
ALTER COLUMN original_byte_size SET DEFAULT 0,
ALTER COLUMN stored_byte_size SET DEFAULT 0,
ALTER COLUMN compression_profile SET DEFAULT 'original';

ALTER TABLE public.patient_file_uploads
DROP CONSTRAINT IF EXISTS patient_file_uploads_original_size_valid,
ADD CONSTRAINT patient_file_uploads_original_size_valid CHECK (original_byte_size IS NULL OR original_byte_size >= 0);

ALTER TABLE public.patient_file_uploads
DROP CONSTRAINT IF EXISTS patient_file_uploads_stored_size_valid,
ADD CONSTRAINT patient_file_uploads_stored_size_valid CHECK (stored_byte_size IS NULL OR stored_byte_size >= 0);

ALTER TABLE public.patient_file_uploads
DROP CONSTRAINT IF EXISTS patient_file_uploads_storage_encoding_valid,
ADD CONSTRAINT patient_file_uploads_storage_encoding_valid CHECK (
  storage_encoding IS NULL OR storage_encoding IN ('gzip', 'deflate')
);

ALTER TABLE public.patient_file_uploads
DROP CONSTRAINT IF EXISTS patient_file_uploads_image_dimensions_valid,
ADD CONSTRAINT patient_file_uploads_image_dimensions_valid CHECK (
  (image_width IS NULL AND image_height IS NULL)
  OR (
    COALESCE(image_width, 0) > 0
    AND COALESCE(image_height, 0) > 0
    AND image_width <= 20000
    AND image_height <= 20000
  )
);

ALTER TABLE public.patient_file_uploads
DROP CONSTRAINT IF EXISTS patient_file_uploads_page_count_valid,
ADD CONSTRAINT patient_file_uploads_page_count_valid CHECK (page_count IS NULL OR page_count > 0);
