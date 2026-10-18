# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (16258 linhas).
> **Regra de Economia de Tokens:** Nunca leia `supabase/schema.sql` inteiro. Consulte este índice ou abra diretamente `supabase/schema-index/domains/<dominio>.sql` ou use `view_file` com `StartLine`/`EndLine` exatos abaixo.

## 📊 Resumo Estrutural
- **Tabelas:** 54 | **Views:** 0 | **RPCs/Funções:** 156 | **Políticas RLS:** 127
- **Overloads detectados (Risco PGRST203):** activate_clinic_free_trial (2x), handle_signup (4x), list_platform_directory (2x), validate_subscription_coupon (2x)

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
| `agenda_events` | `core_misc` | `L11298-L11321` | — | — | 8 |
| `anamnesis_form_templates` | `anamnesis_forms` | `L11327-L11343` | — | — | 6 |
| `app_notifications` | `whatsapp_notifications` | `L11349-L11369` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L11375-L11385` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_rbac` | `L11391-L11414` | — | — | 6 |
| `clinic_group_color_slots` | `clinics_rbac` | `L11420-L11431` | — | — | 4 |
| `clinic_memberships` | `clinics_rbac` | `L11437-L11451` | — | — | 5 |
| `clinic_operational_role_capabilities` | `clinics_rbac` | `L11457-L11467` | — | — | 3 |
| `clinic_operational_roles` | `clinics_rbac` | `L11475-L11489` | — | — | 4 |
| `clinic_subscriptions` | `clinics_rbac` | `L11497-L11549` | — | — | 27 |
| `clinic_tag_relations` | `clinics_rbac` | `L11555-L11560` | — | — | 1 |
| `clinic_tags` | `clinics_rbac` | `L11566-L11572` | — | — | 2 |
| `clinic_terms` | `clinics_rbac` | `L11578-L11593` | — | — | 5 |
| `clinics` | `clinics_rbac` | `L11599-L11629` | — | — | 9 |
| `community_form_template_comments` | `anamnesis_forms` | `L11635-L11646` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L11652-L11656` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L11662-L11681` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L11687-L11704` | — | — | 4 |
| `governance_rules` | `platform_admin` | `L11710-L11714` | — | — | 1 |
| `notification_preferences` | `whatsapp_notifications` | `L3007-L3021` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L11720-L11730` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L11736-L11743` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L11749-L11793` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L11799-L11813` | — | — | 2 |
| `patient_groups` | `patients` | `L11819-L11833` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L11839-L11863` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L11869-L11879` | — | — | 3 |
| `patients` | `patients` | `L11885-L11936` | — | — | 7 |
| `platform_admins` | `anamnesis_forms` | `L11942-L11949` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L11955-L11966` | — | — | 1 |
| `platform_clinic_access_sessions` | `sessions` | `L11989-L11997` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L11972-L11983` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L12003-L12021` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L16099-L16114` | — | — | 14 |
| `platform_release_note_items` | `anamnesis_forms` | `L12027-L12036` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L12042-L12055` | — | — | 5 |
| `profiles` | `clinics_rbac` | `L12061-L12090` | — | — | 8 |
| `security_events` | `core_misc` | `L12096-L12106` | — | — | 1 |
| `session_edit_history` | `sessions` | `L12112-L12123` | — | — | 1 |
| `session_shares` | `sessions` | `L12129-L12140` | — | — | 2 |
| `sessions` | `sessions` | `L12146-L12191` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 12 |
| `subscription_coupons` | `finance_billing` | `L12197-L12221` | — | — | 9 |
| `subscription_invoices` | `finance_billing` | `L12239-L12275` | — | — | 18 |
| `team_development_profiles` | `clinics_rbac` | `L12281-L12297` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L12303-L12314` | — | — | 1 |
| `user_active_clinic_contexts` | `clinics_rbac` | `L12320-L12324` | — | — | 1 |
| `user_governance_overrides` | `clinics_rbac` | `L12330-L12335` | — | — | 3 |
| `user_punishments` | `clinics_rbac` | `L12341-L12351` | — | — | 4 |
| `user_release_note_states` | `clinics_rbac` | `L12357-L12364` | — | — | 4 |
| `user_roles` | `clinics_rbac` | `L12370-L12374` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L12380-L12396` | — | — | 6 |
| `user_security_settings` | `clinics_rbac` | `L12402-L12411` | — | — | 6 |
| `user_telemetry_summaries` | `clinics_rbac` | `L12417-L12437` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L16057-L16070` | — | — | 12 |

## ⚡ Catálogo de Views
| View | Domínio | Linhas (`schema.sql`) |
| :--- | :--- | :--- |

## 🔧 Catálogo de RPCs e Funções (`public`)
| Função / RPC | Domínio | Linhas (`schema.sql`) | Parâmetros (Resumo) |
| :--- | :--- | :--- | :--- |
| `accept_clinic_collaborator_invitation` | `clinics_rbac` | `L157-L330` | `"_token" "text", "_full_name" "text" DEFAULT NULL::"text"` |
| `accept_current_user_clinic_invitation` | `clinics_rbac` | `L336-L496` | `"_invitation_id" "uuid"` |
| `acknowledge_current_user_release_notes` | `clinics_rbac` | `L662-L721` | `"_release_id" "uuid" DEFAULT NULL::"uuid"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L727-L885` | `"_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L891-L896` | `"_clinic_id" "uuid", "_plan_type" "public"."subscription_plan"` |
| `apply_user_punishment` | `clinics_rbac` | `L902-L943` | `"_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text` |
| `assign_profile_public_code` | `clinics_rbac` | `L949-L960` | `` |
| `auto_accept_pending_clinic_invitation_for_current_user` | `clinics_rbac` | `L502-L656` | `` |
| `buy_clinic_subaccount_extra_spaces` | `clinics_rbac` | `L966-L1049` | `"_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text"` |
| `calculate_community_template_fields_count` | `anamnesis_forms` | `L1055-L1066` | `` |
| `can_insert_session` | `sessions` | `L1072-L1089` | `"_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid"` |
| `can_perform_action` | `anamnesis_forms` | `L1095-L1206` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `can_read_clinic_data` | `clinics_rbac` | `L1212-L1271` | `"_clinic_id" "uuid"` |
| `can_read_session` | `sessions` | `L1277-L1319` | `"_session_id" "uuid"` |
| `can_share_session` | `sessions` | `L1325-L1354` | `"_session_id" "uuid"` |
| `cancel_clinic_collaborator_invitation` | `clinics_rbac` | `L1360-L1408` | `"_invitation_id" "uuid"` |
| `change_clinic_subscription_plan` | `clinics_rbac` | `L7937-L7944` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `check_clinic_plan_quota` | `clinics_rbac` | `L1414-L1514` | `"p_clinic_id" "uuid", "p_feature_type" "text"` |
| `cleanup_old_telemetry_events` | `platform_admin` | `L1520-L1553` | `"_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer D` |
| `cleanup_user_security_sessions` | `sessions` | `L1559-L1622` | `"_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::` |
| `clear_current_user_notifications` | `clinics_rbac` | `L1628-L1644` | `` |
| `complete_unregistered_cpf_profile` | `clinics_rbac` | `L7470-L7524` | `"_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "d` |
| `confirm_asaas_subscription_payment` | `finance_billing` | `L1650-L1713` | `"_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" ti` |
| `create_clinic_subaccount` | `clinics_rbac` | `L1719-L1895` | `"_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."op` |
| `create_current_user_notification` | `clinics_rbac` | `L1901-L1926` | `"_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "t` |
| `create_due_agenda_reminder_notifications` | `whatsapp_notifications` | `L1932-L1988` | `"_lookahead" interval DEFAULT '00:30:00'::interval` |
| `create_patient_registration_link` | `patients` | `L1994-L2078` | `"_patient_id" "uuid"` |
| `create_user_notification` | `clinics_rbac` | `L2084-L2143` | `"_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_eve` |
| `current_user_can` | `clinics_rbac` | `L2149-L2436` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `clinics_rbac` | `L2442-L2447` | `"_clinic_id" "uuid"` |
| `decline_current_user_clinic_invitation` | `clinics_rbac` | `L2453-L2504` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `clinics_rbac` | `L2510-L2527` | `"_notification_id" "uuid"` |
| `end_clinic_user_security_sessions` | `sessions` | `L2533-L2580` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L2586-L2646` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L2652-L2691` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L2697-L2732` | `` |
| `enforce_clinic_membership_integrity` | `clinics_rbac` | `L2738-L2770` | `` |
| `ensure_clinic_patient` | `patients` | `L2776-L2960` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L2966-L2997` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L3027-L3049` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `clinics_rbac` | `L3055-L3109` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `clinics_rbac` | `L3115-L3123` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L3129-L3149` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `finalize_overdue_agenda_events` | `core_misc` | `L3155-L3267` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L3277-L3292` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `clinics_rbac` | `L3298-L3318` | `` |
| `generate_profile_public_code_for_clinic` | `clinics_rbac` | `L3324-L3331` | `"_clinic_id" "uuid"` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L3337-L3348` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L3354-L3382` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_rbac` | `L4122-L4175` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_rbac` | `L3388-L3475` | `"_token" "text"` |
| `get_clinic_dashboard_analytics` | `clinics_rbac` | `L3481-L3964` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `clinics_rbac` | `L3970-L4022` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_rbac` | `L4028-L4082` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_rbac` | `L4088-L4116` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `clinics_rbac` | `L16159-L16165` | `_clinic_id uuid)` |
| `get_clinic_subscription_summary` | `clinics_rbac` | `L4180-L4262` | `"_clinic_id" "uuid"` |
| `get_current_platform_role` | `anamnesis_forms` | `L4398-L4408` | `` |
| `get_current_user_pending_release_notes` | `clinics_rbac` | `L4414-L4541` | `` |
| `get_patient_registration_form` | `patients` | `L4547-L4622` | `"_token" "text", "_password" "text"` |
| `get_personal_professional_sessions_portfolio` | `sessions` | `L5181-L5320` | `"_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" i` |
| `get_platform_clinic_detail` | `anamnesis_forms` | `L4628-L4688` | `"_clinic_id" "uuid"` |
| `get_platform_clinic_detail_by_route_key` | `anamnesis_forms` | `L4694-L4725` | `"_route_key" "text"` |
| `get_platform_clinic_forms_summary_by_route_key` | `anamnesis_forms` | `L4731-L4820` | `"_route_key" "text"` |
| `get_platform_clinic_roles_overview` | `anamnesis_forms` | `L4826-L4898` | `"_clinic_id" "uuid"` |
| `get_platform_dashboard` | `anamnesis_forms` | `L4904-L4962` | `` |
| `get_platform_person_detail` | `anamnesis_forms` | `L4968-L5175` | `"_item_type" "text", "_item_id" "uuid"` |
| `get_session_share_recipients` | `sessions` | `L5326-L5355` | `"_session_id" "uuid"` |
| `get_session_share_summary` | `sessions` | `L5361-L5399` | `"_session_ids" "uuid"[]` |
| `get_user_active_governance` | `clinics_rbac` | `L5405-L5435` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `clinics_rbac` | `L5441-L5462` | `"_user_id" "uuid"` |
| `handle_personal_signup` | `core_misc` | `L5468-L5697` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_signup` | `core_misc` | `L5703-L5743` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `core_misc` | `L5749-L5825` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L5831-L5917` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L5923-L6056` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `has_role` | `clinics_rbac` | `L6062-L6070` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L6076-L6085` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `clinics_rbac` | `L6091-L6268` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_rbac` | `L6274-L6286` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_read_only` | `clinics_rbac` | `L6292-L6344` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `clinics_rbac` | `L6350-L6372` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L6378-L6388` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L6394-L6405` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L6411-L6417` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `clinics_rbac` | `L6423-L6500` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `clinics_rbac` | `L6506-L6533` | `` |
| `list_current_user_clinics` | `clinics_rbac` | `L6539-L6591` | `` |
| `list_current_user_notification_preferences` | `clinics_rbac` | `L6597-L6623` | `` |
| `list_current_user_notifications` | `clinics_rbac` | `L6629-L6668` | `` |
| `list_feature_flags` | `platform_admin` | `L6674-L6709` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L6715-L6738` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L6785-L6839` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L6845-L6850` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_limit" integ` |
| `list_platform_directory` | `anamnesis_forms` | `L6856-L7216` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L6744-L6779` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L7222-L7249` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L7255-L7282` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L7288-L7331` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L10714-L10751` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `core_misc` | `L7530-L7626` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L7632-L7720` | `` |
| `manage_clinic_subscription_plan` | `clinics_rbac` | `L7726-L7931` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `normalize_patient_name_key` | `patients` | `L7950-L7959` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L7965-L7978` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L7984-L8029` | `` |
| `notify_clinic_collaborator_presence` | `clinics_rbac` | `L8035-L8116` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L8122-L8177` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L8183-L8232` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L8238-L8243` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L8249-L8390` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_default_patient_group_delete` | `patients` | `L8396-L8412` | `` |
| `raise_exception_json` | `core_misc` | `L8418-L8424` | `"_message" "text"` |
| `record_asaas_webhook_event` | `finance_billing` | `L8430-L8476` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L8482-L8653` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L7337-L7464` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_rbac` | `L8659-L8748` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L16184-L16189` | `` |
| `revoke_clinic_member_access` | `clinics_rbac` | `L8754-L8827` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L8833-L8861` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `clinics_rbac` | `L8867-L8882` | `"_punishment_id" "uuid", "_reason" "text"` |
| `set_clinic_subscriptions_updated_at` | `clinics_rbac` | `L8888-L8895` | `` |
| `set_current_user_active_clinic` | `clinics_rbac` | `L8901-L8923` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `clinics_rbac` | `L8929-L8947` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L8953-L8960` | `` |
| `share_sessions_with_collaborators` | `sessions` | `L8966-L9048` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L9054-L9078` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L9084-L9144` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_patient_registration_form` | `patients` | `L9150-L9356` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L9362-L9443` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_clinic_limits_from_subscription` | `clinics_rbac` | `L9449-L9497` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L9503-L9536` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L9542-L9570` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L9576-L9584` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L9590-L9597` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L9603-L9616` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L9622-L9632` | `` |
| `trim_user_notifications` | `clinics_rbac` | `L9638-L9655` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `clinics_rbac` | `L4267-L4393` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_rbac` | `L9661-L9705` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_rbac` | `L9711-L9787` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_rbac` | `L9793-L9915` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_rbac` | `L9921-L10037` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `clinics_rbac` | `L10043-L10210` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `clinics_rbac` | `L10216-L10337` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `clinics_rbac` | `L10343-L10370` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_team_development_profile` | `clinics_rbac` | `L10376-L10442` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L10448-L10456` | `` |
| `upsert_current_user_security_settings` | `clinics_rbac` | `L10462-L10515` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L10521-L10708` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_user_telemetry_summary` | `clinics_rbac` | `L10757-L10855` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `clinics_rbac` | `L10861-L10875` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_subscription_coupon` | `finance_billing` | `L10881-L10956` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `validate_subscription_coupon` | `finance_billing` | `L10962-L11242` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `clinics_rbac` | `L11248-L11261` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `core_misc` | `L11267-L11292` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L14279-L14279` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L14337-L14337` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L14426-L14426` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L14462-L14462` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L14283-L14283` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L14341-L14341` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L14430-L14430` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L14466-L14466` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L14093-L14093` | `subaccounts.manage` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L14386-L14386` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L14486-L14486` | `patients.write` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L14087-L14089` | `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L14097-L14097` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L14630-L14630` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L14558-L14558` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L14105-L14107` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L14297-L14297` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L14321-L14321` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L14382-L14382` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L14442-L14442` | `clinic_terms.manage` |
| `clinics` | `Users update managed clinic` | `L14446-L14446` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L14418-L14418` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L14490-L14490` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L14345-L14345` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L14470-L14470` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L14305-L14305` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L14325-L14325` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L14414-L14414` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L14458-L14458` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L14353-L14353` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L14474-L14474` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L14357-L14357` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L14478-L14478` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patients` | `Users delete clinic patients` | `L14293-L14293` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L14361-L14361` | `patients.read` |
| `patients` | `Users update clinic patients` | `L14434-L14434` | `patients.write` |
| `patients` | `Users write clinic patients` | `L14482-L14482` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L14101-L14101` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L14494-L14494` | `subaccounts.manage` |
| `session_edit_history` | `Users insert clinic session edit history` | `L14313-L14313` | `sessions.write` |
| `sessions` | `Users delete clinic draft sessions` | `L14287-L14289` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L14317-L14317` | `sessions.write` |
| `sessions` | `Users read clinic sessions` | `L14378-L14378` | `sessions.read` |
| `sessions` | `Users update clinic sessions` | `L14438-L14438` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L14111-L14113` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L14656-L14656` | `subaccounts_analytics.read` |
