-- Migration: Create clinic_custom_words, global_word_candidates and telemetry
-- Module: Spellchecker & Collaborative Federated Clinical Dictionary

-- 1. Palavras Customizadas da Clínica (Tenant Specific)
CREATE TABLE IF NOT EXISTS public.clinic_custom_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  word text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_clinic_custom_word UNIQUE (clinic_id, word)
);

-- Índices para busca ultrarrápida da clínica
CREATE INDEX IF NOT EXISTS idx_clinic_custom_words_clinic_id 
  ON public.clinic_custom_words (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_custom_words_lookup 
  ON public.clinic_custom_words (clinic_id, word);

-- RLS para clinic_custom_words
ALTER TABLE public.clinic_custom_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da clinica podem visualizar palavras do corretor"
  ON public.clinic_custom_words
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_custom_words.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "Membros da clinica podem adicionar palavras ao corretor"
  ON public.clinic_custom_words
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_custom_words.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "Administradores da clinica podem excluir palavras do corretor"
  ON public.clinic_custom_words
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships cm
      WHERE cm.clinic_id = clinic_custom_words.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.operational_role IN ('admin', 'owner')
    )
  );

-- 2. Tabela de Candidatas a Promoção Global (Cross-Clinic Dictionary Pool)
CREATE TABLE IF NOT EXISTS public.global_word_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  user_count int NOT NULL DEFAULT 1,
  clinic_count int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'promoted', 'rejected')),
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_word_candidates_status 
  ON public.global_word_candidates(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_global_word_candidates_quorum 
  ON public.global_word_candidates(user_count, clinic_count) WHERE status = 'pending';

-- 3. Telemetria de Palavras para evitar fraude e computar quórum exato
CREATE TABLE IF NOT EXISTS public.global_word_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL REFERENCES public.global_word_candidates(word) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_word_telemetry_user_clinic UNIQUE (word, user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_global_word_telemetry_word 
  ON public.global_word_telemetry(word);

-- RLS para tabelas globais (Apenas serviço / admins globais)
ALTER TABLE public.global_word_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_word_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros autenticados podem consultar status de palavras globais"
  ON public.global_word_candidates
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Função & Trigger: Ingestão Automática de Telemetria e Quórum (>= 10 usuários E >= 3 clínicas)
CREATE OR REPLACE FUNCTION public.handle_clinic_word_telemetry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_word text;
  v_user_count int;
  v_clinic_count int;
BEGIN
  clean_word := lower(trim(NEW.word));

  -- Validação anti-spam / anti-PII mínima (somente letras e hífens, entre 3 e 35 caracteres)
  IF length(clean_word) >= 3 AND length(clean_word) <= 35 AND clean_word ~ '^[a-zà-ÿ]+(-[a-zà-ÿ]+)*$' THEN
    
    -- 1. Garante registro na candidata
    INSERT INTO public.global_word_candidates (word, user_count, clinic_count)
    VALUES (clean_word, 1, 1)
    ON CONFLICT (word) DO NOTHING;

    -- 2. Registra na telemetria (se o usuário for conhecido)
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.global_word_telemetry (word, user_id, clinic_id)
      VALUES (clean_word, NEW.created_by, NEW.clinic_id)
      ON CONFLICT (word, user_id, clinic_id) DO NOTHING;
    END IF;

    -- 3. Recalcula quórum
    SELECT 
      count(DISTINCT user_id),
      count(DISTINCT clinic_id)
    INTO 
      v_user_count, 
      v_clinic_count
    FROM public.global_word_telemetry
    WHERE word = clean_word;

    -- 4. Atualiza métricas e promove se atingiu quórum (10 usuários + 3 clínicas)
    UPDATE public.global_word_candidates
    SET 
      user_count = GREATEST(v_user_count, 1),
      clinic_count = GREATEST(v_clinic_count, 1),
      status = CASE 
        WHEN v_user_count >= 10 AND v_clinic_count >= 3 THEN 'promoted'
        ELSE status
      END,
      updated_at = now()
    WHERE word = clean_word;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_word_telemetry ON public.clinic_custom_words;
CREATE TRIGGER trg_clinic_word_telemetry
AFTER INSERT ON public.clinic_custom_words
FOR EACH ROW
EXECUTE FUNCTION public.handle_clinic_word_telemetry();
