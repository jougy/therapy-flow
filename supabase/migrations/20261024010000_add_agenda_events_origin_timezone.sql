-- Migration: 20261024010000_add_agenda_events_origin_timezone.sql
-- Description: Adiciona colunas não-destrutivas (Expand and Contract) para suporte a fuso horário global e geolocalização de origem em agenda_events

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS origin_timezone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_lat double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_lng double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origin_city text DEFAULT NULL;

COMMENT ON COLUMN public.agenda_events.origin_timezone IS 'Identificador IANA do fuso horário de origem do evento (ex: America/Sao_Paulo, America/Manaus).';
COMMENT ON COLUMN public.agenda_events.origin_lat IS 'Latitude geográfica de origem da criação do evento (opcional).';
COMMENT ON COLUMN public.agenda_events.origin_lng IS 'Longitude geográfica de origem da criação do evento (opcional).';
COMMENT ON COLUMN public.agenda_events.origin_city IS 'Nome da cidade ou localidade de origem do agendamento (opcional).';
