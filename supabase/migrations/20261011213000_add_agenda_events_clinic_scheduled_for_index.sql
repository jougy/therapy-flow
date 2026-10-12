-- Migration: 20261011213000_add_agenda_events_clinic_scheduled_for_index.sql
-- Description: Adiciona índice composto B-Tree em (clinic_id, scheduled_for) para acelerar consultas de agenda em O(log N)
-- e índices para status e busca temporal em agenda_events e platform_onboarding_meetings

-- 1. Índice composto essencial para consultas de agenda da clínica por faixa de data (hoje, semana, mês)
CREATE INDEX IF NOT EXISTS idx_agenda_events_clinic_scheduled_for 
    ON public.agenda_events (clinic_id, scheduled_for);

-- 2. Índice composto para busca rápida do próximo agendamento ativo por clínica
CREATE INDEX IF NOT EXISTS idx_agenda_events_clinic_scheduled_active 
    ON public.agenda_events (clinic_id, scheduled_for ASC) 
    WHERE (status <> 'cancelado');

-- 3. Índice em platform_onboarding_meetings para ordenação e busca por data
CREATE INDEX IF NOT EXISTS idx_platform_onboarding_meetings_scheduled_at 
    ON public.platform_onboarding_meetings (scheduled_at ASC);
