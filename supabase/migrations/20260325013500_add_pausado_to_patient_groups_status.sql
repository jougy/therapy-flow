ALTER TABLE public.patient_groups
DROP CONSTRAINT IF EXISTS patient_groups_status_check;

ALTER TABLE public.patient_groups
ADD CONSTRAINT patient_groups_status_check
CHECK (status IN ('em_andamento', 'pausado', 'concluido', 'cancelado', 'inativo'));
