-- Migration: Função RPC de agregação de consumo de storage para Backblaze B2
-- Retorna o total de bytes e arquivos armazenados pela clínica para controle soberano de cotas

CREATE OR REPLACE FUNCTION public.get_clinic_storage_usage(_clinic_id uuid)
RETURNS TABLE (
  total_bytes bigint,
  total_files bigint
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    COALESCE(SUM(COALESCE(stored_byte_size, byte_size)), 0)::bigint AS total_bytes,
    COUNT(*)::bigint AS total_files
  FROM public.patient_file_uploads
  WHERE clinic_id = _clinic_id
    AND status = 'uploaded';
$$;

COMMENT ON FUNCTION public.get_clinic_storage_usage(uuid) IS 'Calcula o uso total de armazenamento em bytes e quantidade de arquivos confirmados no Backblaze B2 para a clínica informada.';

GRANT EXECUTE ON FUNCTION public.get_clinic_storage_usage(uuid) TO authenticated, service_role;
