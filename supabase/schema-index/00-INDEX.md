# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (22563 linhas).
> **Regra de Economia de Tokens:** Nunca leia `supabase/schema.sql` inteiro. Use `npm run ai:schema -- <tabela_ou_rpc> [--exact]` ou `view_file` com `StartLine`/`EndLine` exatos abaixo.

## 📊 Resumo Estrutural
- **Tabelas:** 71 | **Views:** 0 | **RPCs/Funções:** 203 | **Políticas RLS:** 184
- **Overloads detectados (Risco PGRST203):** activate_clinic_free_trial (2x), handle_signup (4x)

## 📁 Arquivos de Domínio (`supabase/schema-index/domains/`)
- `domains/marketing_affiliates.sql` — Marketing Growth OS, Zap Engine, CrabStudio, Fluxos & Afiliados (35 blocos)
- `domains/agenda_schedule.sql` — Agenda, Eventos, Slots Atômicos, Fuso Horário & Recorrência (13 blocos)
- `domains/patients.sql` — Pacientes, Prontuário Base, Termos & LGPD Menor (61 blocos)
- `domains/sessions.sql` — Sessões, Atendimentos, Evolução SOAP & Condutas (49 blocos)
- `domains/anamnesis_forms.sql` — Formulários, Anamnese, Templates, Biblioteca & Corretor Clínico (81 blocos)
- `domains/finance_billing.sql` — Financeiro (_cents), Planos, Assinaturas, Cupons & Asaas (27 blocos)
- `domains/whatsapp_notifications.sql` — WhatsApp Bot, 2FA/TOTP, Lembretes & Notificações (26 blocos)
- `domains/storage_files.sql` — Uploads, Backblaze B2 & Quotas de Arquivos (18 blocos)
- `domains/platform_admin.sql` — Platform Master, Feature Flags, Auditoria, Telemetria & Feedbacks (34 blocos)
- `domains/rbac_capabilities.sql` — RBAC, Papéis Operacionais & Capabilities (15 blocos)
- `domains/auth_profiles_invitations.sql` — Autenticação, Perfis, Usuários & Convites (31 blocos)
- `domains/clinics_core.sql` — Clínicas, Membros & Configurações da Clínica (52 blocos)
- `domains/core_misc.sql` — Outras estruturas e utilitários (16 blocos)

## 📋 Catálogo de Tabelas (com linhas exatas em `supabase/schema.sql`)
| Tabela | Domínio | Linhas (`schema.sql`) | Colunas `_cents` | Soft Delete (`deleted_at`) | Qtd Colunas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `affiliate_commissions` | `marketing_affiliates` | `L15150-L15166` | `gross_amount_cents`, `commission_amount_cents`, `pluri_net_cents` | ✅ Sim | 9 |
| `affiliate_conversions` | `marketing_affiliates` | `L15188-L15207` | — | ✅ Sim | 6 |
| `affiliate_crm_logs` | `marketing_affiliates` | `L15217-L15225` | — | — | 1 |
| `affiliate_invitations` | `marketing_affiliates` | `L15235-L15251` | — | ✅ Sim | 5 |
| `affiliates` | `marketing_affiliates` | `L15273-L15309` | `lifetime_commission_cents` | ✅ Sim | 14 |
| `agenda_events` | `agenda_schedule` | `L15331-L15414` | — | ✅ Sim | 29 |
| `app_notifications` | `whatsapp_notifications` | `L15420-L15440` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L15446-L15456` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_core` | `L15462-L15486` | — | — | 6 |
| `clinic_custom_words` | `anamnesis_forms` | `L15492-L15498` | — | — | 1 |
| `clinic_daily_metrics` | `finance_billing` | `L15504-L15514` | `revenue_paid_cents`, `revenue_open_cents`, `revenue_credit_cents` | — | 7 |
| `clinic_document_signatures` | `patients` | `L15520-L15542` | — | ✅ Sim | 4 |
| `clinic_document_templates` | `patients` | `L15572-L15585` | — | ✅ Sim | 4 |
| `clinic_group_color_slots` | `agenda_schedule` | `L15611-L15622` | — | — | 4 |
| `clinic_health_insurances` | `clinics_core` | `L15628-L15641` | — | ✅ Sim | 7 |
| `clinic_insurance_procedures` | `clinics_core` | `L15647-L15660` | `session_unit_amount_cents`, `copay_amount_cents` | — | 5 |
| `clinic_memberships` | `clinics_core` | `L15666-L15712` | — | — | 14 |
| `clinic_operational_roles` | `rbac_capabilities` | `L15720-L15734` | — | — | 4 |
| `clinic_subscriptions` | `finance_billing` | `L15742-L15794` | — | — | 27 |
| `clinic_tag_relations` | `platform_admin` | `L15800-L15805` | — | — | 1 |
| `clinic_tags` | `platform_admin` | `L15811-L15817` | — | — | 2 |
| `clinic_terms` | `clinics_core` | `L15823-L15838` | — | — | 5 |
| `clinical_session_billings` | `sessions` | `L15844-L15870` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 7 |
| `clinics` | `clinics_core` | `L15876-L15907` | — | — | 10 |
| `community_form_template_comments` | `anamnesis_forms` | `L15929-L15940` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L15946-L15950` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L15956-L15975` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L15981-L15998` | — | — | 4 |
| `global_word_candidates` | `core_misc` | `L16008-L16018` | — | — | 5 |
| `global_word_telemetry` | `platform_admin` | `L16024-L16030` | — | — | 1 |
| `governance_rules` | `platform_admin` | `L16036-L16040` | — | — | 1 |
| `mfa_recovery_challenges` | `whatsapp_notifications` | `L16046-L16060` | — | — | 5 |
| `notification_preferences` | `whatsapp_notifications` | `L4145-L4159` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L16066-L16076` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L16082-L16089` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L16095-L16139` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L16145-L16159` | — | — | 2 |
| `patient_groups` | `patients` | `L16165-L16179` | — | — | 2 |
| `patient_health_insurances` | `patients` | `L16185-L16196` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L16202-L16231` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L16237-L16247` | — | — | 3 |
| `patients` | `patients` | `L16253-L16312` | — | ✅ Sim | 10 |
| `platform_admins` | `anamnesis_forms` | `L16331-L16338` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L16344-L16355` | — | — | 1 |
| `platform_auto_lead_routines` | `marketing_affiliates` | `L16416-L16441` | — | ✅ Sim | 9 |
| `platform_auto_lead_runs` | `marketing_affiliates` | `L16447-L16466` | — | — | 5 |
| `platform_auto_leads` | `anamnesis_forms` | `L16472-L16524` | — | ✅ Sim | 9 |
| `platform_clinic_access_sessions` | `sessions` | `L16361-L16369` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L16375-L16386` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L16392-L16410` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L16530-L16551` | — | — | 4 |
| `platform_release_note_items` | `anamnesis_forms` | `L16561-L16570` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L16576-L16589` | — | — | 5 |
| `profiles` | `storage_files` | `L16595-L16629` | — | — | 8 |
| `security_events` | `platform_admin` | `L16663-L16673` | — | — | 1 |
| `session_edit_history` | `sessions` | `L16679-L16690` | — | — | 1 |
| `session_shares` | `sessions` | `L16700-L16711` | — | — | 2 |
| `sessions` | `sessions` | `L16717-L16806` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | ✅ Sim | 31 |
| `subscription_invoices` | `finance_billing` | `L16832-L16868` | — | — | 10 |
| `team_development_profiles` | `storage_files` | `L16882-L16898` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L16904-L16915` | — | — | 1 |
| `user_active_clinic_contexts` | `auth_profiles_invitations` | `L16921-L16925` | — | — | 1 |
| `user_governance_overrides` | `platform_admin` | `L16931-L16936` | — | — | 3 |
| `user_mfa_credentials` | `whatsapp_notifications` | `L16942-L16949` | — | — | 3 |
| `user_punishments` | `auth_profiles_invitations` | `L16955-L16965` | — | — | 4 |
| `user_release_note_states` | `platform_admin` | `L16971-L16978` | — | — | 4 |
| `user_roles` | `rbac_capabilities` | `L16984-L16988` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L16994-L17010` | — | — | 6 |
| `user_security_settings` | `auth_profiles_invitations` | `L17016-L17025` | — | — | 6 |
| `user_telemetry_summaries` | `platform_admin` | `L17031-L17052` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L17058-L17071` | — | — | 6 |

## ⚡ Catálogo de Views
| View | Domínio | Linhas (`schema.sql`) |
| :--- | :--- | :--- |

## 🔧 Catálogo de RPCs e Funções (`public`)
| Função / RPC | Domínio | Linhas (`schema.sql`) | Parâmetros (Resumo) |
| :--- | :--- | :--- | :--- |
| `accept_clinic_collaborator_invitation` | `clinics_core` | `L172-L442` | `"_token" "text", "_full_name" "text" DEFAULT NULL::"text"` |
| `accept_current_user_clinic_invitation` | `auth_profiles_invitations` | `L448-L697` | `"_invitation_id" "uuid"` |
| `acknowledge_current_user_release_notes` | `platform_admin` | `L703-L762` | `"_release_id" "uuid" DEFAULT NULL::"uuid"` |
| `activate_clinic_free_trial` | `clinics_core` | `L768-L926` | `"_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `activate_clinic_free_trial` | `clinics_core` | `L932-L937` | `"_clinic_id" "uuid", "_plan_type" "public"."subscription_plan"` |
| `apply_user_punishment` | `auth_profiles_invitations` | `L943-L984` | `"_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text` |
| `assign_profile_public_code` | `storage_files` | `L990-L1001` | `` |
| `authorize_minor_guardian_consent` | `patients` | `L1007-L1076` | `"_token" "text", "_password" "text", "_consent_data" "jsonb"` |
| `auto_accept_pending_clinic_invitation_for_current_user` | `auth_profiles_invitations` | `L1082-L1266` | `` |
| `batch_sync_push` | `core_misc` | `L1272-L1421` | `"_mutations" "jsonb"` |
| `buy_clinic_subaccount_extra_spaces` | `clinics_core` | `L1427-L1510` | `"_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text"` |
| `calculate_affiliate_tier_benefits` | `marketing_affiliates` | `L1516-L1727` | `"_active_referrals" integer, "_floor_tier" "text" DEFAULT 'bronze'::"text"` |
| `calculate_community_template_fields_count` | `anamnesis_forms` | `L1737-L1748` | `` |
| `can_insert_session` | `sessions` | `L1754-L1771` | `"_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid"` |
| `can_perform_action` | `anamnesis_forms` | `L1777-L1782` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `can_read_clinic_data` | `clinics_core` | `L1788-L1854` | `"_clinic_id" "uuid"` |
| `can_read_session` | `sessions` | `L1860-L1902` | `"_session_id" "uuid"` |
| `can_share_session` | `sessions` | `L1908-L1937` | `"_session_id" "uuid"` |
| `cancel_clinic_collaborator_invitation` | `clinics_core` | `L1943-L1991` | `"_invitation_id" "uuid"` |
| `change_clinic_subscription_plan` | `finance_billing` | `L1997-L2004` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `check_clinic_hibernation_eligibility` | `clinics_core` | `L2010-L2043` | `` |
| `check_clinic_plan_quota` | `finance_billing` | `L2049-L2155` | `"p_clinic_id" "uuid", "p_feature_type" "text"` |
| `cleanup_old_telemetry_events` | `platform_admin` | `L2161-L2194` | `"_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer D` |
| `cleanup_user_security_sessions` | `sessions` | `L2200-L2263` | `"_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::` |
| `clear_current_user_notifications` | `whatsapp_notifications` | `L2269-L2285` | `` |
| `complete_unregistered_cpf_profile` | `storage_files` | `L2291-L2347` | `"_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "d` |
| `confirm_asaas_subscription_payment` | `finance_billing` | `L2353-L2425` | `"_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" ti` |
| `create_clinic_subaccount` | `clinics_core` | `L2431-L2607` | `"_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."op` |
| `create_current_user_notification` | `whatsapp_notifications` | `L2613-L2638` | `"_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "t` |
| `create_due_agenda_reminder_notifications` | `agenda_schedule` | `L2644-L2700` | `"_lookahead" interval DEFAULT '00:30:00'::interval` |
| `create_patient_registration_link` | `patients` | `L2706-L2790` | `"_patient_id" "uuid"` |
| `create_user_notification` | `whatsapp_notifications` | `L2796-L2855` | `"_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_eve` |
| `current_user_can` | `rbac_capabilities` | `L2861-L3163` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_can_role_capability` | `rbac_capabilities` | `L3169-L3461` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `auth_profiles_invitations` | `L3467-L3472` | `"_clinic_id" "uuid"` |
| `custom_access_token_hook` | `core_misc` | `L3478-L3516` | `"event" "jsonb"` |
| `decline_current_user_clinic_invitation` | `auth_profiles_invitations` | `L3522-L3573` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `whatsapp_notifications` | `L3579-L3596` | `"_notification_id" "uuid"` |
| `disable_user_totp` | `whatsapp_notifications` | `L3602-L3636` | `` |
| `end_clinic_user_security_sessions` | `sessions` | `L3642-L3689` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L3695-L3755` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L3761-L3800` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L3806-L3841` | `` |
| `enforce_clinic_membership_integrity` | `clinics_core` | `L3847-L3879` | `` |
| `ensure_clinic_patient` | `patients` | `L3885-L4098` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L4104-L4135` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L4165-L4187` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `storage_files` | `L4193-L4247` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `storage_files` | `L4253-L4261` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L4267-L4287` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `expire_outdated_user_punishments` | `auth_profiles_invitations` | `L4293-L4309` | `` |
| `finalize_overdue_agenda_events` | `agenda_schedule` | `L4315-L4427` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L4437-L4452` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `storage_files` | `L4458-L4478` | `` |
| `generate_profile_public_code_for_clinic` | `storage_files` | `L4484-L4491` | `"_clinic_id" "uuid"` |
| `generate_uuidv7` | `core_misc` | `L4497-L4527` | `` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L4533-L4544` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L4550-L4578` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_core` | `L4584-L4637` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_core` | `L4643-L4758` | `"_token" "text"` |
| `get_clinic_concurrent_access_overview` | `clinics_core` | `L4764-L4793` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_dashboard_analytics` | `clinics_core` | `L4799-L5282` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `platform_admin` | `L5288-L5340` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_core` | `L5346-L5410` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_core` | `L5416-L5444` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `storage_files` | `L5450-L5460` | `"_clinic_id" "uuid"` |
| `get_clinic_subscription_summary` | `finance_billing` | `L5470-L5552` | `"_clinic_id" "uuid"` |
| `get_clinic_trash_items` | `clinics_core` | `L5558-L5678` | `"_clinic_id" "uuid", "_entity_type" "text" DEFAULT 'all'::"text"` |
| `get_current_platform_role` | `anamnesis_forms` | `L5684-L5694` | `` |
| `get_current_user_pending_release_notes` | `platform_admin` | `L5700-L5827` | `` |
| `get_document_signature_by_token` | `patients` | `L5833-L5889` | `"p_token" "text"` |
| `get_patient_registration_form` | `patients` | `L5895-L5975` | `"_token" "text", "_password" "text"` |
| `get_personal_portfolio_session_detail` | `sessions` | `L5981-L6080` | `"_session_id" "uuid"` |
| `get_personal_professional_sessions_portfolio` | `sessions` | `L6086-L6225` | `"_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" i` |
| `get_platform_clinic_detail` | `anamnesis_forms` | `L6231-L6291` | `"_clinic_id" "uuid"` |
| `get_platform_clinic_detail_by_route_key` | `anamnesis_forms` | `L6297-L6328` | `"_route_key" "text"` |
| `get_platform_clinic_forms_summary_by_route_key` | `anamnesis_forms` | `L6334-L6423` | `"_route_key" "text"` |
| `get_platform_clinic_roles_overview` | `anamnesis_forms` | `L6429-L6501` | `"_clinic_id" "uuid"` |
| `get_platform_dashboard` | `anamnesis_forms` | `L6507-L6565` | `` |
| `get_platform_person_detail` | `anamnesis_forms` | `L6571-L6778` | `"_item_type" "text", "_item_id" "uuid"` |
| `get_session_share_recipients` | `sessions` | `L6784-L6813` | `"_session_id" "uuid"` |
| `get_session_share_summary` | `sessions` | `L6819-L6857` | `"_session_ids" "uuid"[]` |
| `get_user_active_governance` | `platform_admin` | `L6863-L6880` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `auth_profiles_invitations` | `L6886-L6907` | `"_user_id" "uuid"` |
| `get_user_totp_status` | `whatsapp_notifications` | `L6913-L6939` | `` |
| `handle_clinic_word_telemetry` | `platform_admin` | `L6945-L6997` | `` |
| `handle_personal_signup` | `auth_profiles_invitations` | `L7003-L7246` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_platform_onboarding_meetings_updated_at` | `anamnesis_forms` | `L7252-L7259` | `` |
| `handle_signup` | `auth_profiles_invitations` | `L7627-L7667` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `auth_profiles_invitations` | `L7673-L7749` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `auth_profiles_invitations` | `L7755-L7841` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `auth_profiles_invitations` | `L7847-L7980` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_whatsapp_chat_sessions_updated_at` | `sessions` | `L7986-L7993` | `` |
| `has_role` | `rbac_capabilities` | `L7999-L8007` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L8013-L8022` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `auth_profiles_invitations` | `L8028-L8279` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_core` | `L8285-L8297` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_owner` | `clinics_core` | `L8303-L8321` | `"_clinic_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_clinic_read_only` | `clinics_core` | `L8327-L8376` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `finance_billing` | `L8382-L8404` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L8410-L8420` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L8426-L8437` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L8443-L8449` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `auth_profiles_invitations` | `L8455-L8532` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `auth_profiles_invitations` | `L8538-L8566` | `` |
| `list_current_user_clinics` | `auth_profiles_invitations` | `L8572-L8633` | `` |
| `list_current_user_notification_preferences` | `whatsapp_notifications` | `L8639-L8665` | `` |
| `list_current_user_notifications` | `whatsapp_notifications` | `L8671-L8710` | `` |
| `list_feature_flags` | `platform_admin` | `L8716-L8751` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L8757-L8780` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L8786-L8840` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L8846-L9206` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L9212-L9247` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L9253-L9280` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L9286-L9313` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L9319-L9362` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L9368-L9405` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `platform_admin` | `L9411-L9507` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L9513-L9605` | `` |
| `manage_clinic_subscription_plan` | `finance_billing` | `L9611-L9803` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `move_entity_to_trash` | `core_misc` | `L9809-L9926` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `normalize_br_phone_key` | `core_misc` | `L7265-L7284` | `"p_phone" "text"` |
| `normalize_patient_name_key` | `patients` | `L9932-L9941` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L9947-L9960` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L9966-L10011` | `` |
| `notify_clinic_collaborator_presence` | `clinics_core` | `L10017-L10098` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L10104-L10159` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L10165-L10214` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L10220-L10225` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L10231-L10372` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_affiliate_pyramid_structure` | `marketing_affiliates` | `L10378-L10391` | `` |
| `prevent_affiliate_self_referral` | `marketing_affiliates` | `L10401-L10433` | `` |
| `prevent_default_patient_group_delete` | `patients` | `L10443-L10459` | `` |
| `pseudonymize_patient_name` | `patients` | `L10465-L10494` | `"_name" "text"` |
| `purge_clinic_trash_bin` | `clinics_core` | `L10500-L10616` | `` |
| `purge_expired_operational_data` | `core_misc` | `L10622-L10652` | `` |
| `purge_old_app_notifications` | `whatsapp_notifications` | `L10658-L10672` | `"_retention_days" integer DEFAULT 60` |
| `raise_exception_json` | `core_misc` | `L10678-L10684` | `"_message" "text"` |
| `recalculate_affiliate_tier` | `marketing_affiliates` | `L10690-L10810` | `"_affiliate_id" "uuid"` |
| `reconcile_legacy_users_solo_clinic` | `auth_profiles_invitations` | `L10820-L10975` | `` |
| `record_and_validate_asaas_webhook` | `finance_billing` | `L10981-L11029` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `record_asaas_webhook_event` | `finance_billing` | `L11035-L11081` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L11087-L11282` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L11288-L11424` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_core` | `L11430-L11531` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L11537-L11571` | `"_phone" "text" DEFAULT NULL::"text"` |
| `respond_affiliate_invitation` | `marketing_affiliates` | `L11577-L11696` | `"_invitation_id" "uuid", "_response" "text"` |
| `restore_entity_from_trash` | `core_misc` | `L11706-L11815` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `revoke_clinic_member_access` | `clinics_core` | `L11821-L11894` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L11900-L11928` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `auth_profiles_invitations` | `L11934-L11949` | `"_punishment_id" "uuid", "_reason" "text"` |
| `rpc_book_appointment_safe` | `sessions` | `L11955-L12076` | `"_clinic_id" "uuid", "_provider_id" "uuid", "_patient_id" "uuid" DEFAULT NULL::"uuid", "_s` |
| `rpc_get_available_slots` | `agenda_schedule` | `L12086-L12144` | `"_clinic_id" "uuid", "_provider_id" "uuid", "_date" "date"` |
| `sanitize_clinical_free_text` | `clinics_core` | `L12154-L12191` | `"_text" "text"` |
| `schedule_patient_appointment` | `agenda_schedule` | `L12197-L12251` | `"_clinic_id" "uuid", "_patient_id" "uuid", "_title" "text", "_scheduled_for" timestamp wit` |
| `set_clinic_subscriptions_updated_at` | `finance_billing` | `L12257-L12264` | `` |
| `set_current_user_active_clinic` | `auth_profiles_invitations` | `L12270-L12292` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `auth_profiles_invitations` | `L12298-L12316` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L12322-L12329` | `` |
| `setup_user_totp` | `whatsapp_notifications` | `L12335-L12369` | `"_totp_secret" "text"` |
| `share_sessions_with_collaborators` | `sessions` | `L12375-L12457` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L12463-L12487` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L12493-L12553` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_document_signature_by_token` | `patients` | `L12559-L12640` | `"p_token" "text", "p_signer_name" "text", "p_signer_cpf" "text", "p_signature_image_url" "` |
| `submit_patient_registration_form` | `patients` | `L12646-L12852` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L12858-L12939` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_auto_lead_before_write` | `marketing_affiliates` | `L7290-L7368` | `` |
| `sync_billing_to_session` | `sessions` | `L12945-L12974` | `` |
| `sync_clinic_daily_metrics` | `finance_billing` | `L12980-L13029` | `` |
| `sync_clinic_limits_from_subscription` | `finance_billing` | `L13035-L13083` | `` |
| `sync_meeting_to_auto_leads` | `core_misc` | `L7374-L7422` | `` |
| `sync_payment_plan_used_sessions` | `sessions` | `L13089-L13113` | `` |
| `sync_session_to_billing` | `sessions` | `L13119-L13173` | `` |
| `sync_whatsapp_session_to_auto_leads` | `sessions` | `L7428-L7465` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L13179-L13212` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L13218-L13246` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L13252-L13260` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L13266-L13273` | `` |
| `trg_affiliate_conversions_sync_tier` | `marketing_affiliates` | `L13279-L13317` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L13327-L13340` | `` |
| `trg_increment_row_version` | `core_misc` | `L13346-L13353` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L13359-L13369` | `` |
| `trim_user_notifications` | `whatsapp_notifications` | `L13375-L13392` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `finance_billing` | `L13398-L13524` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_core` | `L13530-L13574` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_core` | `L13580-L13656` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_core` | `L13662-L13766` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_core` | `L13772-L13888` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `storage_files` | `L13894-L14061` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `storage_files` | `L14067-L14188` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `whatsapp_notifications` | `L14194-L14221` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_patient_guardian_consent` | `patients` | `L14227-L14276` | `"_patient_id" "uuid", "_consent_payload" "jsonb"` |
| `update_team_development_profile` | `storage_files` | `L14282-L14348` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L14354-L14362` | `` |
| `upsert_current_user_security_settings` | `auth_profiles_invitations` | `L14368-L14421` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L14427-L14614` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_platform_auto_leads_batch` | `anamnesis_forms` | `L7471-L7621` | `"p_leads" "jsonb", "p_run_id" "uuid" DEFAULT NULL::"uuid", "p_routine_id" "uuid" DEFAULT N` |
| `upsert_user_telemetry_summary` | `platform_admin` | `L14620-L14736` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `auth_profiles_invitations` | `L14742-L14763` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_affiliate_unique_financial_data` | `marketing_affiliates` | `L14769-L14802` | `` |
| `validate_subscription_coupon` | `finance_billing` | `L14812-L15094` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `auth_profiles_invitations` | `L15100-L15113` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `auth_profiles_invitations` | `L15119-L15144` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L20008-L20008` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L20092-L20092` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L20199-L20199` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L20243-L20243` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L20012-L20012` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L20096-L20096` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L20203-L20203` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L20247-L20247` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L19688-L19688` | `subaccounts.read`, `subaccounts.write`, `subaccounts.manage` |
| `clinic_daily_metrics` | `Users read clinic daily metrics` | `L20100-L20100` | `treasury.read`, `sessions.read` |
| `clinic_document_signatures` | `Users delete clinic document signatures` | `L20016-L20016` | `clinic_trash.manage`, `patients.delete` |
| `clinic_document_signatures` | `Users insert clinic document signatures` | `L20050-L20050` | `patients.write`, `sessions.write`, `clinic_terms.manage` |
| `clinic_document_signatures` | `Users read clinic document signatures` | `L20104-L20104` | `patients.read`, `sessions.read`, `clinic_terms.manage`, `clinic_trash.manage` |
| `clinic_document_signatures` | `Users update clinic document signatures` | `L20207-L20207` | `patients.write`, `sessions.write`, `clinic_terms.manage` |
| `clinic_document_templates` | `Users delete clinic document templates` | `L20020-L20020` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users insert clinic document templates` | `L20054-L20054` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users read clinic document templates` | `L20108-L20108` | `clinic_terms.manage`, `clinic_trash.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users update clinic document templates` | `L20211-L20211` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L20159-L20159` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L20267-L20267` | `patients.write` |
| `clinic_health_insurances` | `clinic_health_insurances_delete` | `L20335-L20335` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_insert` | `L20339-L20339` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_update` | `L20347-L20347` | `treasury.manage` |
| `clinic_insurance_procedures` | `clinic_insurance_procedures_all` | `L20354-L20354` | `treasury.manage` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L19682-L19684` | `subaccounts.write`, `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L19692-L19692` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L20511-L20511` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L20416-L20416` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L19716-L19716` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L20034-L20034` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L20068-L20068` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L20155-L20155` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L20223-L20223` | `clinic_terms.manage` |
| `clinical_session_billings` | `Users manage clinic session billings` | `L20080-L20084` | `treasury.manage`, `sessions.write` |
| `clinics` | `Users update managed clinic` | `L20227-L20227` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L20191-L20191` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L20271-L20271` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L20112-L20112` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L20251-L20251` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L20042-L20042` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L20072-L20072` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L20187-L20187` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L20239-L20239` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L20120-L20120` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L20255-L20255` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L20124-L20124` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L20259-L20259` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patient_health_insurances` | `patient_health_insurances_all` | `L20442-L20442` | `patients.manage`, `sessions.create` |
| `patients` | `Users delete clinic patients` | `L20030-L20030` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L20128-L20128` | `patients.read` |
| `patients` | `Users update clinic patients` | `L20215-L20215` | `patients.write` |
| `patients` | `Users write clinic patients` | `L20263-L20263` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L19696-L19696` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L20283-L20283` | `subaccounts.manage` |
| `sessions` | `Users delete clinic draft sessions` | `L20024-L20026` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L20064-L20064` | `sessions.write` |
| `sessions` | `Users update clinic sessions` | `L20219-L20219` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L19720-L19722` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L20537-L20537` | `subaccounts_analytics.read` |
