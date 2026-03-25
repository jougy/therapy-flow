ALTER TABLE public.patient_groups
ADD COLUMN status text NOT NULL DEFAULT 'em_andamento'
CHECK (status IN ('em_andamento', 'concluido', 'cancelado', 'inativo'));
