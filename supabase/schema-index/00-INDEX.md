# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (21906 linhas).
> **Regra de Economia de Tokens:** Nunca leia `supabase/schema.sql` inteiro. Consulte este índice ou abra diretamente `supabase/schema-index/domains/<dominio>.sql` ou use `view_file` com `StartLine`/`EndLine` exatos abaixo.

## 📊 Resumo Estrutural
- **Tabelas:** 68 | **Views:** 0 | **RPCs/Funções:** 198 | **Políticas RLS:** 176
- **Overloads detectados (Risco PGRST203):** activate_clinic_free_trial (2x), handle_signup (4x)

## 📁 Arquivos de Domínio (`supabase/schema-index/domains/`)
- `domains/patients.sql` — Pacientes, Prontuário Base & LGPD Menor
- `domains/sessions.sql` — Sessões, Atendimentos, Agenda & Evolução
- `domains/anamnesis_forms.sql` — Formulários, Anamnese, Templates & Biblioteca
- `domains/clinics_rbac.sql` — Clínicas, Colaboradores, Convites & RBAC
- `domains/finance_billing.sql` — Financeiro (_cents), Planos, Assinaturas & Asaas
- `domains/whatsapp_notifications.sql` — WhatsApp Bot, 2FA, Lembretes & Notificações
- `domains/storage_files.sql` — Uploads, Backblaze B2 & Quotas de Arquivos
- `domains/platform_admin.sql` — Platform Master, Feature Flags, Auditoria & Feedbacks
- `domains/core_misc.sql` — Outras estruturas e utilitários

## 📋 Catálogo de Tabelas (com linhas exatas em `supabase/schema.sql`)
| Tabela | Domínio | Linhas (`schema.sql`) | Colunas `_cents` | Soft Delete (`deleted_at`) | Qtd Colunas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `affiliate_commissions` | `core_misc` | `L14788-L14804` | `gross_amount_cents`, `commission_amount_cents`, `pluri_net_cents` | ✅ Sim | 9 |
| `affiliate_conversions` | `core_misc` | `L14826-L14845` | — | ✅ Sim | 6 |
| `affiliate_crm_logs` | `core_misc` | `L14855-L14863` | — | — | 1 |
| `affiliate_invitations` | `core_misc` | `L14873-L14889` | — | ✅ Sim | 5 |
| `affiliates` | `core_misc` | `L14911-L14947` | `lifetime_commission_cents` | ✅ Sim | 14 |
| `agenda_events` | `core_misc` | `L14969-L15052` | — | ✅ Sim | 29 |
| `app_notifications` | `whatsapp_notifications` | `L15058-L15078` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L15084-L15094` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_rbac` | `L15100-L15124` | — | — | 6 |
| `clinic_custom_words` | `clinics_rbac` | `L15130-L15136` | — | — | 1 |
| `clinic_daily_metrics` | `clinics_rbac` | `L15142-L15152` | `revenue_paid_cents`, `revenue_open_cents`, `revenue_credit_cents` | — | 7 |
| `clinic_document_signatures` | `clinics_rbac` | `L15158-L15180` | — | ✅ Sim | 4 |
| `clinic_document_templates` | `anamnesis_forms` | `L15210-L15223` | — | ✅ Sim | 4 |
| `clinic_group_color_slots` | `clinics_rbac` | `L15249-L15260` | — | — | 4 |
| `clinic_health_insurances` | `clinics_rbac` | `L15266-L15279` | — | ✅ Sim | 7 |
| `clinic_insurance_procedures` | `clinics_rbac` | `L15285-L15298` | `session_unit_amount_cents`, `copay_amount_cents` | — | 5 |
| `clinic_memberships` | `clinics_rbac` | `L15304-L15350` | — | — | 14 |
| `clinic_operational_roles` | `clinics_rbac` | `L15358-L15372` | — | — | 4 |
| `clinic_subscriptions` | `clinics_rbac` | `L15380-L15432` | — | — | 27 |
| `clinic_tag_relations` | `clinics_rbac` | `L15438-L15443` | — | — | 1 |
| `clinic_tags` | `clinics_rbac` | `L15449-L15455` | — | — | 2 |
| `clinic_terms` | `clinics_rbac` | `L15461-L15476` | — | — | 5 |
| `clinical_session_billings` | `sessions` | `L15482-L15508` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 7 |
| `clinics` | `clinics_rbac` | `L15514-L15545` | — | — | 10 |
| `community_form_template_comments` | `anamnesis_forms` | `L15567-L15578` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L15584-L15588` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L15594-L15613` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L15619-L15636` | — | — | 4 |
| `global_word_candidates` | `core_misc` | `L15646-L15656` | — | — | 5 |
| `global_word_telemetry` | `platform_admin` | `L15662-L15668` | — | — | 1 |
| `governance_rules` | `platform_admin` | `L15674-L15678` | — | — | 1 |
| `mfa_recovery_challenges` | `whatsapp_notifications` | `L15684-L15698` | — | — | 5 |
| `notification_preferences` | `whatsapp_notifications` | `L4145-L4159` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L15704-L15714` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L15720-L15727` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L15733-L15777` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L15783-L15797` | — | — | 2 |
| `patient_groups` | `patients` | `L15803-L15817` | — | — | 2 |
| `patient_health_insurances` | `patients` | `L15823-L15834` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L15840-L15869` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L15875-L15885` | — | — | 3 |
| `patients` | `patients` | `L15891-L15950` | — | ✅ Sim | 10 |
| `platform_admins` | `anamnesis_forms` | `L15969-L15976` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L15982-L15993` | — | — | 1 |
| `platform_clinic_access_sessions` | `sessions` | `L15999-L16007` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L16013-L16024` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L16030-L16048` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L16054-L16070` | — | — | 4 |
| `platform_release_note_items` | `anamnesis_forms` | `L16080-L16089` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L16095-L16108` | — | — | 5 |
| `profiles` | `clinics_rbac` | `L16114-L16148` | — | — | 8 |
| `security_events` | `core_misc` | `L16182-L16192` | — | — | 1 |
| `session_edit_history` | `sessions` | `L16198-L16209` | — | — | 1 |
| `session_shares` | `sessions` | `L16219-L16230` | — | — | 2 |
| `sessions` | `sessions` | `L16236-L16325` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | ✅ Sim | 31 |
| `subscription_invoices` | `finance_billing` | `L16351-L16387` | — | — | 10 |
| `team_development_profiles` | `clinics_rbac` | `L16401-L16417` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L16423-L16434` | — | — | 1 |
| `user_active_clinic_contexts` | `clinics_rbac` | `L16440-L16444` | — | — | 1 |
| `user_governance_overrides` | `clinics_rbac` | `L16450-L16455` | — | — | 3 |
| `user_mfa_credentials` | `clinics_rbac` | `L16461-L16468` | — | — | 3 |
| `user_punishments` | `clinics_rbac` | `L16474-L16484` | — | — | 4 |
| `user_release_note_states` | `clinics_rbac` | `L16490-L16497` | — | — | 4 |
| `user_roles` | `clinics_rbac` | `L16503-L16507` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L16513-L16529` | — | — | 6 |
| `user_security_settings` | `clinics_rbac` | `L16535-L16544` | — | — | 6 |
| `user_telemetry_summaries` | `clinics_rbac` | `L16550-L16571` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L16577-L16590` | — | — | 6 |

## ⚡ Catálogo de Views
| View | Domínio | Linhas (`schema.sql`) |
| :--- | :--- | :--- |

## 🔧 Catálogo de RPCs e Funções (`public`)
| Função / RPC | Domínio | Linhas (`schema.sql`) | Parâmetros (Resumo) |
| :--- | :--- | :--- | :--- |
| `accept_clinic_collaborator_invitation` | `clinics_rbac` | `L172-L442` | `"_token" "text", "_full_name" "text" DEFAULT NULL::"text"` |
| `accept_current_user_clinic_invitation` | `clinics_rbac` | `L448-L697` | `"_invitation_id" "uuid"` |
| `acknowledge_current_user_release_notes` | `clinics_rbac` | `L703-L762` | `"_release_id" "uuid" DEFAULT NULL::"uuid"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L768-L926` | `"_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L932-L937` | `"_clinic_id" "uuid", "_plan_type" "public"."subscription_plan"` |
| `apply_user_punishment` | `clinics_rbac` | `L943-L984` | `"_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text` |
| `assign_profile_public_code` | `clinics_rbac` | `L990-L1001` | `` |
| `authorize_minor_guardian_consent` | `patients` | `L1007-L1076` | `"_token" "text", "_password" "text", "_consent_data" "jsonb"` |
| `auto_accept_pending_clinic_invitation_for_current_user` | `clinics_rbac` | `L1082-L1266` | `` |
| `batch_sync_push` | `core_misc` | `L1272-L1421` | `"_mutations" "jsonb"` |
| `buy_clinic_subaccount_extra_spaces` | `clinics_rbac` | `L1427-L1510` | `"_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text"` |
| `calculate_affiliate_tier_benefits` | `core_misc` | `L1516-L1727` | `"_active_referrals" integer, "_floor_tier" "text" DEFAULT 'bronze'::"text"` |
| `calculate_community_template_fields_count` | `anamnesis_forms` | `L1737-L1748` | `` |
| `can_insert_session` | `sessions` | `L1754-L1771` | `"_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid"` |
| `can_perform_action` | `anamnesis_forms` | `L1777-L1782` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `can_read_clinic_data` | `clinics_rbac` | `L1788-L1854` | `"_clinic_id" "uuid"` |
| `can_read_session` | `sessions` | `L1860-L1902` | `"_session_id" "uuid"` |
| `can_share_session` | `sessions` | `L1908-L1937` | `"_session_id" "uuid"` |
| `cancel_clinic_collaborator_invitation` | `clinics_rbac` | `L1943-L1991` | `"_invitation_id" "uuid"` |
| `change_clinic_subscription_plan` | `clinics_rbac` | `L1997-L2004` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `check_clinic_hibernation_eligibility` | `clinics_rbac` | `L2010-L2043` | `` |
| `check_clinic_plan_quota` | `clinics_rbac` | `L2049-L2155` | `"p_clinic_id" "uuid", "p_feature_type" "text"` |
| `cleanup_old_telemetry_events` | `platform_admin` | `L2161-L2194` | `"_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer D` |
| `cleanup_user_security_sessions` | `sessions` | `L2200-L2263` | `"_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::` |
| `clear_current_user_notifications` | `clinics_rbac` | `L2269-L2285` | `` |
| `complete_unregistered_cpf_profile` | `clinics_rbac` | `L2291-L2347` | `"_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "d` |
| `confirm_asaas_subscription_payment` | `finance_billing` | `L2353-L2425` | `"_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" ti` |
| `create_clinic_subaccount` | `clinics_rbac` | `L2431-L2607` | `"_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."op` |
| `create_current_user_notification` | `clinics_rbac` | `L2613-L2638` | `"_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "t` |
| `create_due_agenda_reminder_notifications` | `whatsapp_notifications` | `L2644-L2700` | `"_lookahead" interval DEFAULT '00:30:00'::interval` |
| `create_patient_registration_link` | `patients` | `L2706-L2790` | `"_patient_id" "uuid"` |
| `create_user_notification` | `clinics_rbac` | `L2796-L2855` | `"_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_eve` |
| `current_user_can` | `clinics_rbac` | `L2861-L3163` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_can_role_capability` | `clinics_rbac` | `L3169-L3461` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `clinics_rbac` | `L3467-L3472` | `"_clinic_id" "uuid"` |
| `custom_access_token_hook` | `core_misc` | `L3478-L3516` | `"event" "jsonb"` |
| `decline_current_user_clinic_invitation` | `clinics_rbac` | `L3522-L3573` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `clinics_rbac` | `L3579-L3596` | `"_notification_id" "uuid"` |
| `disable_user_totp` | `clinics_rbac` | `L3602-L3636` | `` |
| `end_clinic_user_security_sessions` | `sessions` | `L3642-L3689` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L3695-L3755` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L3761-L3800` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L3806-L3841` | `` |
| `enforce_clinic_membership_integrity` | `clinics_rbac` | `L3847-L3879` | `` |
| `ensure_clinic_patient` | `patients` | `L3885-L4098` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L4104-L4135` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L4165-L4187` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `clinics_rbac` | `L4193-L4247` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `clinics_rbac` | `L4253-L4261` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L4267-L4287` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `expire_outdated_user_punishments` | `clinics_rbac` | `L4293-L4309` | `` |
| `finalize_overdue_agenda_events` | `core_misc` | `L4315-L4427` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L4437-L4452` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `clinics_rbac` | `L4458-L4478` | `` |
| `generate_profile_public_code_for_clinic` | `clinics_rbac` | `L4484-L4491` | `"_clinic_id" "uuid"` |
| `generate_uuidv7` | `core_misc` | `L4497-L4527` | `` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L4533-L4544` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L4550-L4578` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_rbac` | `L4584-L4637` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_rbac` | `L4643-L4758` | `"_token" "text"` |
| `get_clinic_concurrent_access_overview` | `clinics_rbac` | `L4764-L4793` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_dashboard_analytics` | `clinics_rbac` | `L4799-L5282` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `clinics_rbac` | `L5288-L5340` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_rbac` | `L5346-L5410` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_rbac` | `L5416-L5444` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `clinics_rbac` | `L5450-L5460` | `"_clinic_id" "uuid"` |
| `get_clinic_subscription_summary` | `clinics_rbac` | `L5470-L5552` | `"_clinic_id" "uuid"` |
| `get_clinic_trash_items` | `clinics_rbac` | `L5558-L5678` | `"_clinic_id" "uuid", "_entity_type" "text" DEFAULT 'all'::"text"` |
| `get_current_platform_role` | `anamnesis_forms` | `L5684-L5694` | `` |
| `get_current_user_pending_release_notes` | `clinics_rbac` | `L5700-L5827` | `` |
| `get_document_signature_by_token` | `core_misc` | `L5833-L5889` | `"p_token" "text"` |
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
| `get_user_active_governance` | `clinics_rbac` | `L6863-L6880` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `clinics_rbac` | `L6886-L6907` | `"_user_id" "uuid"` |
| `get_user_totp_status` | `clinics_rbac` | `L6913-L6939` | `` |
| `handle_clinic_word_telemetry` | `clinics_rbac` | `L6945-L6997` | `` |
| `handle_personal_signup` | `core_misc` | `L7003-L7246` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_platform_onboarding_meetings_updated_at` | `anamnesis_forms` | `L7252-L7259` | `` |
| `handle_signup` | `core_misc` | `L7265-L7305` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `core_misc` | `L7311-L7387` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L7393-L7479` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L7485-L7618` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_whatsapp_chat_sessions_updated_at` | `sessions` | `L7624-L7631` | `` |
| `has_role` | `clinics_rbac` | `L7637-L7645` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L7651-L7660` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `clinics_rbac` | `L7666-L7917` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_rbac` | `L7923-L7935` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_owner` | `clinics_rbac` | `L7941-L7959` | `"_clinic_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_clinic_read_only` | `clinics_rbac` | `L7965-L8014` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `clinics_rbac` | `L8020-L8042` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L8048-L8058` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L8064-L8075` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L8081-L8087` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `clinics_rbac` | `L8093-L8170` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `clinics_rbac` | `L8176-L8204` | `` |
| `list_current_user_clinics` | `clinics_rbac` | `L8210-L8271` | `` |
| `list_current_user_notification_preferences` | `clinics_rbac` | `L8277-L8303` | `` |
| `list_current_user_notifications` | `clinics_rbac` | `L8309-L8348` | `` |
| `list_feature_flags` | `platform_admin` | `L8354-L8389` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L8395-L8418` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L8424-L8478` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L8484-L8844` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L8850-L8885` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L8891-L8918` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L8924-L8951` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L8957-L9000` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L9006-L9043` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `core_misc` | `L9049-L9145` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L9151-L9243` | `` |
| `manage_clinic_subscription_plan` | `clinics_rbac` | `L9249-L9441` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `move_entity_to_trash` | `core_misc` | `L9447-L9564` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `normalize_patient_name_key` | `patients` | `L9570-L9579` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L9585-L9598` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L9604-L9649` | `` |
| `notify_clinic_collaborator_presence` | `clinics_rbac` | `L9655-L9736` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L9742-L9797` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L9803-L9852` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L9858-L9863` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L9869-L10010` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_affiliate_pyramid_structure` | `core_misc` | `L10016-L10029` | `` |
| `prevent_affiliate_self_referral` | `core_misc` | `L10039-L10071` | `` |
| `prevent_default_patient_group_delete` | `patients` | `L10081-L10097` | `` |
| `pseudonymize_patient_name` | `patients` | `L10103-L10132` | `"_name" "text"` |
| `purge_clinic_trash_bin` | `clinics_rbac` | `L10138-L10254` | `` |
| `purge_expired_operational_data` | `core_misc` | `L10260-L10290` | `` |
| `purge_old_app_notifications` | `whatsapp_notifications` | `L10296-L10310` | `"_retention_days" integer DEFAULT 60` |
| `raise_exception_json` | `core_misc` | `L10316-L10322` | `"_message" "text"` |
| `recalculate_affiliate_tier` | `core_misc` | `L10328-L10448` | `"_affiliate_id" "uuid"` |
| `reconcile_legacy_users_solo_clinic` | `clinics_rbac` | `L10458-L10613` | `` |
| `record_and_validate_asaas_webhook` | `finance_billing` | `L10619-L10667` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `record_asaas_webhook_event` | `finance_billing` | `L10673-L10719` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L10725-L10920` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L10926-L11062` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_rbac` | `L11068-L11169` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L11175-L11209` | `"_phone" "text" DEFAULT NULL::"text"` |
| `respond_affiliate_invitation` | `core_misc` | `L11215-L11334` | `"_invitation_id" "uuid", "_response" "text"` |
| `restore_entity_from_trash` | `core_misc` | `L11344-L11453` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `revoke_clinic_member_access` | `clinics_rbac` | `L11459-L11532` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L11538-L11566` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `clinics_rbac` | `L11572-L11587` | `"_punishment_id" "uuid", "_reason" "text"` |
| `rpc_book_appointment_safe` | `sessions` | `L11593-L11714` | `"_clinic_id" "uuid", "_provider_id" "uuid", "_patient_id" "uuid" DEFAULT NULL::"uuid", "_s` |
| `rpc_get_available_slots` | `core_misc` | `L11724-L11782` | `"_clinic_id" "uuid", "_provider_id" "uuid", "_date" "date"` |
| `sanitize_clinical_free_text` | `clinics_rbac` | `L11792-L11829` | `"_text" "text"` |
| `schedule_patient_appointment` | `patients` | `L11835-L11889` | `"_clinic_id" "uuid", "_patient_id" "uuid", "_title" "text", "_scheduled_for" timestamp wit` |
| `set_clinic_subscriptions_updated_at` | `clinics_rbac` | `L11895-L11902` | `` |
| `set_current_user_active_clinic` | `clinics_rbac` | `L11908-L11930` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `clinics_rbac` | `L11936-L11954` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L11960-L11967` | `` |
| `setup_user_totp` | `clinics_rbac` | `L11973-L12007` | `"_totp_secret" "text"` |
| `share_sessions_with_collaborators` | `sessions` | `L12013-L12095` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L12101-L12125` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L12131-L12191` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_document_signature_by_token` | `core_misc` | `L12197-L12278` | `"p_token" "text", "p_signer_name" "text", "p_signer_cpf" "text", "p_signature_image_url" "` |
| `submit_patient_registration_form` | `patients` | `L12284-L12490` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L12496-L12577` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_billing_to_session` | `sessions` | `L12583-L12612` | `` |
| `sync_clinic_daily_metrics` | `clinics_rbac` | `L12618-L12667` | `` |
| `sync_clinic_limits_from_subscription` | `clinics_rbac` | `L12673-L12721` | `` |
| `sync_payment_plan_used_sessions` | `sessions` | `L12727-L12751` | `` |
| `sync_session_to_billing` | `sessions` | `L12757-L12811` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L12817-L12850` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L12856-L12884` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L12890-L12898` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L12904-L12911` | `` |
| `trg_affiliate_conversions_sync_tier` | `core_misc` | `L12917-L12955` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L12965-L12978` | `` |
| `trg_increment_row_version` | `core_misc` | `L12984-L12991` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L12997-L13007` | `` |
| `trim_user_notifications` | `clinics_rbac` | `L13013-L13030` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `clinics_rbac` | `L13036-L13162` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_rbac` | `L13168-L13212` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_rbac` | `L13218-L13294` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_rbac` | `L13300-L13404` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_rbac` | `L13410-L13526` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `clinics_rbac` | `L13532-L13699` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `clinics_rbac` | `L13705-L13826` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `clinics_rbac` | `L13832-L13859` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_patient_guardian_consent` | `patients` | `L13865-L13914` | `"_patient_id" "uuid", "_consent_payload" "jsonb"` |
| `update_team_development_profile` | `clinics_rbac` | `L13920-L13986` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L13992-L14000` | `` |
| `upsert_current_user_security_settings` | `clinics_rbac` | `L14006-L14059` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L14065-L14252` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_user_telemetry_summary` | `clinics_rbac` | `L14258-L14374` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `clinics_rbac` | `L14380-L14401` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_affiliate_unique_financial_data` | `core_misc` | `L14407-L14440` | `` |
| `validate_subscription_coupon` | `finance_billing` | `L14450-L14732` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `clinics_rbac` | `L14738-L14751` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `core_misc` | `L14757-L14782` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L19385-L19385` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L19469-L19469` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L19576-L19576` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L19620-L19620` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L19389-L19389` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L19473-L19473` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L19580-L19580` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L19624-L19624` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L19103-L19103` | `subaccounts.read`, `subaccounts.write`, `subaccounts.manage` |
| `clinic_daily_metrics` | `Users read clinic daily metrics` | `L19477-L19477` | `treasury.read`, `sessions.read` |
| `clinic_document_signatures` | `Users delete clinic document signatures` | `L19393-L19393` | `clinic_trash.manage`, `patients.delete` |
| `clinic_document_signatures` | `Users insert clinic document signatures` | `L19427-L19427` | `patients.write`, `sessions.write`, `clinic_terms.manage` |
| `clinic_document_signatures` | `Users read clinic document signatures` | `L19481-L19481` | `patients.read`, `sessions.read`, `clinic_terms.manage`, `clinic_trash.manage` |
| `clinic_document_signatures` | `Users update clinic document signatures` | `L19584-L19584` | `patients.write`, `sessions.write`, `clinic_terms.manage` |
| `clinic_document_templates` | `Users delete clinic document templates` | `L19397-L19397` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users insert clinic document templates` | `L19431-L19431` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users read clinic document templates` | `L19485-L19485` | `clinic_terms.manage`, `clinic_trash.manage`, `clinic_profile.manage` |
| `clinic_document_templates` | `Users update clinic document templates` | `L19588-L19588` | `clinic_terms.manage`, `clinic_profile.manage` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L19536-L19536` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L19644-L19644` | `patients.write` |
| `clinic_health_insurances` | `clinic_health_insurances_delete` | `L19712-L19712` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_insert` | `L19716-L19716` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_update` | `L19724-L19724` | `treasury.manage` |
| `clinic_insurance_procedures` | `clinic_insurance_procedures_all` | `L19731-L19731` | `treasury.manage` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L19097-L19099` | `subaccounts.write`, `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L19107-L19107` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L19879-L19879` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L19793-L19793` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L19131-L19131` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L19411-L19411` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L19445-L19445` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L19532-L19532` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L19600-L19600` | `clinic_terms.manage` |
| `clinical_session_billings` | `Users manage clinic session billings` | `L19457-L19461` | `treasury.manage`, `sessions.write` |
| `clinics` | `Users update managed clinic` | `L19604-L19604` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L19568-L19568` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L19648-L19648` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L19489-L19489` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L19628-L19628` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L19419-L19419` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L19449-L19449` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L19564-L19564` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L19616-L19616` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L19497-L19497` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L19632-L19632` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L19501-L19501` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L19636-L19636` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patient_health_insurances` | `patient_health_insurances_all` | `L19819-L19819` | `patients.manage`, `sessions.create` |
| `patients` | `Users delete clinic patients` | `L19407-L19407` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L19505-L19505` | `patients.read` |
| `patients` | `Users update clinic patients` | `L19592-L19592` | `patients.write` |
| `patients` | `Users write clinic patients` | `L19640-L19640` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L19111-L19111` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L19660-L19660` | `subaccounts.manage` |
| `sessions` | `Users delete clinic draft sessions` | `L19401-L19403` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L19441-L19441` | `sessions.write` |
| `sessions` | `Users update clinic sessions` | `L19596-L19596` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L19135-L19137` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L19905-L19905` | `subaccounts_analytics.read` |
