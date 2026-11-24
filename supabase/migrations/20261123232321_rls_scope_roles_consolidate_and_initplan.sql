-- Migration: Otimização RLS (0003_auth_rls_initplan + 0006_multiple_permissive_policies)
-- 1. Restringe policies TO public -> TO authenticated (exceto leitura pública de cupons ativos)
-- 2. Consolida policies permissivas sobrepostas por (tabela, comando) preservando equivalência booleana
-- 3. Envolve chamadas auth.uid()/auth.jwt()/current_setting() em (select ...) para InitPlan

-- === affiliate_commissions ===
DROP POLICY IF EXISTS "Platform admins manage commissions" ON public."affiliate_commissions";
DROP POLICY IF EXISTS "Service role manages all commissions" ON public."affiliate_commissions";
DROP POLICY IF EXISTS "Affiliates and admins read commissions" ON public."affiliate_commissions";
CREATE POLICY "affiliate_commissions_select_authenticated_consolidated" ON public."affiliate_commissions" FOR SELECT TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR (((affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliate_commissions_insert_authenticated_consolidated" ON public."affiliate_commissions" FOR INSERT TO authenticated WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_commissions_update_authenticated_consolidated" ON public."affiliate_commissions" FOR UPDATE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true)) WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_commissions_delete_authenticated_consolidated" ON public."affiliate_commissions" FOR DELETE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));

-- === affiliate_conversions ===
DROP POLICY IF EXISTS "Platform admins manage conversions" ON public."affiliate_conversions";
DROP POLICY IF EXISTS "Service role manages all conversions" ON public."affiliate_conversions";
DROP POLICY IF EXISTS "Affiliates and admins read conversions" ON public."affiliate_conversions";
CREATE POLICY "affiliate_conversions_select_authenticated_consolidated" ON public."affiliate_conversions" FOR SELECT TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR (((affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliate_conversions_insert_authenticated_consolidated" ON public."affiliate_conversions" FOR INSERT TO authenticated WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_conversions_update_authenticated_consolidated" ON public."affiliate_conversions" FOR UPDATE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true)) WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_conversions_delete_authenticated_consolidated" ON public."affiliate_conversions" FOR DELETE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));

-- === affiliate_crm_logs ===
DROP POLICY IF EXISTS "Platform admins manage crm logs" ON public."affiliate_crm_logs";
DROP POLICY IF EXISTS "Service role manages all crm logs" ON public."affiliate_crm_logs";
DROP POLICY IF EXISTS "Affiliates and admins insert crm logs" ON public."affiliate_crm_logs";
DROP POLICY IF EXISTS "Affiliates and admins read crm logs" ON public."affiliate_crm_logs";
CREATE POLICY "affiliate_crm_logs_select_authenticated_consolidated" ON public."affiliate_crm_logs" FOR SELECT TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR (((affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliate_crm_logs_insert_authenticated_consolidated" ON public."affiliate_crm_logs" FOR INSERT TO authenticated WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR (((affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliate_crm_logs_update_authenticated_consolidated" ON public."affiliate_crm_logs" FOR UPDATE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true)) WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_crm_logs_delete_authenticated_consolidated" ON public."affiliate_crm_logs" FOR DELETE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));

-- === affiliate_invitations ===
DROP POLICY IF EXISTS "Managers and platform admins manage affiliate invitations" ON public."affiliate_invitations";
DROP POLICY IF EXISTS "Service role manages all affiliate invitations" ON public."affiliate_invitations";
DROP POLICY IF EXISTS "Invited users and managers read affiliate invitations" ON public."affiliate_invitations";
CREATE POLICY "affiliate_invitations_select_authenticated_consolidated" ON public."affiliate_invitations" FOR SELECT TO authenticated USING (((((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR ((((invited_user_id IS NOT NULL) AND (invited_user_id = ( SELECT auth.uid() AS uid))) OR ((invited_email IS NOT NULL) AND (lower(invited_email) = lower(COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text)))) OR ((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id) OR current_user_can('marketing.affiliates.view'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliate_invitations_insert_authenticated_consolidated" ON public."affiliate_invitations" FOR INSERT TO authenticated WITH CHECK (((((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_invitations_update_authenticated_consolidated" ON public."affiliate_invitations" FOR UPDATE TO authenticated USING (((((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true)) WITH CHECK (((((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliate_invitations_delete_authenticated_consolidated" ON public."affiliate_invitations" FOR DELETE TO authenticated USING (((((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliate_invitations.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliate_invitations.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))) OR current_user_can('marketing.affiliates.manage'::text, clinic_id))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));

-- === affiliates ===
DROP POLICY IF EXISTS "Platform admins manage affiliates" ON public."affiliates";
DROP POLICY IF EXISTS "Service role manages all affiliates" ON public."affiliates";
DROP POLICY IF EXISTS "Users can read affiliates if owner, clinic admin or platform ad" ON public."affiliates";
CREATE POLICY "affiliates_select_authenticated_consolidated" ON public."affiliates" FOR SELECT TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true) OR (((user_id = ( SELECT auth.uid() AS uid)) OR ((clinic_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = affiliates.clinic_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true) AND (cm.membership_status = 'active'::membership_status_type) AND ((cm.account_role = 'account_owner'::account_role_type) OR (cm.operational_role = ANY (ARRAY['owner'::operational_role_type, 'admin'::operational_role_type])))))) OR (EXISTS ( SELECT 1
   FROM clinics c
  WHERE ((c.id = affiliates.clinic_id) AND (c.account_owner_user_id = ( SELECT auth.uid() AS uid))))))) OR is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "affiliates_insert_authenticated_consolidated" ON public."affiliates" FOR INSERT TO authenticated WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliates_update_authenticated_consolidated" ON public."affiliates" FOR UPDATE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true)) WITH CHECK (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));
CREATE POLICY "affiliates_delete_authenticated_consolidated" ON public."affiliates" FOR DELETE TO authenticated USING (((is_platform_admin(( SELECT auth.uid() AS uid)) OR is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))) OR (true));

-- === agenda_events ===
DROP POLICY IF EXISTS "Super admins manage all agenda events" ON public."agenda_events";
DROP POLICY IF EXISTS "Users delete clinic agenda events" ON public."agenda_events";
DROP POLICY IF EXISTS "Users write clinic agenda events" ON public."agenda_events";
DROP POLICY IF EXISTS "Users read clinic agenda events" ON public."agenda_events";
DROP POLICY IF EXISTS "Users update clinic agenda events" ON public."agenda_events";
CREATE POLICY "agenda_events_select_authenticated_consolidated" ON public."agenda_events" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND can_read_clinic_data(clinic_id) AND current_user_can('agenda.read'::text, clinic_id))));
CREATE POLICY "agenda_events_insert_authenticated_consolidated" ON public."agenda_events" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('agenda.write'::text, clinic_id))));
CREATE POLICY "agenda_events_update_authenticated_consolidated" ON public."agenda_events" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('agenda.write'::text, clinic_id)))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('agenda.write'::text, clinic_id))));
CREATE POLICY "agenda_events_delete_authenticated_consolidated" ON public."agenda_events" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('agenda.delete_events'::text, clinic_id))));

-- === anamnesis_form_templates ===
DROP POLICY IF EXISTS "Super admins manage all anamnesis form templates" ON public."anamnesis_form_templates";
DROP POLICY IF EXISTS "Users delete clinic anamnesis forms" ON public."anamnesis_form_templates";
DROP POLICY IF EXISTS "Users write clinic anamnesis forms" ON public."anamnesis_form_templates";
DROP POLICY IF EXISTS "Users read clinic anamnesis forms" ON public."anamnesis_form_templates";
DROP POLICY IF EXISTS "Users update clinic anamnesis forms" ON public."anamnesis_form_templates";
CREATE POLICY "anamnesis_form_templates_select_authenticated_consolidated" ON public."anamnesis_form_templates" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((deleted_at IS NULL) AND (clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) AND can_read_clinic_data(clinic_id) AND (current_user_can('forms.read'::text, clinic_id) OR current_user_can('anamnesis_forms.read'::text, clinic_id)))));
CREATE POLICY "anamnesis_form_templates_insert_authenticated_consolidated" ON public."anamnesis_form_templates" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('forms.manage'::text, clinic_id))));
CREATE POLICY "anamnesis_form_templates_update_authenticated_consolidated" ON public."anamnesis_form_templates" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('forms.manage'::text, clinic_id)))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('forms.manage'::text, clinic_id))));
CREATE POLICY "anamnesis_form_templates_delete_authenticated_consolidated" ON public."anamnesis_form_templates" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('forms.manage'::text, clinic_id))));

-- === app_notifications ===
DROP POLICY IF EXISTS "Users delete own app notifications" ON public."app_notifications";
DROP POLICY IF EXISTS "Users read own app notifications" ON public."app_notifications";
DROP POLICY IF EXISTS "Users update own app notifications" ON public."app_notifications";
CREATE POLICY "app_notifications_select_authenticated_consolidated" ON public."app_notifications" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));
CREATE POLICY "app_notifications_update_authenticated_consolidated" ON public."app_notifications" FOR UPDATE TO authenticated USING (((user_id = (select auth.uid())))) WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "app_notifications_delete_authenticated_consolidated" ON public."app_notifications" FOR DELETE TO authenticated USING (((user_id = (select auth.uid()))));

-- === asaas_webhook_events ===
DROP POLICY IF EXISTS "Platform admins podem ver eventos de webhook" ON public."asaas_webhook_events";
CREATE POLICY "asaas_webhook_events_select_authenticated_consolidated" ON public."asaas_webhook_events" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))));

-- === clinic_custom_words ===
DROP POLICY IF EXISTS "Administradores da clinica podem excluir palavras do corretor" ON public."clinic_custom_words";
DROP POLICY IF EXISTS "Membros da clinica podem adicionar palavras ao corretor" ON public."clinic_custom_words";
DROP POLICY IF EXISTS "Membros da clinica podem visualizar palavras do corretor" ON public."clinic_custom_words";
CREATE POLICY "clinic_custom_words_select_authenticated_consolidated" ON public."clinic_custom_words" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = clinic_custom_words.clinic_id) AND (cm.user_id = (select auth.uid())) AND (cm.is_active = true) AND (cm.membership_status = 'active'::membership_status_type))))));
CREATE POLICY "clinic_custom_words_insert_authenticated_consolidated" ON public."clinic_custom_words" FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = clinic_custom_words.clinic_id) AND (cm.user_id = (select auth.uid())) AND (cm.is_active = true) AND (cm.membership_status = 'active'::membership_status_type))))));
CREATE POLICY "clinic_custom_words_delete_authenticated_consolidated" ON public."clinic_custom_words" FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = clinic_custom_words.clinic_id) AND (cm.user_id = (select auth.uid())) AND (cm.is_active = true) AND (cm.membership_status = 'active'::membership_status_type) AND (cm.operational_role = ANY (ARRAY['admin'::operational_role_type, 'owner'::operational_role_type])))))));

-- === clinic_daily_metrics ===
DROP POLICY IF EXISTS "Users read clinic daily metrics" ON public."clinic_daily_metrics";
CREATE POLICY "clinic_daily_metrics_select_authenticated_consolidated" ON public."clinic_daily_metrics" FOR SELECT TO authenticated USING ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) AND (current_user_can('treasury.read'::text, clinic_id) OR current_user_can('sessions.read'::text, clinic_id)))));

-- === clinic_document_signatures ===
DROP POLICY IF EXISTS "Super admins manage all clinic document signatures" ON public."clinic_document_signatures";
DROP POLICY IF EXISTS "Users delete clinic document signatures" ON public."clinic_document_signatures";
DROP POLICY IF EXISTS "Users insert clinic document signatures" ON public."clinic_document_signatures";
DROP POLICY IF EXISTS "Users read clinic document signatures" ON public."clinic_document_signatures";
DROP POLICY IF EXISTS "Users update clinic document signatures" ON public."clinic_document_signatures";
CREATE POLICY "clinic_document_signatures_select_authenticated_consolidated" ON public."clinic_document_signatures" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND can_read_clinic_data(clinic_id) AND (current_user_can('patients.read'::text, clinic_id) OR current_user_can('sessions.read'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id)) AND ((deleted_at IS NULL) OR current_user_can('clinic_trash.manage'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_signatures_insert_authenticated_consolidated" ON public."clinic_document_signatures" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_signatures_update_authenticated_consolidated" ON public."clinic_document_signatures" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id))))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_signatures_delete_authenticated_consolidated" ON public."clinic_document_signatures" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('clinic_trash.manage'::text, clinic_id) OR current_user_can('patients.delete'::text, clinic_id)))));

-- === clinic_document_templates ===
DROP POLICY IF EXISTS "Users delete clinic document templates" ON public."clinic_document_templates";
DROP POLICY IF EXISTS "Users insert clinic document templates" ON public."clinic_document_templates";
DROP POLICY IF EXISTS "Users read clinic document templates" ON public."clinic_document_templates";
DROP POLICY IF EXISTS "Users update clinic document templates" ON public."clinic_document_templates";
CREATE POLICY "clinic_document_templates_select_authenticated_consolidated" ON public."clinic_document_templates" FOR SELECT TO authenticated USING (((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND can_read_clinic_data(clinic_id) AND ((deleted_at IS NULL) OR current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_trash.manage'::text, clinic_id) OR current_user_can('clinic_profile.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_templates_insert_authenticated_consolidated" ON public."clinic_document_templates" FOR INSERT TO authenticated WITH CHECK (((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_profile.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_templates_update_authenticated_consolidated" ON public."clinic_document_templates" FOR UPDATE TO authenticated USING (((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_profile.manage'::text, clinic_id))))) WITH CHECK (((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_profile.manage'::text, clinic_id)))));
CREATE POLICY "clinic_document_templates_delete_authenticated_consolidated" ON public."clinic_document_templates" FOR DELETE TO authenticated USING (((((clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_profile.manage'::text, clinic_id)))));

-- === clinic_group_color_slots ===
DROP POLICY IF EXISTS "Users write clinic_group_color_slots" ON public."clinic_group_color_slots";
DROP POLICY IF EXISTS "Users read clinic_group_color_slots" ON public."clinic_group_color_slots";
CREATE POLICY "clinic_group_color_slots_select_authenticated_consolidated" ON public."clinic_group_color_slots" FOR SELECT TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))) OR (((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.read'::text, clinic_id))));
CREATE POLICY "clinic_group_color_slots_insert_authenticated_consolidated" ON public."clinic_group_color_slots" FOR INSERT TO authenticated WITH CHECK ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "clinic_group_color_slots_update_authenticated_consolidated" ON public."clinic_group_color_slots" FOR UPDATE TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id)))) WITH CHECK ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "clinic_group_color_slots_delete_authenticated_consolidated" ON public."clinic_group_color_slots" FOR DELETE TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));

-- === clinic_health_insurances ===
DROP POLICY IF EXISTS "clinic_health_insurances_delete" ON public."clinic_health_insurances";
DROP POLICY IF EXISTS "clinic_health_insurances_insert" ON public."clinic_health_insurances";
DROP POLICY IF EXISTS "clinic_health_insurances_select" ON public."clinic_health_insurances";
DROP POLICY IF EXISTS "clinic_health_insurances_update" ON public."clinic_health_insurances";
CREATE POLICY "clinic_health_insurances_select_authenticated_consolidated" ON public."clinic_health_insurances" FOR SELECT TO authenticated USING (((user_has_active_clinic_membership((select auth.uid()), clinic_id) AND (deleted_at IS NULL))));
CREATE POLICY "clinic_health_insurances_insert_authenticated_consolidated" ON public."clinic_health_insurances" FOR INSERT TO authenticated WITH CHECK ((current_user_can('treasury.manage'::text, clinic_id)));
CREATE POLICY "clinic_health_insurances_update_authenticated_consolidated" ON public."clinic_health_insurances" FOR UPDATE TO authenticated USING ((current_user_can('treasury.manage'::text, clinic_id))) WITH CHECK ((current_user_can('treasury.manage'::text, clinic_id)));
CREATE POLICY "clinic_health_insurances_delete_authenticated_consolidated" ON public."clinic_health_insurances" FOR DELETE TO authenticated USING ((current_user_can('treasury.manage'::text, clinic_id)));

-- === clinic_insurance_procedures ===
DROP POLICY IF EXISTS "clinic_insurance_procedures_all" ON public."clinic_insurance_procedures";
DROP POLICY IF EXISTS "clinic_insurance_procedures_select" ON public."clinic_insurance_procedures";
CREATE POLICY "clinic_insurance_procedures_select_authenticated_consolidated" ON public."clinic_insurance_procedures" FOR SELECT TO authenticated USING ((current_user_can('treasury.manage'::text, clinic_id)) OR (user_has_active_clinic_membership((select auth.uid()), clinic_id)));
CREATE POLICY "clinic_insurance_procedures_insert_authenticated_consolidated" ON public."clinic_insurance_procedures" FOR INSERT TO authenticated WITH CHECK ((current_user_can('treasury.manage'::text, clinic_id)));
CREATE POLICY "clinic_insurance_procedures_update_authenticated_consolidated" ON public."clinic_insurance_procedures" FOR UPDATE TO authenticated USING ((current_user_can('treasury.manage'::text, clinic_id))) WITH CHECK ((current_user_can('treasury.manage'::text, clinic_id)));
CREATE POLICY "clinic_insurance_procedures_delete_authenticated_consolidated" ON public."clinic_insurance_procedures" FOR DELETE TO authenticated USING ((current_user_can('treasury.manage'::text, clinic_id)));

-- === clinic_memberships ===
DROP POLICY IF EXISTS "Managers insert clinic memberships" ON public."clinic_memberships";
DROP POLICY IF EXISTS "Users read clinic memberships" ON public."clinic_memberships";
DROP POLICY IF EXISTS "Managers update clinic memberships" ON public."clinic_memberships";
CREATE POLICY "clinic_memberships_select_authenticated_consolidated" ON public."clinic_memberships" FOR SELECT TO authenticated USING ((((user_id = (select auth.uid())) OR (clinic_id = get_user_clinic_id((select auth.uid()))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id))));
CREATE POLICY "clinic_memberships_insert_authenticated_consolidated" ON public."clinic_memberships" FOR INSERT TO authenticated WITH CHECK ((((current_user_can('subaccounts.write'::text, clinic_id) OR current_user_can('subaccounts.manage'::text, clinic_id)) AND (EXISTS ( SELECT 1
   FROM clinics
  WHERE ((clinics.id = clinic_memberships.clinic_id) AND ((clinics.subscription_plan)::text = ANY (ARRAY['clinic'::text, 'enterprise'::text, 'clinica_basico'::text, 'clinica_medio'::text, 'clinica_top'::text, 'prof_top'::text]))))))));
CREATE POLICY "clinic_memberships_update_authenticated_consolidated" ON public."clinic_memberships" FOR UPDATE TO authenticated USING ((current_user_can('subaccounts.manage'::text, clinic_id))) WITH CHECK ((current_user_can('subaccounts.manage'::text, clinic_id)));

-- === clinic_operational_role_capabilities ===
DROP POLICY IF EXISTS "platform owners can manage all clinic operational role capabili" ON public."clinic_operational_role_capabilities";
DROP POLICY IF EXISTS "role capabilities are manageable by role admins" ON public."clinic_operational_role_capabilities";
DROP POLICY IF EXISTS "platform owners can read all clinic operational role capabiliti" ON public."clinic_operational_role_capabilities";
DROP POLICY IF EXISTS "role capabilities are readable by clinic members" ON public."clinic_operational_role_capabilities";
CREATE POLICY "clinic_operational_role_capabilities_select_authenticated_consolidated" ON public."clinic_operational_role_capabilities" FOR SELECT TO authenticated USING ((is_platform_owner((select auth.uid()))) OR (current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid()))) OR (user_has_active_clinic_membership((select auth.uid()), clinic_id)));
CREATE POLICY "clinic_operational_role_capabilities_insert_authenticated_consolidated" ON public."clinic_operational_role_capabilities" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner((select auth.uid()))) OR (current_user_can('subaccounts_roles.manage'::text, clinic_id)));
CREATE POLICY "clinic_operational_role_capabilities_update_authenticated_consolidated" ON public."clinic_operational_role_capabilities" FOR UPDATE TO authenticated USING ((is_platform_owner((select auth.uid()))) OR (current_user_can('subaccounts_roles.manage'::text, clinic_id))) WITH CHECK ((is_platform_owner((select auth.uid()))) OR (current_user_can('subaccounts_roles.manage'::text, clinic_id)));
CREATE POLICY "clinic_operational_role_capabilities_delete_authenticated_consolidated" ON public."clinic_operational_role_capabilities" FOR DELETE TO authenticated USING ((is_platform_owner((select auth.uid()))) OR (current_user_can('subaccounts_roles.manage'::text, clinic_id)));

-- === clinic_operational_roles ===
DROP POLICY IF EXISTS "operational roles are manageable by role admins" ON public."clinic_operational_roles";
DROP POLICY IF EXISTS "platform owners can manage all clinic operational roles" ON public."clinic_operational_roles";
DROP POLICY IF EXISTS "operational roles are readable by clinic members" ON public."clinic_operational_roles";
DROP POLICY IF EXISTS "platform owners can read all clinic operational roles" ON public."clinic_operational_roles";
CREATE POLICY "clinic_operational_roles_select_authenticated_consolidated" ON public."clinic_operational_roles" FOR SELECT TO authenticated USING ((current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid()))) OR (user_has_active_clinic_membership((select auth.uid()), clinic_id)) OR (is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_operational_roles_insert_authenticated_consolidated" ON public."clinic_operational_roles" FOR INSERT TO authenticated WITH CHECK ((current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_operational_roles_update_authenticated_consolidated" ON public."clinic_operational_roles" FOR UPDATE TO authenticated USING ((current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid())))) WITH CHECK ((current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_operational_roles_delete_authenticated_consolidated" ON public."clinic_operational_roles" FOR DELETE TO authenticated USING ((current_user_can('subaccounts_roles.manage'::text, clinic_id)) OR (is_platform_owner((select auth.uid()))));

-- === clinic_subscriptions ===
DROP POLICY IF EXISTS "Owners e gestores podem ver a assinatura" ON public."clinic_subscriptions";
DROP POLICY IF EXISTS "Platform admins podem ver todas as assinaturas" ON public."clinic_subscriptions";
CREATE POLICY "clinic_subscriptions_select_authenticated_consolidated" ON public."clinic_subscriptions" FOR SELECT TO authenticated USING ((((clinic_id = get_user_clinic_id((select auth.uid()))) OR user_has_active_clinic_membership((select auth.uid()), clinic_id) OR current_user_can('subscription_billing.read'::text, clinic_id))) OR ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))));

-- === clinic_tag_relations ===
DROP POLICY IF EXISTS "Platform owners manage clinic_tag_relations" ON public."clinic_tag_relations";
CREATE POLICY "clinic_tag_relations_select_authenticated_consolidated" ON public."clinic_tag_relations" FOR SELECT TO authenticated USING ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tag_relations_insert_authenticated_consolidated" ON public."clinic_tag_relations" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tag_relations_update_authenticated_consolidated" ON public."clinic_tag_relations" FOR UPDATE TO authenticated USING ((is_platform_owner((select auth.uid())))) WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tag_relations_delete_authenticated_consolidated" ON public."clinic_tag_relations" FOR DELETE TO authenticated USING ((is_platform_owner((select auth.uid()))));

-- === clinic_tags ===
DROP POLICY IF EXISTS "Platform owners manage clinic_tags" ON public."clinic_tags";
CREATE POLICY "clinic_tags_select_authenticated_consolidated" ON public."clinic_tags" FOR SELECT TO authenticated USING ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tags_insert_authenticated_consolidated" ON public."clinic_tags" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tags_update_authenticated_consolidated" ON public."clinic_tags" FOR UPDATE TO authenticated USING ((is_platform_owner((select auth.uid())))) WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "clinic_tags_delete_authenticated_consolidated" ON public."clinic_tags" FOR DELETE TO authenticated USING ((is_platform_owner((select auth.uid()))));

-- === clinic_terms ===
DROP POLICY IF EXISTS "Users delete clinic terms" ON public."clinic_terms";
DROP POLICY IF EXISTS "Users insert clinic terms" ON public."clinic_terms";
DROP POLICY IF EXISTS "Users read clinic terms" ON public."clinic_terms";
DROP POLICY IF EXISTS "Users update clinic terms" ON public."clinic_terms";
CREATE POLICY "clinic_terms_select_authenticated_consolidated" ON public."clinic_terms" FOR SELECT TO authenticated USING ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND can_read_clinic_data(clinic_id) AND (current_user_can('patients.read'::text, clinic_id) OR current_user_can('clinic_terms.manage'::text, clinic_id) OR current_user_can('clinic_profile.read'::text, clinic_id)))));
CREATE POLICY "clinic_terms_insert_authenticated_consolidated" ON public."clinic_terms" FOR INSERT TO authenticated WITH CHECK ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('clinic_terms.manage'::text, clinic_id))));
CREATE POLICY "clinic_terms_update_authenticated_consolidated" ON public."clinic_terms" FOR UPDATE TO authenticated USING ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('clinic_terms.manage'::text, clinic_id)))) WITH CHECK ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('clinic_terms.manage'::text, clinic_id))));
CREATE POLICY "clinic_terms_delete_authenticated_consolidated" ON public."clinic_terms" FOR DELETE TO authenticated USING ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('clinic_terms.manage'::text, clinic_id))));

-- === clinical_session_billings ===
DROP POLICY IF EXISTS "Users manage clinic session billings" ON public."clinical_session_billings";
DROP POLICY IF EXISTS "Users read clinic session billings" ON public."clinical_session_billings";
CREATE POLICY "clinical_session_billings_select_authenticated_consolidated" ON public."clinical_session_billings" FOR SELECT TO authenticated USING (((((clinic_id IS NULL) AND (session_id IN ( SELECT sessions.id
   FROM sessions
  WHERE (sessions.user_id = (select auth.uid()))))) OR ((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('treasury.manage'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id))))) OR ((clinic_id IN ( SELECT cm.clinic_id
   FROM clinic_memberships cm
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true))))));
CREATE POLICY "clinical_session_billings_insert_authenticated_consolidated" ON public."clinical_session_billings" FOR INSERT TO authenticated WITH CHECK (((((clinic_id IS NULL) AND (session_id IN ( SELECT sessions.id
   FROM sessions
  WHERE (sessions.user_id = (select auth.uid()))))) OR ((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('treasury.manage'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id))))));
CREATE POLICY "clinical_session_billings_update_authenticated_consolidated" ON public."clinical_session_billings" FOR UPDATE TO authenticated USING (((((clinic_id IS NULL) AND (session_id IN ( SELECT sessions.id
   FROM sessions
  WHERE (sessions.user_id = (select auth.uid()))))) OR ((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('treasury.manage'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id)))))) WITH CHECK (((((clinic_id IS NULL) AND (session_id IN ( SELECT sessions.id
   FROM sessions
  WHERE (sessions.user_id = (select auth.uid()))))) OR ((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('treasury.manage'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id))))));
CREATE POLICY "clinical_session_billings_delete_authenticated_consolidated" ON public."clinical_session_billings" FOR DELETE TO authenticated USING (((((clinic_id IS NULL) AND (session_id IN ( SELECT sessions.id
   FROM sessions
  WHERE (sessions.user_id = (select auth.uid()))))) OR ((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('treasury.manage'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id))))));

-- === clinics ===
DROP POLICY IF EXISTS "Super admins manage all clinics" ON public."clinics";
DROP POLICY IF EXISTS "Platform admins podem ver todas as clinicas" ON public."clinics";
DROP POLICY IF EXISTS "Users read own clinic" ON public."clinics";
DROP POLICY IF EXISTS "Users update managed clinic" ON public."clinics";
CREATE POLICY "clinics_select_authenticated_consolidated" ON public."clinics" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))) OR (((id = get_user_clinic_id((select auth.uid()))) OR user_has_active_clinic_membership((select auth.uid()), id) OR (account_owner_user_id = (select auth.uid())))));
CREATE POLICY "clinics_insert_authenticated_consolidated" ON public."clinics" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY "clinics_update_authenticated_consolidated" ON public."clinics" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (current_user_can('clinic_profile.manage'::text, id))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (current_user_can('clinic_profile.manage'::text, id)));
CREATE POLICY "clinics_delete_authenticated_consolidated" ON public."clinics" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)));

-- === community_form_template_comments ===
DROP POLICY IF EXISTS "Users and admins can delete own comments" ON public."community_form_template_comments";
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public."community_form_template_comments";
DROP POLICY IF EXISTS "Authenticated users can read comments" ON public."community_form_template_comments";
CREATE POLICY "community_form_template_comments_select_authenticated_consolidated" ON public."community_form_template_comments" FOR SELECT TO authenticated USING ((true));
CREATE POLICY "community_form_template_comments_insert_authenticated_consolidated" ON public."community_form_template_comments" FOR INSERT TO authenticated WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "community_form_template_comments_delete_authenticated_consolidated" ON public."community_form_template_comments" FOR DELETE TO authenticated USING ((((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- === community_form_template_likes ===
DROP POLICY IF EXISTS "Authenticated users can remove their own likes" ON public."community_form_template_likes";
DROP POLICY IF EXISTS "Authenticated users can manage their own likes" ON public."community_form_template_likes";
DROP POLICY IF EXISTS "Authenticated users can view template likes" ON public."community_form_template_likes";
CREATE POLICY "community_form_template_likes_select_authenticated_consolidated" ON public."community_form_template_likes" FOR SELECT TO authenticated USING ((true));
CREATE POLICY "community_form_template_likes_insert_authenticated_consolidated" ON public."community_form_template_likes" FOR INSERT TO authenticated WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "community_form_template_likes_delete_authenticated_consolidated" ON public."community_form_template_likes" FOR DELETE TO authenticated USING (((user_id = (select auth.uid()))));

-- === community_form_templates ===
DROP POLICY IF EXISTS "Authors, super admins and platform owners can delete community " ON public."community_form_templates";
DROP POLICY IF EXISTS "Authenticated users can publish community templates" ON public."community_form_templates";
DROP POLICY IF EXISTS "Anyone authenticated can view published community templates" ON public."community_form_templates";
DROP POLICY IF EXISTS "Authors, super admins and platform owners can update community " ON public."community_form_templates";
CREATE POLICY "community_form_templates_select_authenticated_consolidated" ON public."community_form_templates" FOR SELECT TO authenticated USING ((((is_published = true) OR (user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role) OR is_platform_owner((select auth.uid())))));
CREATE POLICY "community_form_templates_insert_authenticated_consolidated" ON public."community_form_templates" FOR INSERT TO authenticated WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "community_form_templates_update_authenticated_consolidated" ON public."community_form_templates" FOR UPDATE TO authenticated USING ((((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role) OR is_platform_owner((select auth.uid()))))) WITH CHECK ((((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role) OR is_platform_owner((select auth.uid())))));
CREATE POLICY "community_form_templates_delete_authenticated_consolidated" ON public."community_form_templates" FOR DELETE TO authenticated USING ((((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role) OR is_platform_owner((select auth.uid())))));

-- === feature_flags ===
DROP POLICY IF EXISTS "Platform owners manage feature flags" ON public."feature_flags";
CREATE POLICY "feature_flags_select_authenticated_consolidated" ON public."feature_flags" FOR SELECT TO authenticated USING ((is_platform_owner_mfa_verified((select auth.uid()))));
CREATE POLICY "feature_flags_insert_authenticated_consolidated" ON public."feature_flags" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner_mfa_verified((select auth.uid()))));
CREATE POLICY "feature_flags_update_authenticated_consolidated" ON public."feature_flags" FOR UPDATE TO authenticated USING ((is_platform_owner_mfa_verified((select auth.uid())))) WITH CHECK ((is_platform_owner_mfa_verified((select auth.uid()))));
CREATE POLICY "feature_flags_delete_authenticated_consolidated" ON public."feature_flags" FOR DELETE TO authenticated USING ((is_platform_owner_mfa_verified((select auth.uid()))));

-- === governance_rules ===
DROP POLICY IF EXISTS "Platform marketing can manage affiliate governance rules" ON public."governance_rules";
DROP POLICY IF EXISTS "Platform owners can manage governance rules" ON public."governance_rules";
DROP POLICY IF EXISTS "Anyone authenticated can view governance rules" ON public."governance_rules";
CREATE POLICY "governance_rules_select_authenticated_consolidated" ON public."governance_rules" FOR SELECT TO authenticated USING ((((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND (key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text])))) OR (is_platform_owner()) OR (true));
CREATE POLICY "governance_rules_insert_authenticated_consolidated" ON public."governance_rules" FOR INSERT TO authenticated WITH CHECK ((((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND (key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text])))) OR (is_platform_owner()));
CREATE POLICY "governance_rules_update_authenticated_consolidated" ON public."governance_rules" FOR UPDATE TO authenticated USING ((((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND (key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text])))) OR (is_platform_owner())) WITH CHECK ((((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND (key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text])))) OR (is_platform_owner()));
CREATE POLICY "governance_rules_delete_authenticated_consolidated" ON public."governance_rules" FOR DELETE TO authenticated USING ((((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND (key = ANY (ARRAY['affiliate_tiers_config'::text, 'affiliate_campaign_config'::text])))) OR (is_platform_owner()));

-- === notification_preferences ===
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public."notification_preferences";
CREATE POLICY "notification_preferences_select_authenticated_consolidated" ON public."notification_preferences" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));
CREATE POLICY "notification_preferences_insert_authenticated_consolidated" ON public."notification_preferences" FOR INSERT TO authenticated WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "notification_preferences_update_authenticated_consolidated" ON public."notification_preferences" FOR UPDATE TO authenticated USING (((user_id = (select auth.uid())))) WITH CHECK (((user_id = (select auth.uid()))));
CREATE POLICY "notification_preferences_delete_authenticated_consolidated" ON public."notification_preferences" FOR DELETE TO authenticated USING (((user_id = (select auth.uid()))));

-- === patient_clinical_snapshots ===
DROP POLICY IF EXISTS "Users write patient_clinical_snapshots" ON public."patient_clinical_snapshots";
DROP POLICY IF EXISTS "Users read patient_clinical_snapshots" ON public."patient_clinical_snapshots";
CREATE POLICY "patient_clinical_snapshots_select_authenticated_consolidated" ON public."patient_clinical_snapshots" FOR SELECT TO authenticated USING (((((select auth.uid()) IS NOT NULL) AND current_user_can('patients.read'::text, clinic_id))));
CREATE POLICY "patient_clinical_snapshots_insert_authenticated_consolidated" ON public."patient_clinical_snapshots" FOR INSERT TO authenticated WITH CHECK (((((select auth.uid()) IS NOT NULL) AND current_user_can('patients.write'::text, clinic_id))));

-- === patient_evolution_groups ===
DROP POLICY IF EXISTS "Super admins manage all evolution groups" ON public."patient_evolution_groups";
DROP POLICY IF EXISTS "Users write clinic evolution groups" ON public."patient_evolution_groups";
DROP POLICY IF EXISTS "Users read clinic evolution groups" ON public."patient_evolution_groups";
CREATE POLICY "patient_evolution_groups_select_authenticated_consolidated" ON public."patient_evolution_groups" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND can_read_clinic_data(clinic_id) AND current_user_can('sessions.read'::text, clinic_id))));
CREATE POLICY "patient_evolution_groups_insert_authenticated_consolidated" ON public."patient_evolution_groups" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))));
CREATE POLICY "patient_evolution_groups_update_authenticated_consolidated" ON public."patient_evolution_groups" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id)))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))));
CREATE POLICY "patient_evolution_groups_delete_authenticated_consolidated" ON public."patient_evolution_groups" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))));

-- === patient_file_uploads ===
DROP POLICY IF EXISTS "Users delete patient file uploads" ON public."patient_file_uploads";
DROP POLICY IF EXISTS "Users insert patient file uploads" ON public."patient_file_uploads";
DROP POLICY IF EXISTS "Users read patient file uploads" ON public."patient_file_uploads";
DROP POLICY IF EXISTS "Users update patient file uploads" ON public."patient_file_uploads";
CREATE POLICY "patient_file_uploads_select_authenticated_consolidated" ON public."patient_file_uploads" FOR SELECT TO authenticated USING ((((clinic_id IS NOT NULL) AND current_user_can('patients.read'::text, clinic_id))));
CREATE POLICY "patient_file_uploads_insert_authenticated_consolidated" ON public."patient_file_uploads" FOR INSERT TO authenticated WITH CHECK ((((uploaded_by_user_id = (select auth.uid())) AND (clinic_id IS NOT NULL) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "patient_file_uploads_update_authenticated_consolidated" ON public."patient_file_uploads" FOR UPDATE TO authenticated USING ((((clinic_id IS NOT NULL) AND current_user_can('patients.write'::text, clinic_id)))) WITH CHECK ((((clinic_id IS NOT NULL) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "patient_file_uploads_delete_authenticated_consolidated" ON public."patient_file_uploads" FOR DELETE TO authenticated USING ((((clinic_id IS NOT NULL) AND (current_user_can('patients.delete'::text, clinic_id) OR current_user_can('patients.write'::text, clinic_id)))));

-- === patient_group_templates ===
DROP POLICY IF EXISTS "Users write clinic patient_group_templates" ON public."patient_group_templates";
DROP POLICY IF EXISTS "Users read clinic patient_group_templates" ON public."patient_group_templates";
CREATE POLICY "patient_group_templates_select_authenticated_consolidated" ON public."patient_group_templates" FOR SELECT TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))) OR (((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.read'::text, clinic_id))));
CREATE POLICY "patient_group_templates_insert_authenticated_consolidated" ON public."patient_group_templates" FOR INSERT TO authenticated WITH CHECK ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "patient_group_templates_update_authenticated_consolidated" ON public."patient_group_templates" FOR UPDATE TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id)))) WITH CHECK ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "patient_group_templates_delete_authenticated_consolidated" ON public."patient_group_templates" FOR DELETE TO authenticated USING ((((clinic_id = get_user_clinic_id(( SELECT auth.uid() AS uid))) AND current_user_can('patients.write'::text, clinic_id))));

-- === patient_groups ===
DROP POLICY IF EXISTS "Super admins manage all patient_groups" ON public."patient_groups";
DROP POLICY IF EXISTS "Users write clinic patient_groups" ON public."patient_groups";
DROP POLICY IF EXISTS "Users read clinic patient_groups" ON public."patient_groups";
CREATE POLICY "patient_groups_select_authenticated_consolidated" ON public."patient_groups" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.manage_groups'::text, clinic_id) OR current_user_can('patient_groups.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id)))) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND can_read_clinic_data(clinic_id) AND (current_user_can('patient_groups.read'::text, clinic_id) OR current_user_can('patients_groups.read'::text, clinic_id) OR current_user_can('patients.read'::text, clinic_id) OR current_user_can('sessions.read'::text, clinic_id)))));
CREATE POLICY "patient_groups_insert_authenticated_consolidated" ON public."patient_groups" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.manage_groups'::text, clinic_id) OR current_user_can('patient_groups.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id)))));
CREATE POLICY "patient_groups_update_authenticated_consolidated" ON public."patient_groups" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.manage_groups'::text, clinic_id) OR current_user_can('patient_groups.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id))))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.manage_groups'::text, clinic_id) OR current_user_can('patient_groups.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id)))));
CREATE POLICY "patient_groups_delete_authenticated_consolidated" ON public."patient_groups" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND (current_user_can('patients.manage_groups'::text, clinic_id) OR current_user_can('patient_groups.write'::text, clinic_id) OR current_user_can('sessions.write'::text, clinic_id)))));

-- === patient_health_insurances ===
DROP POLICY IF EXISTS "patient_health_insurances_all" ON public."patient_health_insurances";
DROP POLICY IF EXISTS "patient_health_insurances_select" ON public."patient_health_insurances";
CREATE POLICY "patient_health_insurances_select_authenticated_consolidated" ON public."patient_health_insurances" FOR SELECT TO authenticated USING (((current_user_can('patients.manage'::text, clinic_id) OR current_user_can('sessions.create'::text, clinic_id))) OR (user_has_active_clinic_membership((select auth.uid()), clinic_id)));
CREATE POLICY "patient_health_insurances_insert_authenticated_consolidated" ON public."patient_health_insurances" FOR INSERT TO authenticated WITH CHECK (((current_user_can('patients.manage'::text, clinic_id) OR current_user_can('sessions.create'::text, clinic_id))));
CREATE POLICY "patient_health_insurances_update_authenticated_consolidated" ON public."patient_health_insurances" FOR UPDATE TO authenticated USING (((current_user_can('patients.manage'::text, clinic_id) OR current_user_can('sessions.create'::text, clinic_id)))) WITH CHECK (((current_user_can('patients.manage'::text, clinic_id) OR current_user_can('sessions.create'::text, clinic_id))));
CREATE POLICY "patient_health_insurances_delete_authenticated_consolidated" ON public."patient_health_insurances" FOR DELETE TO authenticated USING (((current_user_can('patients.manage'::text, clinic_id) OR current_user_can('sessions.create'::text, clinic_id))));

-- === patient_payment_plans ===
DROP POLICY IF EXISTS "Super admins manage all payment plans" ON public."patient_payment_plans";
DROP POLICY IF EXISTS "Users manage clinic payment plans" ON public."patient_payment_plans";
CREATE POLICY "patient_payment_plans_select_authenticated_consolidated" ON public."patient_payment_plans" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((clinic_id = get_user_clinic_id((select auth.uid())))));
CREATE POLICY "patient_payment_plans_insert_authenticated_consolidated" ON public."patient_payment_plans" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((clinic_id = get_user_clinic_id((select auth.uid())))));
CREATE POLICY "patient_payment_plans_update_authenticated_consolidated" ON public."patient_payment_plans" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((clinic_id = get_user_clinic_id((select auth.uid()))))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((clinic_id = get_user_clinic_id((select auth.uid())))));
CREATE POLICY "patient_payment_plans_delete_authenticated_consolidated" ON public."patient_payment_plans" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((clinic_id = get_user_clinic_id((select auth.uid())))));

-- === patient_registration_links ===
DROP POLICY IF EXISTS "Authenticated users can insert registration links" ON public."patient_registration_links";
DROP POLICY IF EXISTS "Authenticated users can view their own registration links" ON public."patient_registration_links";
DROP POLICY IF EXISTS "Authenticated users can update their own registration links" ON public."patient_registration_links";
CREATE POLICY "patient_registration_links_select_authenticated_consolidated" ON public."patient_registration_links" FOR SELECT TO authenticated USING (((created_by = (select auth.uid()))));
CREATE POLICY "patient_registration_links_insert_authenticated_consolidated" ON public."patient_registration_links" FOR INSERT TO authenticated WITH CHECK (((created_by = (select auth.uid()))));
CREATE POLICY "patient_registration_links_update_authenticated_consolidated" ON public."patient_registration_links" FOR UPDATE TO authenticated USING (((created_by = (select auth.uid())))) WITH CHECK (((created_by = (select auth.uid()))));

-- === patients ===
DROP POLICY IF EXISTS "Super admins manage all patients" ON public."patients";
DROP POLICY IF EXISTS "Users delete clinic patients" ON public."patients";
DROP POLICY IF EXISTS "Users write clinic patients" ON public."patients";
DROP POLICY IF EXISTS "Users read clinic patients" ON public."patients";
DROP POLICY IF EXISTS "Users update clinic patients" ON public."patients";
CREATE POLICY "patients_select_authenticated_consolidated" ON public."patients" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((deleted_at IS NULL) AND (clinic_id = COALESCE((NULLIF(((select auth.jwt()) ->> 'active_clinic_id'::text), ''::text))::uuid, get_user_clinic_id((select auth.uid())))) AND can_read_clinic_data(clinic_id) AND current_user_can('patients.read'::text, clinic_id) AND ((NOT is_exclusive) OR is_clinic_owner(clinic_id, (select auth.uid())) OR ((select auth.uid()) = ANY (exclusive_user_ids))))));
CREATE POLICY "patients_insert_authenticated_consolidated" ON public."patients" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('patients.write'::text, clinic_id))));
CREATE POLICY "patients_update_authenticated_consolidated" ON public."patients" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('patients.write'::text, clinic_id) AND ((NOT is_exclusive) OR is_clinic_owner(clinic_id, (select auth.uid())) OR ((select auth.uid()) = ANY (exclusive_user_ids)))))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('patients.write'::text, clinic_id) AND ((NOT is_exclusive) OR is_clinic_owner(clinic_id, (select auth.uid())) OR ((select auth.uid()) = ANY (exclusive_user_ids))))));
CREATE POLICY "patients_delete_authenticated_consolidated" ON public."patients" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('patients.delete'::text, clinic_id) AND ((NOT is_exclusive) OR is_clinic_owner(clinic_id, (select auth.uid())) OR ((select auth.uid()) = ANY (exclusive_user_ids))))));

-- === platform_admins ===
DROP POLICY IF EXISTS "Platform owners read platform admins" ON public."platform_admins";
CREATE POLICY "platform_admins_select_authenticated_consolidated" ON public."platform_admins" FOR SELECT TO authenticated USING (((is_platform_owner_mfa_verified((select auth.uid())) OR (user_id = (select auth.uid())))));

-- === platform_audit_events ===
DROP POLICY IF EXISTS "Platform owners read platform audit" ON public."platform_audit_events";
CREATE POLICY "platform_audit_events_select_authenticated_consolidated" ON public."platform_audit_events" FOR SELECT TO authenticated USING ((is_platform_owner_mfa_verified((select auth.uid()))));

-- === platform_auto_leads ===
DROP POLICY IF EXISTS "Platform admins manage platform_auto_leads" ON public."platform_auto_leads";
DROP POLICY IF EXISTS "Service role full access platform_auto_leads" ON public."platform_auto_leads";
DROP POLICY IF EXISTS "Affiliates read assigned platform_auto_leads" ON public."platform_auto_leads";
DROP POLICY IF EXISTS "Affiliates update assigned platform_auto_leads" ON public."platform_auto_leads";
CREATE POLICY "platform_auto_leads_select_authenticated_consolidated" ON public."platform_auto_leads" FOR SELECT TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR (true) OR (((deleted_at IS NULL) AND (assigned_affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE ((a.user_id = (select auth.uid())) AND (a.deleted_at IS NULL)))))));
CREATE POLICY "platform_auto_leads_insert_authenticated_consolidated" ON public."platform_auto_leads" FOR INSERT TO authenticated WITH CHECK (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR (true));
CREATE POLICY "platform_auto_leads_update_authenticated_consolidated" ON public."platform_auto_leads" FOR UPDATE TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR (true) OR (((deleted_at IS NULL) AND (assigned_affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE ((a.user_id = (select auth.uid())) AND (a.deleted_at IS NULL))))))) WITH CHECK (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR (true) OR ((assigned_affiliate_id IN ( SELECT a.id
   FROM affiliates a
  WHERE ((a.user_id = (select auth.uid())) AND (a.deleted_at IS NULL))))));
CREATE POLICY "platform_auto_leads_delete_authenticated_consolidated" ON public."platform_auto_leads" FOR DELETE TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR (true));

-- === platform_clinic_access_sessions ===
DROP POLICY IF EXISTS "Platform owners read support sessions" ON public."platform_clinic_access_sessions";
CREATE POLICY "platform_clinic_access_sessions_select_authenticated_consolidated" ON public."platform_clinic_access_sessions" FOR SELECT TO authenticated USING (((is_platform_owner_mfa_verified((select auth.uid())) AND (actor_user_id = (select auth.uid())))));

-- === platform_error_logs ===
DROP POLICY IF EXISTS "Anon can insert error logs" ON public."platform_error_logs";
DROP POLICY IF EXISTS "Authenticated users can insert error logs" ON public."platform_error_logs";
DROP POLICY IF EXISTS "Platform admins can view platform error logs" ON public."platform_error_logs";
CREATE POLICY "platform_error_logs_select_authenticated_consolidated" ON public."platform_error_logs" FOR SELECT TO authenticated USING (((is_platform_admin((select auth.uid())) OR is_platform_owner((select auth.uid())))));
CREATE POLICY "platform_error_logs_insert_anon_consolidated" ON public."platform_error_logs" FOR INSERT TO anon WITH CHECK (((user_id IS NULL)));
CREATE POLICY "platform_error_logs_insert_authenticated_consolidated" ON public."platform_error_logs" FOR INSERT TO authenticated WITH CHECK (((((select auth.uid()) IS NULL) OR (user_id = (select auth.uid())))));

-- === platform_feedbacks ===
DROP POLICY IF EXISTS "Platform owner manage feedbacks" ON public."platform_feedbacks";
DROP POLICY IF EXISTS "Authenticated users insert own feedback" ON public."platform_feedbacks";
DROP POLICY IF EXISTS "Users read own feedback" ON public."platform_feedbacks";
CREATE POLICY "platform_feedbacks_select_authenticated_consolidated" ON public."platform_feedbacks" FOR SELECT TO authenticated USING ((is_platform_owner(( SELECT auth.uid() AS uid))) OR (((( SELECT auth.uid() AS uid) = user_id) OR is_platform_owner(( SELECT auth.uid() AS uid)))));
CREATE POLICY "platform_feedbacks_insert_authenticated_consolidated" ON public."platform_feedbacks" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner(( SELECT auth.uid() AS uid))) OR (((( SELECT auth.uid() AS uid) = user_id) OR (user_id IS NULL))));
CREATE POLICY "platform_feedbacks_update_authenticated_consolidated" ON public."platform_feedbacks" FOR UPDATE TO authenticated USING ((is_platform_owner(( SELECT auth.uid() AS uid)))) WITH CHECK ((is_platform_owner(( SELECT auth.uid() AS uid))));
CREATE POLICY "platform_feedbacks_delete_authenticated_consolidated" ON public."platform_feedbacks" FOR DELETE TO authenticated USING ((is_platform_owner(( SELECT auth.uid() AS uid))));

-- === platform_onboarding_meetings ===
DROP POLICY IF EXISTS "Platform admins podem gerenciar platform_onboarding_meetings" ON public."platform_onboarding_meetings";
DROP POLICY IF EXISTS "Service role tem acesso total a platform_onboarding_meetings" ON public."platform_onboarding_meetings";
DROP POLICY IF EXISTS "Usuarios autenticados podem visualizar suas reunioes de onboard" ON public."platform_onboarding_meetings";
CREATE POLICY "platform_onboarding_meetings_select_authenticated_consolidated" ON public."platform_onboarding_meetings" FOR SELECT TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('agenda'::text, ( SELECT auth.uid() AS uid)))) OR (true) OR ((created_by = (select auth.uid()))));
CREATE POLICY "platform_onboarding_meetings_insert_authenticated_consolidated" ON public."platform_onboarding_meetings" FOR INSERT TO authenticated WITH CHECK (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('agenda'::text, ( SELECT auth.uid() AS uid)))) OR (true));
CREATE POLICY "platform_onboarding_meetings_update_authenticated_consolidated" ON public."platform_onboarding_meetings" FOR UPDATE TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('agenda'::text, ( SELECT auth.uid() AS uid)))) OR (true)) WITH CHECK (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('agenda'::text, ( SELECT auth.uid() AS uid)))) OR (true));
CREATE POLICY "platform_onboarding_meetings_delete_authenticated_consolidated" ON public."platform_onboarding_meetings" FOR DELETE TO authenticated USING (((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('agenda'::text, ( SELECT auth.uid() AS uid)))) OR (true));

-- === platform_release_note_items ===
DROP POLICY IF EXISTS "Platform owners manage platform release note items" ON public."platform_release_note_items";
DROP POLICY IF EXISTS "Authenticated users read release note items" ON public."platform_release_note_items";
CREATE POLICY "platform_release_note_items_select_authenticated_consolidated" ON public."platform_release_note_items" FOR SELECT TO authenticated USING ((is_platform_owner((select auth.uid()))) OR ((EXISTS ( SELECT 1
   FROM platform_releases
  WHERE ((platform_releases.id = platform_release_note_items.release_id) AND ((platform_releases.is_active = true) OR is_platform_owner((select auth.uid()))))))));
CREATE POLICY "platform_release_note_items_insert_authenticated_consolidated" ON public."platform_release_note_items" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "platform_release_note_items_update_authenticated_consolidated" ON public."platform_release_note_items" FOR UPDATE TO authenticated USING ((is_platform_owner((select auth.uid())))) WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "platform_release_note_items_delete_authenticated_consolidated" ON public."platform_release_note_items" FOR DELETE TO authenticated USING ((is_platform_owner((select auth.uid()))));

-- === platform_releases ===
DROP POLICY IF EXISTS "Platform owners manage platform releases" ON public."platform_releases";
DROP POLICY IF EXISTS "Authenticated users read platform releases" ON public."platform_releases";
CREATE POLICY "platform_releases_select_authenticated_consolidated" ON public."platform_releases" FOR SELECT TO authenticated USING ((is_platform_owner((select auth.uid()))) OR (((is_active = true) OR is_platform_owner((select auth.uid())))));
CREATE POLICY "platform_releases_insert_authenticated_consolidated" ON public."platform_releases" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "platform_releases_update_authenticated_consolidated" ON public."platform_releases" FOR UPDATE TO authenticated USING ((is_platform_owner((select auth.uid())))) WITH CHECK ((is_platform_owner((select auth.uid()))));
CREATE POLICY "platform_releases_delete_authenticated_consolidated" ON public."platform_releases" FOR DELETE TO authenticated USING ((is_platform_owner((select auth.uid()))));

-- === profiles ===
DROP POLICY IF EXISTS "Super admins manage all profiles" ON public."profiles";
DROP POLICY IF EXISTS "Users can insert own profile" ON public."profiles";
DROP POLICY IF EXISTS "Platform marketing reads affiliate and conversion profiles" ON public."profiles";
DROP POLICY IF EXISTS "Users read clinic profiles" ON public."profiles";
DROP POLICY IF EXISTS "Managers update clinic profiles" ON public."profiles";
DROP POLICY IF EXISTS "Users update own profile" ON public."profiles";
CREATE POLICY "profiles_select_authenticated_consolidated" ON public."profiles" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid))) AND ((EXISTS ( SELECT 1
   FROM affiliates a
  WHERE (a.user_id = profiles.id))) OR (EXISTS ( SELECT 1
   FROM affiliate_conversions ac
  WHERE (ac.customer_user_id = profiles.id))) OR (EXISTS ( SELECT 1
   FROM affiliate_invitations ai
  WHERE (ai.invited_user_id = profiles.id)))))) OR (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR ((clinic_id IS NOT NULL) AND (clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id))) OR (EXISTS ( SELECT 1
   FROM (clinic_memberships requester_membership
     JOIN clinic_memberships target_membership ON ((target_membership.clinic_id = requester_membership.clinic_id)))
  WHERE ((requester_membership.user_id = ( SELECT auth.uid() AS uid)) AND (requester_membership.is_active = true) AND (target_membership.user_id = profiles.id)))))));
CREATE POLICY "profiles_insert_authenticated_consolidated" ON public."profiles" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((id = (select auth.uid()))));
CREATE POLICY "profiles_update_authenticated_consolidated" ON public."profiles" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (current_user_can('subaccounts.manage'::text, clinic_id)) OR ((id = (select auth.uid())))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (current_user_can('subaccounts.manage'::text, clinic_id)) OR ((id = (select auth.uid()))));
CREATE POLICY "profiles_delete_authenticated_consolidated" ON public."profiles" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)));

-- === security_events ===
DROP POLICY IF EXISTS "admins can read clinic security events" ON public."security_events";
DROP POLICY IF EXISTS "users can read own security events" ON public."security_events";
CREATE POLICY "security_events_select_authenticated_consolidated" ON public."security_events" FOR SELECT TO authenticated USING ((((visibility_scope = 'admin'::text) AND (clinic_id = get_user_clinic_id((select auth.uid()))) AND current_user_can('subaccounts.manage'::text, clinic_id))) OR (((actor_user_id = (select auth.uid())) OR (target_user_id = (select auth.uid())))));

-- === session_edit_history ===
DROP POLICY IF EXISTS "Users insert clinic session edit history" ON public."session_edit_history";
DROP POLICY IF EXISTS "Super admins view all session edit history" ON public."session_edit_history";
DROP POLICY IF EXISTS "Users read clinic session edit history" ON public."session_edit_history";
CREATE POLICY "session_edit_history_select_authenticated_consolidated" ON public."session_edit_history" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = get_user_clinic_id((select auth.uid()))) OR (editor_user_id = (select auth.uid())) OR has_role((select auth.uid()), 'super_admin'::app_role))));
CREATE POLICY "session_edit_history_insert_authenticated_consolidated" ON public."session_edit_history" FOR INSERT TO authenticated WITH CHECK ((((editor_user_id = (select auth.uid())) AND ((clinic_id IN ( SELECT cm.clinic_id
   FROM clinic_memberships cm
  WHERE ((cm.user_id = (select auth.uid())) AND (cm.is_active = true)))) OR has_role((select auth.uid()), 'super_admin'::app_role)))));

-- === sessions ===
DROP POLICY IF EXISTS "Super admins manage all sessions" ON public."sessions";
DROP POLICY IF EXISTS "Users delete clinic draft sessions" ON public."sessions";
DROP POLICY IF EXISTS "Users insert clinic sessions" ON public."sessions";
DROP POLICY IF EXISTS "Users read clinic sessions" ON public."sessions";
DROP POLICY IF EXISTS "Users update clinic sessions" ON public."sessions";
CREATE POLICY "sessions_select_authenticated_consolidated" ON public."sessions" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id IN ( SELECT cm.clinic_id
   FROM clinic_memberships cm
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.is_active = true)))) OR has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role))));
CREATE POLICY "sessions_insert_authenticated_consolidated" ON public."sessions" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))));
CREATE POLICY "sessions_update_authenticated_consolidated" ON public."sessions" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id)))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('sessions.write'::text, clinic_id))));
CREATE POLICY "sessions_delete_authenticated_consolidated" ON public."sessions" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR (((clinic_id = ( SELECT get_user_clinic_id(( SELECT auth.uid() AS uid)) AS get_user_clinic_id)) AND (NOT is_clinic_read_only(clinic_id)) AND current_user_can('session.delete_draft'::text, clinic_id) AND (current_user_is_clinic_manager(clinic_id) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM clinic_memberships
  WHERE ((clinic_memberships.clinic_id = sessions.clinic_id) AND (clinic_memberships.user_id = ( SELECT auth.uid() AS uid)) AND (clinic_memberships.is_active = true) AND (clinic_memberships.membership_status = 'active'::membership_status_type)))))))));

-- === subscription_coupons ===
DROP POLICY IF EXISTS "Platform admins possuem controle total dos cupons" ON public."subscription_coupons";
DROP POLICY IF EXISTS "Todos autenticados e anonimos podem consultar cupons ativos" ON public."subscription_coupons";
CREATE POLICY "Anon can read active subscription coupons" ON public."subscription_coupons" FOR SELECT TO anon USING ((is_active = true) AND ((valid_until IS NULL) OR (valid_until >= now())));
CREATE POLICY "Authenticated read active coupons or admin" ON public."subscription_coupons" FOR SELECT TO authenticated USING (((is_active = true) AND ((valid_until IS NULL) OR (valid_until >= now()))) OR ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))));
CREATE POLICY "Platform admins insert subscription coupons" ON public."subscription_coupons" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true)))));
CREATE POLICY "Platform admins update subscription coupons" ON public."subscription_coupons" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true)))));
CREATE POLICY "Platform admins delete subscription coupons" ON public."subscription_coupons" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true)))));

-- === subscription_invoices ===
DROP POLICY IF EXISTS "Owners e gestores podem ver as faturas" ON public."subscription_invoices";
DROP POLICY IF EXISTS "Platform admins podem ver todas as faturas" ON public."subscription_invoices";
CREATE POLICY "subscription_invoices_select_authenticated_consolidated" ON public."subscription_invoices" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM clinic_memberships cm
  WHERE ((cm.clinic_id = subscription_invoices.clinic_id) AND (cm.user_id = (select auth.uid())) AND (cm.is_active = true) AND (cm.membership_status = 'active'::membership_status_type) AND ((cm.account_role = 'account_owner'::account_role_type) OR current_user_can('subscription_billing.read'::text, subscription_invoices.clinic_id)))))) OR ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = (select auth.uid())) AND (pa.is_active = true))))));

-- === team_development_profiles ===
DROP POLICY IF EXISTS "team development readable by clinic admins or self" ON public."team_development_profiles";
CREATE POLICY "team_development_profiles_select_authenticated_consolidated" ON public."team_development_profiles" FOR SELECT TO authenticated USING ((((clinic_id = get_user_clinic_id((select auth.uid()))) AND (current_user_can('subaccounts_analytics.read'::text, clinic_id) OR (user_id = (select auth.uid()))))));

-- === telemetry_events ===
DROP POLICY IF EXISTS "Authenticated users can insert telemetry events" ON public."telemetry_events";
DROP POLICY IF EXISTS "Platform owners can view all telemetry events" ON public."telemetry_events";
CREATE POLICY "telemetry_events_select_authenticated_consolidated" ON public."telemetry_events" FOR SELECT TO authenticated USING ((is_platform_owner()));
CREATE POLICY "telemetry_events_insert_authenticated_consolidated" ON public."telemetry_events" FOR INSERT TO authenticated WITH CHECK ((((user_id = (select auth.uid())) AND ((clinic_id IS NULL) OR (clinic_id IN ( SELECT cm.clinic_id
   FROM clinic_memberships cm
  WHERE ((cm.user_id = (select auth.uid())) AND (cm.is_active = true))))))));

-- === user_active_clinic_contexts ===
DROP POLICY IF EXISTS "Users read own active clinic context" ON public."user_active_clinic_contexts";
CREATE POLICY "user_active_clinic_contexts_select_authenticated_consolidated" ON public."user_active_clinic_contexts" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));

-- === user_governance_overrides ===
DROP POLICY IF EXISTS "Platform owners can manage governance overrides" ON public."user_governance_overrides";
DROP POLICY IF EXISTS "Users can read own overrides" ON public."user_governance_overrides";
CREATE POLICY "user_governance_overrides_select_authenticated_consolidated" ON public."user_governance_overrides" FOR SELECT TO authenticated USING ((is_platform_owner()) OR ((((select auth.uid()) = user_id) OR is_platform_owner())));
CREATE POLICY "user_governance_overrides_insert_authenticated_consolidated" ON public."user_governance_overrides" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner()));
CREATE POLICY "user_governance_overrides_update_authenticated_consolidated" ON public."user_governance_overrides" FOR UPDATE TO authenticated USING ((is_platform_owner())) WITH CHECK ((is_platform_owner()));
CREATE POLICY "user_governance_overrides_delete_authenticated_consolidated" ON public."user_governance_overrides" FOR DELETE TO authenticated USING ((is_platform_owner()));

-- === user_mfa_credentials ===
DROP POLICY IF EXISTS "Users can manage own MFA credentials" ON public."user_mfa_credentials";
DROP POLICY IF EXISTS "Users can only read own MFA credentials" ON public."user_mfa_credentials";
CREATE POLICY "user_mfa_credentials_select_authenticated_consolidated" ON public."user_mfa_credentials" FOR SELECT TO authenticated USING ((((select auth.uid()) = user_id)) OR (((select auth.uid()) = user_id)));
CREATE POLICY "user_mfa_credentials_insert_authenticated_consolidated" ON public."user_mfa_credentials" FOR INSERT TO authenticated WITH CHECK ((((select auth.uid()) = user_id)));
CREATE POLICY "user_mfa_credentials_update_authenticated_consolidated" ON public."user_mfa_credentials" FOR UPDATE TO authenticated USING ((((select auth.uid()) = user_id))) WITH CHECK ((((select auth.uid()) = user_id)));
CREATE POLICY "user_mfa_credentials_delete_authenticated_consolidated" ON public."user_mfa_credentials" FOR DELETE TO authenticated USING ((((select auth.uid()) = user_id)));

-- === user_punishments ===
DROP POLICY IF EXISTS "Platform owners can manage user punishments" ON public."user_punishments";
DROP POLICY IF EXISTS "Users can read own active punishments" ON public."user_punishments";
CREATE POLICY "user_punishments_select_authenticated_consolidated" ON public."user_punishments" FOR SELECT TO authenticated USING ((is_platform_owner()) OR ((((select auth.uid()) = user_id) OR is_platform_owner())));
CREATE POLICY "user_punishments_insert_authenticated_consolidated" ON public."user_punishments" FOR INSERT TO authenticated WITH CHECK ((is_platform_owner()));
CREATE POLICY "user_punishments_update_authenticated_consolidated" ON public."user_punishments" FOR UPDATE TO authenticated USING ((is_platform_owner())) WITH CHECK ((is_platform_owner()));
CREATE POLICY "user_punishments_delete_authenticated_consolidated" ON public."user_punishments" FOR DELETE TO authenticated USING ((is_platform_owner()));

-- === user_release_note_states ===
DROP POLICY IF EXISTS "Users read own release note state" ON public."user_release_note_states";
CREATE POLICY "user_release_note_states_select_authenticated_consolidated" ON public."user_release_note_states" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));

-- === user_roles ===
DROP POLICY IF EXISTS "Super admins manage all roles" ON public."user_roles";
DROP POLICY IF EXISTS "Users read own roles" ON public."user_roles";
CREATE POLICY "user_roles_select_authenticated_consolidated" ON public."user_roles" FOR SELECT TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)) OR ((user_id = (select auth.uid()))));
CREATE POLICY "user_roles_insert_authenticated_consolidated" ON public."user_roles" FOR INSERT TO authenticated WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY "user_roles_update_authenticated_consolidated" ON public."user_roles" FOR UPDATE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role)));
CREATE POLICY "user_roles_delete_authenticated_consolidated" ON public."user_roles" FOR DELETE TO authenticated USING ((has_role((select auth.uid()), 'super_admin'::app_role)));

-- === user_security_sessions ===
DROP POLICY IF EXISTS "users can read own security sessions" ON public."user_security_sessions";
CREATE POLICY "user_security_sessions_select_authenticated_consolidated" ON public."user_security_sessions" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));

-- === user_security_settings ===
DROP POLICY IF EXISTS "users can read own security settings" ON public."user_security_settings";
CREATE POLICY "user_security_settings_select_authenticated_consolidated" ON public."user_security_settings" FOR SELECT TO authenticated USING (((user_id = (select auth.uid()))));

-- === user_telemetry_summaries ===
DROP POLICY IF EXISTS "Users can upsert own summary row" ON public."user_telemetry_summaries";
DROP POLICY IF EXISTS "Platform owners can view all summaries" ON public."user_telemetry_summaries";
CREATE POLICY "user_telemetry_summaries_select_authenticated_consolidated" ON public."user_telemetry_summaries" FOR SELECT TO authenticated USING ((((select auth.uid()) = user_id)) OR (is_platform_owner()));
CREATE POLICY "user_telemetry_summaries_insert_authenticated_consolidated" ON public."user_telemetry_summaries" FOR INSERT TO authenticated WITH CHECK ((((select auth.uid()) = user_id)));
CREATE POLICY "user_telemetry_summaries_update_authenticated_consolidated" ON public."user_telemetry_summaries" FOR UPDATE TO authenticated USING ((((select auth.uid()) = user_id))) WITH CHECK ((((select auth.uid()) = user_id)));
CREATE POLICY "user_telemetry_summaries_delete_authenticated_consolidated" ON public."user_telemetry_summaries" FOR DELETE TO authenticated USING ((((select auth.uid()) = user_id)));

-- === whatsapp_chat_sessions ===
DROP POLICY IF EXISTS "Service role tem acesso total a whatsapp_chat_sessions" ON public."whatsapp_chat_sessions";
DROP POLICY IF EXISTS "Platform admins podem visualizar whatsapp_chat_sessions" ON public."whatsapp_chat_sessions";
DROP POLICY IF EXISTS "Usuarios autenticados podem visualizar sua propria sessao de wh" ON public."whatsapp_chat_sessions";
CREATE POLICY "whatsapp_chat_sessions_select_authenticated_consolidated" ON public."whatsapp_chat_sessions" FOR SELECT TO authenticated USING ((true) OR ((is_platform_owner(( SELECT auth.uid() AS uid)) OR is_platform_marketing(( SELECT auth.uid() AS uid)) OR has_platform_flag('marketing'::text, ( SELECT auth.uid() AS uid)))) OR ((user_id = (select auth.uid()))));
CREATE POLICY "whatsapp_chat_sessions_insert_authenticated_consolidated" ON public."whatsapp_chat_sessions" FOR INSERT TO authenticated WITH CHECK ((true));
CREATE POLICY "whatsapp_chat_sessions_update_authenticated_consolidated" ON public."whatsapp_chat_sessions" FOR UPDATE TO authenticated USING ((true)) WITH CHECK ((true));
CREATE POLICY "whatsapp_chat_sessions_delete_authenticated_consolidated" ON public."whatsapp_chat_sessions" FOR DELETE TO authenticated USING ((true));
