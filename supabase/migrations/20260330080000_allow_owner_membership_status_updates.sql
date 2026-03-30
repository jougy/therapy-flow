CREATE OR REPLACE FUNCTION public.enforce_clinic_membership_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_role = 'account_owner' AND NEW.operational_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A conta compradora precisa manter o papel operacional owner.';
  END IF;

  IF NEW.account_role IS NULL AND NEW.operational_role = 'owner' THEN
    RAISE EXCEPTION 'O papel operacional owner fica reservado para a conta principal.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.account_role = 'account_owner' THEN
    IF NEW.account_role IS DISTINCT FROM OLD.account_role
      OR NEW.operational_role IS DISTINCT FROM OLD.operational_role
      OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A conta principal nao pode ser alterada por este fluxo.';
    END IF;
  END IF;

  IF NEW.membership_status IN ('active', 'invited') THEN
    NEW.is_active := true;
    NEW.ended_at := NULL;
  ELSE
    NEW.is_active := false;
    NEW.ended_at := COALESCE(NEW.ended_at, now());
  END IF;

  RETURN NEW;
END;
$$;
