drop policy if exists "role capabilities are readable by clinic members" on public.clinic_operational_role_capabilities;

create policy "role capabilities are readable by clinic members"
on public.clinic_operational_role_capabilities
for select
using (public.user_has_active_clinic_membership(auth.uid(), clinic_id));
