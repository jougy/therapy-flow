# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (19134 linhas).
> **Regra de Economia de Tokens:** Nunca leia `supabase/schema.sql` inteiro. Consulte este índice ou abra diretamente `supabase/schema-index/domains/<dominio>.sql` ou use `view_file` com `StartLine`/`EndLine` exatos abaixo.

## 📊 Resumo Estrutural
- **Tabelas:** 59 | **Views:** 0 | **RPCs/Funções:** 180 | **Políticas RLS:** 144
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
| `agenda_events` | `core_misc` | `L13461-L13485` | — | — | 9 |
| `anamnesis_form_templates` | `anamnesis_forms` | `L13495-L13513` | — | ✅ Sim | 7 |
| `app_notifications` | `whatsapp_notifications` | `L13519-L13539` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L13545-L13555` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_rbac` | `L13561-L13585` | — | — | 6 |
| `clinic_daily_metrics` | `clinics_rbac` | `L13591-L13601` | `revenue_paid_cents`, `revenue_open_cents`, `revenue_credit_cents` | — | 7 |
| `clinic_group_color_slots` | `clinics_rbac` | `L13607-L13618` | — | — | 4 |
| `clinic_health_insurances` | `clinics_rbac` | `L13624-L13637` | — | ✅ Sim | 7 |
| `clinic_insurance_procedures` | `clinics_rbac` | `L13643-L13656` | `session_unit_amount_cents`, `copay_amount_cents` | — | 5 |
| `clinic_memberships` | `clinics_rbac` | `L13662-L13679` | — | — | 5 |
| `clinic_operational_role_capabilities` | `clinics_rbac` | `L13697-L13707` | — | — | 3 |
| `clinic_operational_roles` | `clinics_rbac` | `L13715-L13729` | — | — | 4 |
| `clinic_subscriptions` | `clinics_rbac` | `L13737-L13789` | — | — | 27 |
| `clinic_tag_relations` | `clinics_rbac` | `L13795-L13800` | — | — | 1 |
| `clinic_tags` | `clinics_rbac` | `L13806-L13812` | — | — | 2 |
| `clinic_terms` | `clinics_rbac` | `L13818-L13833` | — | — | 5 |
| `clinical_session_billings` | `sessions` | `L13839-L13865` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 7 |
| `clinics` | `clinics_rbac` | `L13871-L13901` | — | — | 9 |
| `community_form_template_comments` | `anamnesis_forms` | `L13919-L13930` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L13936-L13940` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L13946-L13965` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L13971-L13988` | — | — | 4 |
| `governance_rules` | `platform_admin` | `L13998-L14002` | — | — | 1 |
| `notification_preferences` | `whatsapp_notifications` | `L3885-L3899` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L14008-L14018` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L14024-L14031` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L14037-L14081` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L14087-L14101` | — | — | 2 |
| `patient_groups` | `patients` | `L14107-L14121` | — | — | 2 |
| `patient_health_insurances` | `patients` | `L14127-L14138` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L14144-L14173` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L14179-L14189` | — | — | 3 |
| `patients` | `patients` | `L14195-L14252` | — | ✅ Sim | 9 |
| `platform_admins` | `anamnesis_forms` | `L14271-L14278` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L14284-L14295` | — | — | 1 |
| `platform_clinic_access_sessions` | `sessions` | `L14301-L14309` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L14315-L14326` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L14332-L14350` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L14356-L14372` | — | — | 4 |
| `platform_release_note_items` | `anamnesis_forms` | `L14382-L14391` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L14397-L14410` | — | — | 5 |
| `profiles` | `clinics_rbac` | `L14416-L14449` | — | — | 8 |
| `security_events` | `core_misc` | `L14479-L14489` | — | — | 1 |
| `session_edit_history` | `sessions` | `L14495-L14506` | — | — | 1 |
| `session_shares` | `sessions` | `L14516-L14527` | — | — | 2 |
| `sessions` | `sessions` | `L14533-L14586` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | ✅ Sim | 15 |
| `subscription_coupons` | `finance_billing` | `L14595-L14619` | — | — | 9 |
| `subscription_invoices` | `finance_billing` | `L14637-L14673` | — | — | 10 |
| `team_development_profiles` | `clinics_rbac` | `L14687-L14703` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L14709-L14720` | — | — | 1 |
| `user_active_clinic_contexts` | `clinics_rbac` | `L14726-L14730` | — | — | 1 |
| `user_governance_overrides` | `clinics_rbac` | `L14736-L14741` | — | — | 3 |
| `user_punishments` | `clinics_rbac` | `L14747-L14757` | — | — | 4 |
| `user_release_note_states` | `clinics_rbac` | `L14763-L14770` | — | — | 4 |
| `user_roles` | `clinics_rbac` | `L14776-L14780` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L14786-L14802` | — | — | 6 |
| `user_security_settings` | `clinics_rbac` | `L14808-L14817` | — | — | 6 |
| `user_telemetry_summaries` | `clinics_rbac` | `L14823-L14843` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L14849-L14862` | — | — | 6 |

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
| `current_user_can` | `clinics_rbac` | `L2634-L2926` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_can_role_capability` | `clinics_rbac` | `L2932-L3204` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `clinics_rbac` | `L3210-L3215` | `"_clinic_id" "uuid"` |
| `custom_access_token_hook` | `core_misc` | `L3221-L3259` | `"event" "jsonb"` |
| `decline_current_user_clinic_invitation` | `clinics_rbac` | `L3265-L3316` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `clinics_rbac` | `L3322-L3339` | `"_notification_id" "uuid"` |
| `disable_user_totp` | `clinics_rbac` | `L3345-L3376` | `` |
| `end_clinic_user_security_sessions` | `sessions` | `L3382-L3429` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L3435-L3495` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L3501-L3540` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L3546-L3581` | `` |
| `enforce_clinic_membership_integrity` | `clinics_rbac` | `L3587-L3619` | `` |
| `ensure_clinic_patient` | `patients` | `L3625-L3838` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L3844-L3875` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L3905-L3927` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `clinics_rbac` | `L3933-L3987` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `clinics_rbac` | `L3993-L4001` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L4007-L4027` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `finalize_overdue_agenda_events` | `core_misc` | `L4033-L4145` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L4155-L4170` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `clinics_rbac` | `L4176-L4196` | `` |
| `generate_profile_public_code_for_clinic` | `clinics_rbac` | `L4202-L4209` | `"_clinic_id" "uuid"` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L4215-L4226` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L4232-L4260` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_rbac` | `L4266-L4319` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_rbac` | `L4325-L4440` | `"_token" "text"` |
| `get_clinic_concurrent_access_overview` | `clinics_rbac` | `L4446-L4475` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_dashboard_analytics` | `clinics_rbac` | `L4481-L4964` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `clinics_rbac` | `L4970-L5022` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_rbac` | `L5028-L5092` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_rbac` | `L5098-L5126` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `clinics_rbac` | `L5132-L5142` | `"_clinic_id" "uuid"` |
| `get_clinic_subscription_summary` | `clinics_rbac` | `L5152-L5234` | `"_clinic_id" "uuid"` |
| `get_clinic_trash_items` | `clinics_rbac` | `L5240-L5360` | `"_clinic_id" "uuid", "_entity_type" "text" DEFAULT 'all'::"text"` |
| `get_current_platform_role` | `anamnesis_forms` | `L5366-L5376` | `` |
| `get_current_user_pending_release_notes` | `clinics_rbac` | `L5382-L5509` | `` |
| `get_patient_registration_form` | `patients` | `L5515-L5595` | `"_token" "text", "_password" "text"` |
| `get_personal_portfolio_session_detail` | `sessions` | `L5601-L5700` | `"_session_id" "uuid"` |
| `get_personal_professional_sessions_portfolio` | `sessions` | `L5706-L5845` | `"_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" i` |
| `get_platform_clinic_detail` | `anamnesis_forms` | `L5851-L5911` | `"_clinic_id" "uuid"` |
| `get_platform_clinic_detail_by_route_key` | `anamnesis_forms` | `L5917-L5948` | `"_route_key" "text"` |
| `get_platform_clinic_forms_summary_by_route_key` | `anamnesis_forms` | `L5954-L6043` | `"_route_key" "text"` |
| `get_platform_clinic_roles_overview` | `anamnesis_forms` | `L6049-L6121` | `"_clinic_id" "uuid"` |
| `get_platform_dashboard` | `anamnesis_forms` | `L6127-L6185` | `` |
| `get_platform_person_detail` | `anamnesis_forms` | `L6191-L6398` | `"_item_type" "text", "_item_id" "uuid"` |
| `get_session_share_recipients` | `sessions` | `L6404-L6433` | `"_session_id" "uuid"` |
| `get_session_share_summary` | `sessions` | `L6439-L6477` | `"_session_ids" "uuid"[]` |
| `get_user_active_governance` | `clinics_rbac` | `L6483-L6513` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `clinics_rbac` | `L6519-L6540` | `"_user_id" "uuid"` |
| `get_user_totp_status` | `clinics_rbac` | `L6546-L6572` | `` |
| `handle_personal_signup` | `core_misc` | `L6578-L6821` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_platform_onboarding_meetings_updated_at` | `anamnesis_forms` | `L6827-L6834` | `` |
| `handle_signup` | `core_misc` | `L6840-L6880` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `core_misc` | `L6886-L6962` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L6968-L7054` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L7060-L7193` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_whatsapp_chat_sessions_updated_at` | `sessions` | `L7199-L7206` | `` |
| `has_role` | `clinics_rbac` | `L7212-L7220` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L7226-L7235` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `clinics_rbac` | `L7241-L7492` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_rbac` | `L7498-L7510` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_read_only` | `clinics_rbac` | `L7516-L7565` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `clinics_rbac` | `L7571-L7593` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L7599-L7609` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L7615-L7626` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L7632-L7638` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `clinics_rbac` | `L7644-L7721` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `clinics_rbac` | `L7727-L7755` | `` |
| `list_current_user_clinics` | `clinics_rbac` | `L7761-L7822` | `` |
| `list_current_user_notification_preferences` | `clinics_rbac` | `L7828-L7854` | `` |
| `list_current_user_notifications` | `clinics_rbac` | `L7860-L7899` | `` |
| `list_feature_flags` | `platform_admin` | `L7905-L7940` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L7946-L7969` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L7975-L8029` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L8035-L8395` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L8401-L8436` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L8442-L8469` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L8475-L8502` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L8508-L8551` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L8557-L8594` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `core_misc` | `L8600-L8696` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L8702-L8794` | `` |
| `manage_clinic_subscription_plan` | `clinics_rbac` | `L8800-L8992` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `move_entity_to_trash` | `core_misc` | `L8998-L9110` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `normalize_patient_name_key` | `patients` | `L9116-L9125` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L9131-L9144` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L9150-L9195` | `` |
| `notify_clinic_collaborator_presence` | `clinics_rbac` | `L9201-L9282` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L9288-L9343` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L9349-L9398` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L9404-L9409` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L9415-L9556` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_default_patient_group_delete` | `patients` | `L9562-L9578` | `` |
| `pseudonymize_patient_name` | `patients` | `L9584-L9613` | `"_name" "text"` |
| `purge_clinic_trash_bin` | `clinics_rbac` | `L9619-L9725` | `` |
| `purge_old_app_notifications` | `whatsapp_notifications` | `L9731-L9745` | `"_retention_days" integer DEFAULT 60` |
| `raise_exception_json` | `core_misc` | `L9751-L9757` | `"_message" "text"` |
| `reconcile_legacy_users_solo_clinic` | `clinics_rbac` | `L9763-L9918` | `` |
| `record_asaas_webhook_event` | `finance_billing` | `L9924-L9970` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L9976-L10147` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L10153-L10289` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_rbac` | `L10295-L10396` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L10402-L10436` | `"_phone" "text" DEFAULT NULL::"text"` |
| `restore_entity_from_trash` | `core_misc` | `L10442-L10546` | `"_entity_type" "text", "_entity_ids" "uuid"[]` |
| `revoke_clinic_member_access` | `clinics_rbac` | `L10552-L10625` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L10631-L10659` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `clinics_rbac` | `L10665-L10680` | `"_punishment_id" "uuid", "_reason" "text"` |
| `sanitize_clinical_free_text` | `clinics_rbac` | `L10686-L10723` | `"_text" "text"` |
| `set_clinic_subscriptions_updated_at` | `clinics_rbac` | `L10729-L10736` | `` |
| `set_current_user_active_clinic` | `clinics_rbac` | `L10742-L10764` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `clinics_rbac` | `L10770-L10788` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L10794-L10801` | `` |
| `setup_user_totp` | `clinics_rbac` | `L10807-L10832` | `"_totp_secret" "text"` |
| `share_sessions_with_collaborators` | `sessions` | `L10838-L10920` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L10926-L10950` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L10956-L11016` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_patient_registration_form` | `patients` | `L11022-L11228` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L11234-L11315` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_clinic_daily_metrics` | `clinics_rbac` | `L11321-L11370` | `` |
| `sync_clinic_limits_from_subscription` | `clinics_rbac` | `L11376-L11424` | `` |
| `sync_payment_plan_used_sessions` | `sessions` | `L11430-L11454` | `` |
| `sync_session_to_billing` | `sessions` | `L11460-L11514` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L11520-L11553` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L11559-L11587` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L11593-L11601` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L11607-L11614` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L11620-L11633` | `` |
| `trg_increment_row_version` | `core_misc` | `L11639-L11646` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L11652-L11662` | `` |
| `trim_user_notifications` | `clinics_rbac` | `L11668-L11685` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `clinics_rbac` | `L11691-L11817` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_rbac` | `L11823-L11867` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_rbac` | `L11873-L11949` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_rbac` | `L11955-L12059` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_rbac` | `L12065-L12181` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `clinics_rbac` | `L12187-L12354` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `clinics_rbac` | `L12360-L12481` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `clinics_rbac` | `L12487-L12514` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_patient_guardian_consent` | `patients` | `L12520-L12569` | `"_patient_id" "uuid", "_consent_payload" "jsonb"` |
| `update_team_development_profile` | `clinics_rbac` | `L12575-L12641` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L12647-L12655` | `` |
| `upsert_current_user_security_settings` | `clinics_rbac` | `L12661-L12714` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L12720-L12907` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_user_telemetry_summary` | `clinics_rbac` | `L12913-L13011` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `clinics_rbac` | `L13017-L13038` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_subscription_coupon` | `finance_billing` | `L13044-L13119` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `validate_subscription_coupon` | `finance_billing` | `L13125-L13405` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `clinics_rbac` | `L13411-L13424` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `core_misc` | `L13430-L13455` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L17055-L17055` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L17121-L17121` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L17220-L17220` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L17256-L17256` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L17059-L17059` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L17125-L17125` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L17224-L17224` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L17260-L17260` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L16849-L16849` | `subaccounts.read`, `subaccounts.write`, `subaccounts.manage` |
| `clinic_daily_metrics` | `Users read clinic daily metrics` | `L17129-L17129` | `treasury.read`, `sessions.read` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L17180-L17180` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L17280-L17280` | `patients.write` |
| `clinic_health_insurances` | `clinic_health_insurances_delete` | `L17324-L17324` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_insert` | `L17328-L17328` | `treasury.manage` |
| `clinic_health_insurances` | `clinic_health_insurances_update` | `L17336-L17336` | `treasury.manage` |
| `clinic_insurance_procedures` | `clinic_insurance_procedures_all` | `L17343-L17343` | `treasury.manage` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L16843-L16845` | `subaccounts.write`, `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L16853-L16853` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L17482-L17482` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L17396-L17396` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L16861-L16861` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L17073-L17073` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L17097-L17097` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L17176-L17176` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L17236-L17236` | `clinic_terms.manage` |
| `clinical_session_billings` | `Users manage clinic session billings` | `L17109-L17113` | `treasury.manage`, `sessions.write` |
| `clinical_session_billings` | `Users read clinic session billings` | `L17160-L17162` | `treasury.read`, `sessions.read` |
| `clinics` | `Users update managed clinic` | `L17240-L17240` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L17212-L17212` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L17284-L17284` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L17133-L17133` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L17264-L17264` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L17081-L17081` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L17101-L17101` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L17208-L17208` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L17252-L17252` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L17141-L17141` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L17268-L17268` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L17145-L17145` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L17272-L17272` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patient_health_insurances` | `patient_health_insurances_all` | `L17422-L17422` | `patients.manage`, `sessions.create` |
| `patients` | `Users delete clinic patients` | `L17069-L17069` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L17149-L17149` | `patients.read` |
| `patients` | `Users update clinic patients` | `L17228-L17228` | `patients.write` |
| `patients` | `Users write clinic patients` | `L17276-L17276` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L16857-L16857` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L17296-L17296` | `subaccounts.manage` |
| `sessions` | `Users delete clinic draft sessions` | `L17063-L17065` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L17093-L17093` | `sessions.write` |
| `sessions` | `Users read clinic sessions` | `L17170-L17172` | `sessions.read` |
| `sessions` | `Users update clinic sessions` | `L17232-L17232` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L16865-L16867` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L17508-L17508` | `subaccounts_analytics.read` |
