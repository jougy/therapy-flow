-- Adiciona coluna avatar_url (WebP compactado / URL) na tabela patients
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS avatar_url text;
