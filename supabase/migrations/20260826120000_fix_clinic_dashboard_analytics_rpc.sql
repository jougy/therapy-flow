-- Migration: Fix RPC get_clinic_dashboard_analytics for patient aggregations and null resilience
-- Date: 2026-08-26

CREATE OR REPLACE FUNCTION public.get_clinic_dashboard_analytics(
  _clinic_id uuid,
  _year int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  _result jsonb;

  _total_sessions int := 0;
  _canceled_sessions int := 0;
  _paid_sessions int := 0;
  _today_sessions int := 0;
  _week_sessions int := 0;
  _month_sessions int := 0;
  _year_sessions int := 0;

  _financial_paid bigint := 0;
  _financial_credit bigint := 0;
  _financial_open bigint := 0;
  _forecast_revenue_cents bigint := 0;

  _payment_status_counts jsonb;
  _payment_method_counts jsonb;
  _patient_status_counts jsonb;

  _total_patients int := 0;
  _recurring_patients int := 0;

  _agenda_late int := 0;
  _agenda_confirmed int := 0;
  _agenda_awaiting int := 0;
  _agenda_total int := 0;

  _monthly_revenue jsonb;
  _last_30_days jsonb;
  _weekday_distribution jsonb;
  _top_groups jsonb;
  _collaborators jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    public.current_user_can('treasury.manage', _clinic_id) OR
    public.current_user_can('sessions.read', _clinic_id) OR
    public.current_user_can('patients.read', _clinic_id) OR
    public.is_platform_owner_mfa_verified(_user_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar estatísticas desta clínica.';
  END IF;

  -- 1. Sessões: Contagens gerais e períodos
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'cancelado')::int,
    COUNT(*) FILTER (WHERE COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    COUNT(*) FILTER (WHERE session_date::date = CURRENT_DATE)::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('week', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('month', now()))::int,
    COUNT(*) FILTER (WHERE session_date >= date_trunc('year', now()))::int,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_paid_cents, 0) - COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::bigint
  INTO
    _total_sessions,
    _canceled_sessions,
    _paid_sessions,
    _today_sessions,
    _week_sessions,
    _month_sessions,
    _year_sessions,
    _financial_paid,
    _financial_credit,
    _financial_open
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  _forecast_revenue_cents := _financial_paid + _financial_credit + _financial_open;

  -- 2. Status de Pagamento (Contagens)
  SELECT jsonb_build_object(
    'cortesia', COUNT(*) FILTER (WHERE payment_status = 'cortesia')::int,
    'credit', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_paid_cents, 0) > COALESCE(amount_charged_cents, 0))::int,
    'debt', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) < COALESCE(amount_charged_cents, 0))::int,
    'pending', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int,
    'paid', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) > 0 AND COALESCE(amount_paid_cents, 0) >= COALESCE(amount_charged_cents, 0))::int,
    'notCharged', COUNT(*) FILTER (WHERE COALESCE(payment_status, '') <> 'cortesia' AND COALESCE(amount_charged_cents, 0) <= 0 AND COALESCE(amount_paid_cents, 0) <= 0)::int
  )
  INTO _payment_status_counts
  FROM public.sessions
  WHERE clinic_id = _clinic_id;

  -- 3. Métodos de Pagamento (Agrupados)
  SELECT COALESCE(jsonb_object_agg(sub.method_key, sub.cnt), '{}'::jsonb)
  INTO _payment_method_counts
  FROM (
    SELECT
      CASE
        WHEN payment_status = 'cortesia' THEN 'cortesia'
        WHEN payment_method IS NOT NULL AND payment_method <> '' THEN payment_method
        ELSE 'nao_informado'
      END AS method_key,
      COUNT(*)::int AS cnt
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY 1
  ) sub;

  -- 4. Pacientes (Status e Recorrência)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE (recurring_weekdays IS NOT NULL AND cardinality(recurring_weekdays) > 0) OR is_recurring = true)::int
  INTO
    _total_patients,
    _recurring_patients
  FROM public.patients
  WHERE clinic_id = _clinic_id;

  SELECT COALESCE(jsonb_object_agg(COALESCE(ps.status, 'ativo'), ps.cnt), '{}'::jsonb)
  INTO _patient_status_counts
  FROM (
    SELECT COALESCE(status, 'ativo') AS status, COUNT(*)::int AS cnt
    FROM public.patients
    WHERE clinic_id = _clinic_id
    GROUP BY COALESCE(status, 'ativo')
  ) ps;

  -- 5. Agenda de Atendimentos
  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND scheduled_for < now())::int,
    COUNT(*) FILTER (WHERE status = 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado' AND status <> 'confirmado' AND scheduled_for >= now())::int,
    COUNT(*) FILTER (WHERE status <> 'cancelado')::int
  INTO
    _agenda_late,
    _agenda_confirmed,
    _agenda_awaiting,
    _agenda_total
  FROM public.agenda_events
  WHERE clinic_id = _clinic_id;

  -- 6. Receita Mensal do Ano Selecionado (12 meses garantidos)
  WITH months AS (
    SELECT generate_series(1, 12) AS month_idx
  ),
  month_names AS (
    SELECT ARRAY['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] AS names
  ),
  monthly_agg AS (
    SELECT
      EXTRACT(MONTH FROM session_date)::int AS m_idx,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN LEAST(COALESCE(amount_paid_cents, 0), COALESCE(amount_charged_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS pago,
      COALESCE(SUM(CASE WHEN payment_status <> 'cortesia' THEN GREATEST(0, COALESCE(amount_charged_cents, 0) - COALESCE(amount_paid_cents, 0)) ELSE 0 END), 0)::numeric / 100.0 AS em_aberto,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND EXTRACT(YEAR FROM session_date)::int = _target_year
    GROUP BY EXTRACT(MONTH FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[m.month_idx] FROM month_names),
      'pago', COALESCE(ma.pago, 0),
      'emAberto', COALESCE(ma.em_aberto, 0),
      'atendimentos', COALESCE(ma.atendimentos, 0)
    ) ORDER BY m.month_idx ASC
  )
  INTO _monthly_revenue
  FROM months m
  LEFT JOIN monthly_agg ma ON ma.m_idx = m.month_idx;

  -- 7. Atendimentos nos Últimos 30 Dias (30 dias garantidos)
  WITH days AS (
    SELECT (CURRENT_DATE - (29 - i) * interval '1 day')::date AS day_date
    FROM generate_series(0, 29) AS i
  ),
  daily_agg AS (
    SELECT
      session_date::date AS d_date,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
      AND session_date::date >= (CURRENT_DATE - interval '29 days')::date
    GROUP BY session_date::date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', to_char(d.day_date, 'DD/MM'),
      'atendimentos', COALESCE(da.atendimentos, 0)
    ) ORDER BY d.day_date ASC
  )
  INTO _last_30_days
  FROM days d
  LEFT JOIN daily_agg da ON da.d_date = d.day_date;

  -- 8. Distribuição por Dia da Semana (0=Dom a 6=Sáb)
  WITH weekdays AS (
    SELECT generate_series(0, 6) AS dow_idx
  ),
  weekday_names AS (
    SELECT ARRAY['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] AS names
  ),
  weekday_agg AS (
    SELECT
      EXTRACT(DOW FROM session_date)::int AS dow,
      COUNT(*)::int AS atendimentos
    FROM public.sessions
    WHERE clinic_id = _clinic_id
    GROUP BY EXTRACT(DOW FROM session_date)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (SELECT names[w.dow_idx + 1] FROM weekday_names),
      'atendimentos', COALESCE(wa.atendimentos, 0)
    ) ORDER BY w.dow_idx ASC
  )
  INTO _weekday_distribution
  FROM weekdays w
  LEFT JOIN weekday_agg wa ON wa.dow = w.dow_idx;

  -- 9. Top Grupos / Linhas de Cuidado (Mais Atendidos)
  WITH resolved_sessions AS (
    SELECT
      s.id,
      COALESCE(
        s.group_id,
        (
          SELECT pg2.id
          FROM public.patient_groups pg2
          WHERE pg2.patient_id = s.patient_id
          ORDER BY pg2.is_default DESC, pg2.created_at ASC
          LIMIT 1
        )
      ) AS resolved_group_id
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  group_counts AS (
    SELECT
      COALESCE(pg.name, 'Sem grupo') AS group_name,
      COALESCE(cs.color_hex, pg.color, '#64748b') AS group_color,
      COUNT(*)::int AS total
    FROM resolved_sessions rs
    LEFT JOIN public.patient_groups pg ON pg.id = rs.resolved_group_id
    LEFT JOIN public.clinic_group_color_slots cs ON cs.id = pg.clinic_color_slot_id
    GROUP BY COALESCE(pg.name, 'Sem grupo'), COALESCE(cs.color_hex, pg.color, '#64748b')
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', gc.group_name,
        'color', gc.group_color,
        'total', gc.total
      )
    ),
    '[]'::jsonb
  )
  INTO _top_groups
  FROM group_counts gc;

  -- 10. Produtividade por Colaborador
  WITH collab_sessions AS (
    SELECT
      COALESCE(s.provider_id, s.user_id, '00000000-0000-0000-0000-000000000000'::uuid) AS collaborator_id,
      CASE WHEN s.payment_status <> 'cortesia' THEN LEAST(COALESCE(s.amount_paid_cents, 0), COALESCE(s.amount_charged_cents, 0)) ELSE 0 END AS paid_cents
    FROM public.sessions s
    WHERE s.clinic_id = _clinic_id
  ),
  collab_agg AS (
    SELECT
      cs.collaborator_id,
      COUNT(*)::int AS total,
      SUM(cs.paid_cents)::numeric / 100.0 AS receita
    FROM collab_sessions cs
    GROUP BY cs.collaborator_id
    ORDER BY total DESC
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(
          NULLIF(trim(p.full_name), ''),
          NULLIF(trim(p.social_name), ''),
          CASE
            WHEN p.job_title IS NOT NULL AND p.public_code IS NOT NULL THEN p.job_title || ' (' || p.public_code || ')'
            WHEN p.public_code IS NOT NULL THEN 'Colaborador ' || p.public_code
            WHEN p.email IS NOT NULL THEN p.email
            ELSE 'Colaborador'
          END
        ),
        'total', ca.total,
        'receita', ca.receita
      )
    ),
    '[]'::jsonb
  )
  INTO _collaborators
  FROM collab_agg ca
  LEFT JOIN public.profiles p ON p.id = ca.collaborator_id;

  -- 11. Montagem do Resultado Final Consolidado
  _result := jsonb_build_object(
    'year', _target_year,
    'totalSessions', _total_sessions,
    'paidSessions', _paid_sessions,
    'canceledSessions', _canceled_sessions,
    'cancellationRate', CASE WHEN _total_sessions > 0 THEN ROUND((_canceled_sessions::numeric / _total_sessions::numeric) * 100.0, 1) ELSE 0 END,
    'todaySessions', _today_sessions,
    'weekSessions', _week_sessions,
    'monthSessions', _month_sessions,
    'yearSessions', _year_sessions,
    'financialTotals', jsonb_build_object(
      'paid', _financial_paid,
      'credit', _financial_credit,
      'open', _financial_open,
      'forecastRevenueCents', _forecast_revenue_cents
    ),
    'paymentStatusCounts', COALESCE(_payment_status_counts, '{}'::jsonb),
    'paymentMethodCounts', COALESCE(_payment_method_counts, '{}'::jsonb),
    'patientStatusCounts', COALESCE(_patient_status_counts, '{}'::jsonb),
    'totalPatients', COALESCE(_total_patients, 0),
    'recurringPatients', COALESCE(_recurring_patients, 0),
    'agendaCounts', jsonb_build_object(
      'late', _agenda_late,
      'confirmed', _agenda_confirmed,
      'awaiting', _agenda_awaiting,
      'total', _agenda_total
    ),
    'monthlyRevenue', COALESCE(_monthly_revenue, '[]'::jsonb),
    'last30Days', COALESCE(_last_30_days, '[]'::jsonb),
    'weekdayDistribution', COALESCE(_weekday_distribution, '[]'::jsonb),
    'topGroups', COALESCE(_top_groups, '[]'::jsonb),
    'collaborators', COALESCE(_collaborators, '[]'::jsonb)
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_clinic_dashboard_analytics(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_clinic_dashboard_analytics(uuid, int) TO authenticated;
