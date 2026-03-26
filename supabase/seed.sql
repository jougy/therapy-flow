DO $$
DECLARE
  _solo_owner uuid := '11111111-1111-1111-1111-111111111111';
  _clinic_owner uuid := '22222222-2222-2222-2222-222222222222';
  _solo_clinic_id uuid;
  _clinic_plan_id uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', _solo_owner, 'authenticated', 'authenticated', 'solo@therapyflow.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', _clinic_owner, 'authenticated', 'authenticated', 'clinic.owner@therapyflow.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES
    ('aaaaaaa1-1111-1111-1111-111111111111', _solo_owner, format('{"sub":"%s","email":"%s"}', _solo_owner, 'solo@therapyflow.local')::jsonb, 'email', 'solo@therapyflow.local', now(), now(), now()),
    ('aaaaaaa2-2222-2222-2222-222222222222', _clinic_owner, format('{"sub":"%s","email":"%s"}', _clinic_owner, 'clinic.owner@therapyflow.local')::jsonb, 'email', 'clinic.owner@therapyflow.local', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.handle_signup(_solo_owner, 'solo@therapyflow.local', '12345678000190', 'solo', 'Conta Solo');
  PERFORM public.handle_signup(_clinic_owner, 'clinic.owner@therapyflow.local', '98765432000110', 'clinic', 'Conta Clinic');

  SELECT id INTO _solo_clinic_id FROM public.clinics WHERE cnpj = '12345678000190';
  SELECT id INTO _clinic_plan_id FROM public.clinics WHERE cnpj = '98765432000110';

  UPDATE public.clinics
  SET
    name = 'TherapyFlow Solo',
    legal_name = 'TherapyFlow Solo LTDA',
    email = 'solo@therapyflow.local',
    phone = '11999990000'
  WHERE id = _solo_clinic_id;

  UPDATE public.clinics
  SET
    name = 'TherapyFlow Clinic',
    legal_name = 'TherapyFlow Clinic LTDA',
    email = 'clinic.owner@therapyflow.local',
    phone = '11999991111',
    subaccount_limit = 4
  WHERE id = _clinic_plan_id;
END
$$;
