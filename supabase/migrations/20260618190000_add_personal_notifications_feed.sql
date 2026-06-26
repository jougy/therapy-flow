CREATE OR REPLACE FUNCTION public.list_current_user_notifications()
RETURNS TABLE (
  notification_id uuid,
  created_at timestamptz,
  event_type text,
  clinic_id uuid,
  clinic_name text,
  actor_user_id uuid,
  actor_name text,
  payload jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    security_events.id AS notification_id,
    security_events.created_at,
    security_events.event_type,
    security_events.clinic_id,
    clinics.name AS clinic_name,
    security_events.actor_user_id,
    actor_profile.full_name AS actor_name,
    security_events.payload
  FROM public.security_events
  LEFT JOIN public.clinics
    ON clinics.id = security_events.clinic_id
  LEFT JOIN public.profiles AS actor_profile
    ON actor_profile.id = security_events.actor_user_id
  WHERE security_events.target_user_id = auth.uid()
    AND security_events.visibility_scope IN ('self', 'admin')
    AND security_events.event_type IN (
      'clinic_access_removed',
      'clinic_member_left',
      'subaccount_status_changed',
      'subaccount_role_changed',
      'password_changed',
      'other_sessions_ended',
      'session_force_signed_out'
    )
  ORDER BY security_events.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.list_current_user_notifications() TO authenticated;
