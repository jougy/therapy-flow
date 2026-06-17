create or replace function public.get_platform_clinic_detail(_clinic_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_platform_owner_mfa_verified(auth.uid()) then
      public.raise_exception_json('Verificacao de dois fatores obrigatoria para acesso de plataforma.')
    else (
      select jsonb_build_object(
        'clinic', to_jsonb(clinics),
        'owner', to_jsonb(owner_profile),
        'counts', jsonb_build_object(
          'collaborators', (select count(*) from public.clinic_memberships where clinic_id = clinics.id and is_active = true),
          'patients', (select count(*) from public.patients where clinic_id = clinics.id),
          'sessions', (select count(*) from public.sessions where clinic_id = clinics.id),
          'agendaEvents', (select count(*) from public.agenda_events where clinic_id = clinics.id)
        ),
        'memberships', coalesce((
          select jsonb_agg(member_row order by member_row.full_name nulls last, member_row.email nulls last)
          from (
            select
              clinic_memberships.id,
              clinic_memberships.user_id,
              clinic_memberships.account_role,
              clinic_memberships.operational_role,
              clinic_memberships.membership_status,
              clinic_memberships.is_active,
              clinic_memberships.joined_at,
              profiles.full_name,
              profiles.email
            from public.clinic_memberships
            left join public.profiles on profiles.id = clinic_memberships.user_id
            where clinic_memberships.clinic_id = clinics.id
          ) member_row
        ), '[]'::jsonb),
        'patients', coalesce((
          select jsonb_agg(patient_row order by patient_row.name nulls last, patient_row.created_at desc)
          from (
            select
              patients.id,
              patients.name,
              patients.email,
              patients.phone,
              patients.cpf,
              patients.status,
              patients.registration_complete,
              patients.created_at,
              patients.updated_at
            from public.patients
            where patients.clinic_id = clinics.id
            order by patients.created_at desc
            limit 120
          ) patient_row
        ), '[]'::jsonb)
      )
      from public.clinics
      left join public.profiles owner_profile on owner_profile.id = clinics.account_owner_user_id
      where clinics.id = _clinic_id
    )
  end
$$;

revoke all on function public.get_platform_clinic_detail(uuid) from public;
grant execute on function public.get_platform_clinic_detail(uuid) to authenticated;
