# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (19183 linhas).
> **Regra de Economia de Tokens:** Nunca leia `supabase/schema.sql` inteiro. Consulte este índice ou abra diretamente `supabase/schema-index/domains/<dominio>.sql` ou use `view_file` com `StartLine`/`EndLine` exatos abaixo.

## 📊 Resumo Estrutural
- **Tabelas:** 59 | **Views:** 0 | **RPCs/Funções:** 181 | **Políticas RLS:** 144
- **Overloads detectados (Risco PGRST203):** activate_clinic_free_trial (2x), handle_signup (4x), validate_subscription_coupon (2x)

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
| `agenda_events` | `core_misc` | `L13490-L13518` | — | — | 11 |
| `anamnesis_form_templates` | `anamnesis_forms` | `L13528-L13546` | — | ✅ Sim | 7 |
| `app_notifications` | `whatsapp_notifications` | `L13552-L13572` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L13578-L13588` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_rbac` | `L13594-L13618` | — | — | 6 |
| `clinic_daily_metrics` | `clinics_rbac` | `L13624-L13634` | `revenue_paid_cents`, `revenue_open_cents`, `revenue_credit_cents` | — | 7 |
| `clinic_group_color_slots` | `clinics_rbac` | `L13640-L13651` | — | — | 4 |
| `clinic_health_insurances` | `clinics_rbac` | `L13657-L13670` | — | ✅ Sim | 7 |
| `clinic_insurance_procedures` | `clinics_rbac` | `L13676-L13689` | `session_unit_amount_cents`, `copay_amount_cents` | — | 5 |
| `clinic_memberships` | `clinics_rbac` | `L13695-L13712` | — | — | 5 |
| `clinic_operational_role_capabilities` | `clinics_rbac` | `L13730-L13740` | — | — | 3 |
| `clinic_operational_roles` | `clinics_rbac` | `L13748-L13762` | — | — | 4 |
| `clinic_subscriptions` | `clinics_rbac` | `L13770-L13822` | — | — | 27 |
| `clinic_tag_relations` | `clinics_rbac` | `L13828-L13833` | — | — | 1 |
| `clinic_tags` | `clinics_rbac` | `L13839-L13845` | — | — | 2 |
| `clinic_terms` | `clinics_rbac` | `L13851-L13866` | — | — | 5 |
| `clinical_session_billings` | `sessions` | `L13872-L13898` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 7 |
| `clinics` | `clinics_rbac` | `L13904-L13934` | — | — | 9 |
| `community_form_template_comments` | `anamnesis_forms` | `L13952-L13963` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L13969-L13973` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L13979-L13998` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L14004-L14021` | — | — | 4 |
| `governance_rules` | `platform_admin` | `L14031-L14035` | — | — | 1 |
| `notification_preferences` | `whatsapp_notifications` | `L3890-L3904` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L14041-L14051` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L14057-L14064` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L14070-L14114` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L14120-L14134` | — | — | 2 |
| `patient_groups` | `patients` | `L14140-L14154` | — | — | 2 |
| `patient_health_insurances` | `patients` | `L14160-L14171` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L14177-L14206` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L14212-L14222` | — | — | 3 |
| `patients` | `patients` | `L14228-L14287` | — | ✅ Sim | 10 |
| `platform_admins` | `anamnesis_forms` | `L14306-L14313` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L14319-L14330` | — | — | 1 |
| `platform_clinic_access_sessions` | `sessions` | `L14336-L14344` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L14350-L14361` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L14367-L14385` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L14391-L14407` | — | — | 4 |
| `platform_release_note_items` | `anamnesis_forms` | `L14417-L14426` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L14432-L14445` | — | — | 5 |
| `profiles` | `clinics_rbac` | `L14451-L14484` | — | — | 8 |
| `security_events` | `core_misc` | `L14514-L14524` | — | — | 1 |
| `session_edit_history` | `sessions` | `L14530-L14541` | — | — | 1 |
| `session_shares` | `sessions` | `L14551-L14562` | — | — | 2 |
| `sessions` | `sessions` | `L14568-L14621` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | ✅ Sim | 15 |
| `subscription_coupons` | `finance_billing` | `L14630-L14654` | — | — | 9 |
| `subscription_invoices` | `finance_billing` | `L14672-L14708` | — | — | 10 |
| `team_development_profiles` | `clinics_rbac` | `L14722-L14738` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L14744-L14755` | — | — | 1 |
| `user_active_clinic_contexts` | `clinics_rbac` | `L14761-L14765` | — | — | 1 |
| `user_governance_overrides` | `clinics_rbac` | `L14771-L14776` | — | — | 3 |
| `user_punishments` | `clinics_rbac` | `L14782-L14792` | — | — | 4 |
| `user_release_note_states` | `clinics_rbac` | `L14798-L14805` | — | — | 4 |
| `user_roles` | `clinics_rbac` | `L14811-L14815` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L14821-L14837` | — | — | 6 |
| `user_security_settings` | `clinics_rbac` | `L14843-L14852` | — | — | 6 |
| `user_telemetry_summaries` | `clinics_rbac` | `L14858-L14878` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L14884-L14897` | — | — | 6 |

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
| `calculate_community_template_fields_count` | `anamnesis_forms` | `L1516-L1527` | `` |
| `can_insert_session` | `sessions` | `L1533-L1550` | `"_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid"` |
| `can_perform_action` | `anamnesis_forms` | `L1556-L1561` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `can_read_clinic_data` | `clinics_rbac` | `L1567-L1633` | `"_clinic_id" "uuid"` |
| `can_read_session` | `sessions` | `L1639-L1681` | `"_session_id" "uuid"` |
| `can_share_session` | `sessions` | `L1687-L1716` | `"_session_id" "uuid"` |
| `cancel_clinic_collaborator_invitation` | `clinics_rbac` | `L1722-L1770` | `"_invitation_id" "uuid"` |
| `change_clinic_subscription_plan` | `clinics_rbac` | `L1776-L1783` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `check_clinic_hibernation_eligibility` | `clinics_rbac` | `L1789-L1822` | `` |
| `check_clinic_plan_quota` | `clinics_rbac` | `L1828-L1928` | `"p_clinic_id" "uuid", "p_feature_type" "text"` |
| `cleanup_old_telemetry_events` | `platform_admin` | `L1934-L1967` | `"_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer D` |
| `cleanup_user_security_sessions` | `sessions` | `L1973-L2036` | `"_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::` |
| `clear_current_user_notifications` | `clinics_rbac` | `L2042-L2058` | `` |
| `complete_unregistered_cpf_profile` | `clinics_rbac` | `L2064-L2120` | `"_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "d` |
| `confirm_asaas_subscription_payment` | `finance_billing` | `L2126-L2198` | `"_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" ti` |
| `create_clinic_subaccount` | `clinics_rbac` | `L2204-L2380` | `"_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."op` |
| `create_current_user_notification` | `clinics_rbac` | `L2386-L2411` | `"_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "t` |
| `create_due_agenda_reminder_notifications` | `whatsapp_notifications` | `L2417-L2473` | `"_lookahead" interval DEFAULT '00:30:00'::interval` |
| `create_patient_registration_link` | `patients` | `L2479-L2563` | `"_patient_id" "uuid"` |
| `create_user_notification` | `clinics_rbac` | `L2569-L2628` | `"_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_eve` |
| `current_user_can` | `clinics_rbac` | `L2634-L2929` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_can_role_capability` | `clinics_rbac` | `L2935-L3209` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `clinics_rbac` | `L3215-L3220` | `"_clinic_id" "uuid"` |
| `custom_access_token_hook` | `core_misc` | `L3226-L3264` | `"event" "jsonb"` |
| `decline_current_user_clinic_invitation` | `clinics_rbac` | `L3270-L3321` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `clinics_rbac` | `L3327-L3344` | `"_notification_id" "uuid"` |
| `disable_user_totp` | `clinics_rbac` | `L3350-L3381` | `` |
| `end_clinic_user_security_sessions` | `sessions` | `L3387-L3434` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L3440-L3500` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L3506-L3545` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L3551-L3586` | `` |
| `enforce_clinic_membership_integrity` | `clinics_rbac` | `L3592-L3624` | `` |
| `ensure_clinic_patient` | `patients` | `L3630-L3843` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L3849-L3880` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L3910-L3932` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `clinics_rbac` | `L3938-L3992` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `clinics_rbac` | `L3998-L4006` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L4012-L4032` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `finalize_overdue_agenda_events` | `core_misc` | `L4038-L4150` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L4160-L4175` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `clinics_rbac` | `L4181-L4201` | `` |
| `generate_profile_public_code_for_clinic` | `clinics_rbac` | `L4207-L4214` | `"_clinic_id" "uuid"` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L4220-L4231` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L4237-L4265` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_rbac` | `L4271-L4324` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_rbac` | `L4330-L4445` | `"_token" "text"` |
| `get_clinic_concurrent_access_overview` | `clinics_rbac` | `L4451-L4480` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_dashboard_analytics` | `clinics_rbac` | `L4486-L4969` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `clinics_rbac` | `L4975-L5027` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_rbac` | `L5033-L5097` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_rbac` | `L5103-L5131` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `clinics_rbac` | `L5137-L5147` | `"_clinic_id" "uuid"` |
| `get_clinic_subscription_summary` | `clinics_rbac` | `L5157-L5239` | `"_clinic_id" "uuid"` |
| `get_clinic_trash_items` | `clinics_rbac` | `L5245-L5365` | `"_clinic_id" "uuid", "_entity_type" "text" DEFAULT 'all'::"text"` |
| `get_current_platform_role` | `anamnesis_forms` | `L5371-L5381` | `` |
| `get_current_user_pending_release_notes` | `clinics_rbac` | `L5387-L5514` | `` |
| `get_patient_registration_form` | `patients` | `L5520-L5600` | `"_token" "text", "_password" "text"` |
| `get_personal_portfolio_session_detail` | `sessions` | `L5606-L5705` | `"_session_id" "uuid"` |
| `get_personal_professional_sessions_portfolio` | `sessions` | `L5711-L5850` | `"_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" i` |
| `get_platform_clinic_detail` | `anamnesis_forms` | `L5856-L5916` | `"_clinic_id" "uuid"` |
| `get_platform_clinic_detail_by_route_key` | `anamnesis_forms` | `L5922-L5953` | `"_route_key" "text"` |
| `get_platform_clinic_forms_summary_by_route_key` | `anamnesis_forms` | `L5959-L6048` | `"_route_key" "text"` |
| `get_platform_clinic_roles_overview` | `anamnesis_forms` | `L6054-L6126` | `"_clinic_id" "uuid"` |
| `get_platform_dashboard` | `anamnesis_forms` | `L6132-L6190` | `` |
| `get_platform_person_detail` | `anamnesis_forms` | `L6196-L6403` | `"_item_type" "text", "_item_id" "uuid"` |
| `get_session_share_recipients` | `sessions` | `L6409-L6438` | `"_session_id" "uuid"` |
| `get_session_share_summary` | `sessions` | `L6444-L6482` | `"_session_ids" "uuid"[]` |
| `get_user_active_governance` | `clinics_rbac` | `L6488-L6518` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `clinics_rbac` | `L6524-L6545` | `"_user_id" "uuid"` |
| `get_user_totp_status` | `clinics_rbac` | `L6551-L6577` | `` |
| `handle_personal_signup` | `core_misc` | `L6583-L6826` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_platform_onboarding_meetings_updated_at` | `anamnesis_forms` | `L6832-L6839` | `` |
| `handle_signup` | `core_misc` | `L6845-L6885` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `core_misc` | `L6891-L6967` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L6973-L7059` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L7065-L7198` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_whatsapp_chat_sessions_updated_at` | `sessions` | `L7204-L7211` | `` |
| `has_role` | `clinics_rbac` | `L7217-L7225` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L7231-L7240` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `clinics_rbac` | `L7246-L7497` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_rbac` | `L7503-L7515` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_owner` | `clinics_rbac` | `L7521-L7539` | `"_clinic_id" "uuid", "_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_clinic_read_only` | `clinics_rbac` | `L7545-L7594` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `clinics_rbac` | `L7600-L7622` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L7628-L7638` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L7644-L7655` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L7661-L7667` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `clinics_rbac` | `L7673-L7750` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `clinics_rbac` | `L7756-L7784` | `` |
| `list_current_user_clinics` | `clinics_rbac` | `L7790-L7851` | `` |
| `list_current_user_notification_preferences` | `clinics_rbac` | `L7857-L7883` | `` |
| `list_current_user_notifications` | `clinics_rbac` | `L7889-L7928` | `` |
| `list_feature_flags` | `platform_admin` | `L7934-L7969` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L7975-L7998` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L8004-L8058` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L8064-L8424` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L8430-L8465` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L8471-L8498` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L8504-L8531` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L8537-L8580` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L8586-L8623` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `core_misc` | `L8629-L8725` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L8731-L8823` | `` |
| `manage_clinic_subscription_plan` | `clinics_rbac` | `L8829-L9021` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `move_entity_to_trash` | `core_misc` | `L9027-L9139` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `normalize_patient_name_key` | `patients` | `L9145-L9154` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L9160-L9173` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L9179-L9224` | `` |
| `notify_clinic_collaborator_presence` | `clinics_rbac` | `L9230-L9311` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L9317-L9372` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L9378-L9427` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L9433-L9438` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L9444-L9585` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_default_patient_group_delete` | `patients` | `L9591-L9607` | `` |
| `pseudonymize_patient_name` | `patients` | `L9613-L9642` | `"_name" "text"` |
| `purge_clinic_trash_bin` | `clinics_rbac` | `L9648-L9754` | `` |
| `purge_old_app_notifications` | `whatsapp_notifications` | `L9760-L9774` | `"_retention_days" integer DEFAULT 60` |
| `raise_exception_json` | `core_misc` | `L9780-L9786` | `"_message" "text"` |
| `reconcile_legacy_users_solo_clinic` | `clinics_rbac` | `L9792-L9947` | `` |
| `record_asaas_webhook_event` | `finance_billing` | `L9953-L9999` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L10005-L10176` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L10182-L10318` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_rbac` | `L10324-L10425` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L10431-L10465` | `"_phone" "text" DEFAULT NULL::"text"` |
| `restore_entity_from_trash` | `core_misc` | `L10471-L10575` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `revoke_clinic_member_access` | `clinics_rbac` | `L10581-L10654` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L10660-L10688` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `clinics_rbac` | `L10694-L10709` | `"_punishment_id" "uuid", "_reason" "text"` |
| `sanitize_clinical_free_text` | `clinics_rbac` | `L10715-L10752` | `"_text" "text"` |
| `set_clinic_subscriptions_updated_at` | `clinics_rbac` | `L10758-L10765` | `` |
| `set_current_user_active_clinic` | `clinics_rbac` | `L10771-L10793` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `clinics_rbac` | `L10799-L10817` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L10823-L10830` | `` |
| `setup_user_totp` | `clinics_rbac` | `L10836-L10861` | `"_totp_secret" "text"` |
| `share_sessions_with_collaborators` | `sessions` | `L10867-L10949` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L10955-L10979` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L10985-L11045` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_patient_registration_form` | `patients` | `L11051-L11257` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L11263-L11344` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_clinic_daily_metrics` | `clinics_rbac` | `L11350-L11399` | `` |
| `sync_clinic_limits_from_subscription` | `clinics_rbac` | `L11405-L11453` | `` |
| `sync_payment_plan_used_sessions` | `sessions` | `L11459-L11483` | `` |
| `sync_session_to_billing` | `sessions` | `L11489-L11543` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L11549-L11582` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L11588-L11616` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L11622-L11630` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L11636-L11643` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L11649-L11662` | `` |
| `trg_increment_row_version` | `core_misc` | `L11668-L11675` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L11681-L11691` | `` |
| `trim_user_notifications` | `clinics_rbac` | `L11697-L11714` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `clinics_rbac` | `L11720-L11846` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_rbac` | `L11852-L11896` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_rbac` | `L11902-L11978` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_rbac` | `L11984-L12088` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_rbac` | `L12094-L12210` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `clinics_rbac` | `L12216-L12383` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `clinics_rbac` | `L12389-L12510` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `clinics_rbac` | `L12516-L12543` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_patient_guardian_consent` | `patients` | `L12549-L12598` | `"_patient_id" "uuid", "_consent_payload" "jsonb"` |
| `update_team_development_profile` | `clinics_rbac` | `L12604-L12670` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L12676-L12684` | `` |
| `upsert_current_user_security_settings` | `clinics_rbac` | `L12690-L12743` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L12749-L12936` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_user_telemetry_summary` | `clinics_rbac` | `L12942-L13040` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `clinics_rbac` | `L13046-L13067` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_subscription_coupon` | `finance_billing` | `L13073-L13148` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `validate_subscription_coupon` | `finance_billing` | `L13154-L13434` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `clinics_rbac` | `L13440-L13453` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `core_misc` | `L13459-L13484` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L17098-L17098` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L17164-L17164` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L17263-L17263` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L17299-L17299` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L17102-L17102` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L17168-L17168` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L17267-L17267` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L17303-L17303` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L16892-L16892` | `subaccounts.read`, `subaccounts.write`, `subaccounts.manage` |
| `clinic_daily_metrics` | `Users read clinic daily metrics` | `L17172-L17172` | `treasury.read`, `sessions.read` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L17223-L17223` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L17323-L17323` | `patients.write` |
| `clinic_health_insurances` | `clinic_health_insurances_delete` | `L17367-L17367` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_insert` | `L17371-L17371` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_update` | `L17379-L17379` | `treasury.manage` |
| `clinic_insurance_procedures` | `clinic_insurance_procedures_all` | `L17386-L17386` | `treasury.manage` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L16886-L16888` | `subaccounts.write`, `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L16896-L16896` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L17525-L17525` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L17439-L17439` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L16904-L16904` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L17116-L17116` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L17140-L17140` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L17219-L17219` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L17279-L17279` | `clinic_terms.manage` |
| `clinical_session_billings` | `Users manage clinic session billings` | `L17152-L17156` | `treasury.manage`, `sessions.write` |
| `clinical_session_billings` | `Users read clinic session billings` | `L17203-L17205` | `treasury.read`, `sessions.read` |
| `clinics` | `Users update managed clinic` | `L17283-L17283` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L17255-L17255` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L17327-L17327` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L17176-L17176` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L17307-L17307` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L17124-L17124` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L17144-L17144` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L17251-L17251` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L17295-L17295` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L17184-L17184` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L17311-L17311` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L17188-L17188` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L17315-L17315` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patient_health_insurances` | `patient_health_insurances_all` | `L17465-L17465` | `patients.manage`, `sessions.create` |
| `patients` | `Users delete clinic patients` | `L17112-L17112` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L17192-L17192` | `patients.read` |
| `patients` | `Users update clinic patients` | `L17271-L17271` | `patients.write` |
| `patients` | `Users write clinic patients` | `L17319-L17319` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L16900-L16900` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L17339-L17339` | `subaccounts.manage` |
| `sessions` | `Users delete clinic draft sessions` | `L17106-L17108` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L17136-L17136` | `sessions.write` |
| `sessions` | `Users read clinic sessions` | `L17213-L17215` | `sessions.read` |
| `sessions` | `Users update clinic sessions` | `L17275-L17275` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L16908-L16910` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L17551-L17551` | `subaccounts_analytics.read` |
