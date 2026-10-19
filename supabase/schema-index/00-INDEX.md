# 🗄️ Índice Modular do Schema Supabase (SSOT Index)

> **Gerado automaticamente** a partir de `supabase/schema.sql` (16520 linhas).
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
| `agenda_events` | `core_misc` | `L11555-L11578` | — | — | 8 |
| `anamnesis_form_templates` | `anamnesis_forms` | `L11584-L11600` | — | — | 6 |
| `app_notifications` | `whatsapp_notifications` | `L11606-L11626` | — | — | 3 |
| `asaas_webhook_events` | `finance_billing` | `L11632-L11642` | — | — | 3 |
| `clinic_collaborator_invitations` | `clinics_rbac` | `L11648-L11672` | — | — | 6 |
| `clinic_group_color_slots` | `clinics_rbac` | `L11678-L11689` | — | — | 4 |
| `clinic_memberships` | `clinics_rbac` | `L11695-L11709` | — | — | 5 |
| `clinic_operational_role_capabilities` | `clinics_rbac` | `L11715-L11725` | — | — | 3 |
| `clinic_operational_roles` | `clinics_rbac` | `L11733-L11747` | — | — | 4 |
| `clinic_subscriptions` | `clinics_rbac` | `L11755-L11807` | — | — | 27 |
| `clinic_tag_relations` | `clinics_rbac` | `L11813-L11818` | — | — | 1 |
| `clinic_tags` | `clinics_rbac` | `L11824-L11830` | — | — | 2 |
| `clinic_terms` | `clinics_rbac` | `L11836-L11851` | — | — | 5 |
| `clinics` | `clinics_rbac` | `L11857-L11887` | — | — | 9 |
| `community_form_template_comments` | `anamnesis_forms` | `L11893-L11904` | — | — | 3 |
| `community_form_template_likes` | `anamnesis_forms` | `L11910-L11914` | — | — | 1 |
| `community_form_templates` | `anamnesis_forms` | `L11920-L11939` | — | — | 7 |
| `feature_flags` | `platform_admin` | `L11945-L11962` | — | — | 4 |
| `governance_rules` | `platform_admin` | `L11968-L11972` | — | — | 1 |
| `notification_preferences` | `whatsapp_notifications` | `L3186-L3200` | — | — | 8 |
| `patient_clinical_snapshots` | `patients` | `L11978-L11988` | — | — | 1 |
| `patient_evolution_groups` | `patients` | `L11994-L12001` | — | — | 2 |
| `patient_file_uploads` | `patients` | `L12007-L12051` | — | ✅ Sim | 12 |
| `patient_group_templates` | `patients` | `L12057-L12071` | — | — | 2 |
| `patient_groups` | `patients` | `L12077-L12091` | — | — | 2 |
| `patient_payment_plans` | `patients` | `L12097-L12121` | `total_amount_cents`, `session_unit_amount_cents` | — | 7 |
| `patient_registration_links` | `patients` | `L12127-L12137` | — | — | 3 |
| `patients` | `patients` | `L12143-L12194` | — | — | 7 |
| `platform_admins` | `anamnesis_forms` | `L12200-L12207` | — | — | 3 |
| `platform_audit_events` | `anamnesis_forms` | `L12213-L12224` | — | — | 1 |
| `platform_clinic_access_sessions` | `sessions` | `L12247-L12255` | — | — | 3 |
| `platform_error_logs` | `anamnesis_forms` | `L12230-L12241` | — | — | 1 |
| `platform_feedbacks` | `anamnesis_forms` | `L12261-L12279` | — | — | 3 |
| `platform_onboarding_meetings` | `anamnesis_forms` | `L16361-L16376` | — | — | 14 |
| `platform_release_note_items` | `anamnesis_forms` | `L12285-L12294` | — | — | 2 |
| `platform_releases` | `anamnesis_forms` | `L12300-L12313` | — | — | 5 |
| `profiles` | `clinics_rbac` | `L12319-L12348` | — | — | 8 |
| `security_events` | `core_misc` | `L12354-L12364` | — | — | 1 |
| `session_edit_history` | `sessions` | `L12370-L12381` | — | — | 1 |
| `session_shares` | `sessions` | `L12387-L12398` | — | — | 2 |
| `sessions` | `sessions` | `L12404-L12449` | `amount_charged_cents`, `amount_paid_cents`, `amount_original_cents` | — | 12 |
| `subscription_coupons` | `finance_billing` | `L12455-L12479` | — | — | 9 |
| `subscription_invoices` | `finance_billing` | `L12497-L12533` | — | — | 18 |
| `team_development_profiles` | `clinics_rbac` | `L12539-L12555` | — | — | 4 |
| `telemetry_events` | `platform_admin` | `L12561-L12572` | — | — | 1 |
| `user_active_clinic_contexts` | `clinics_rbac` | `L12578-L12582` | — | — | 1 |
| `user_governance_overrides` | `clinics_rbac` | `L12588-L12593` | — | — | 3 |
| `user_punishments` | `clinics_rbac` | `L12599-L12609` | — | — | 4 |
| `user_release_note_states` | `clinics_rbac` | `L12615-L12622` | — | — | 4 |
| `user_roles` | `clinics_rbac` | `L12628-L12632` | — | — | 0 |
| `user_security_sessions` | `sessions` | `L12638-L12654` | — | — | 6 |
| `user_security_settings` | `clinics_rbac` | `L12660-L12669` | — | — | 6 |
| `user_telemetry_summaries` | `clinics_rbac` | `L12675-L12695` | — | — | 11 |
| `whatsapp_chat_sessions` | `sessions` | `L16319-L16332` | — | — | 12 |

## ⚡ Catálogo de Views
| View | Domínio | Linhas (`schema.sql`) |
| :--- | :--- | :--- |

## 🔧 Catálogo de RPCs e Funções (`public`)
| Função / RPC | Domínio | Linhas (`schema.sql`) | Parâmetros (Resumo) |
| :--- | :--- | :--- | :--- |
| `accept_clinic_collaborator_invitation` | `clinics_rbac` | `L157-L415` | `"_token" "text", "_full_name" "text" DEFAULT NULL::"text"` |
| `accept_current_user_clinic_invitation` | `clinics_rbac` | `L421-L658` | `"_invitation_id" "uuid"` |
| `acknowledge_current_user_release_notes` | `clinics_rbac` | `L841-L900` | `"_release_id" "uuid" DEFAULT NULL::"uuid"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L906-L1064` | `"_clinic_id" "uuid", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `activate_clinic_free_trial` | `clinics_rbac` | `L1070-L1075` | `"_clinic_id" "uuid", "_plan_type" "public"."subscription_plan"` |
| `apply_user_punishment` | `clinics_rbac` | `L1081-L1122` | `"_user_id" "uuid", "_punishment_type" "text", "_duration_minutes" integer, "_reason" "text` |
| `assign_profile_public_code` | `clinics_rbac` | `L1128-L1139` | `` |
| `auto_accept_pending_clinic_invitation_for_current_user` | `clinics_rbac` | `L664-L835` | `` |
| `buy_clinic_subaccount_extra_spaces` | `clinics_rbac` | `L1145-L1228` | `"_clinic_id" "uuid", "_quantity" integer, "_billing_type" "text" DEFAULT 'PIX'::"text"` |
| `calculate_community_template_fields_count` | `anamnesis_forms` | `L1234-L1245` | `` |
| `can_insert_session` | `sessions` | `L1251-L1268` | `"_clinic_id" "uuid", "_user_id" "uuid", "_provider_id" "uuid"` |
| `can_perform_action` | `anamnesis_forms` | `L1274-L1385` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `can_read_clinic_data` | `clinics_rbac` | `L1391-L1450` | `"_clinic_id" "uuid"` |
| `can_read_session` | `sessions` | `L1456-L1498` | `"_session_id" "uuid"` |
| `can_share_session` | `sessions` | `L1504-L1533` | `"_session_id" "uuid"` |
| `cancel_clinic_collaborator_invitation` | `clinics_rbac` | `L1539-L1587` | `"_invitation_id" "uuid"` |
| `change_clinic_subscription_plan` | `clinics_rbac` | `L8181-L8188` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `check_clinic_plan_quota` | `clinics_rbac` | `L1593-L1693` | `"p_clinic_id" "uuid", "p_feature_type" "text"` |
| `cleanup_old_telemetry_events` | `platform_admin` | `L1699-L1732` | `"_page_view_retention_days" integer DEFAULT 15, "_security_event_retention_days" integer D` |
| `cleanup_user_security_sessions` | `sessions` | `L1738-L1801` | `"_user_id" "uuid" DEFAULT "auth"."uid"(), "_inactive_window" interval DEFAULT '00:15:00'::` |
| `clear_current_user_notifications` | `clinics_rbac` | `L1807-L1823` | `` |
| `complete_unregistered_cpf_profile` | `clinics_rbac` | `L7714-L7768` | `"_full_name" "text", "_cpf" "text", "_phone" "text" DEFAULT NULL::"text", "_birth_date" "d` |
| `confirm_asaas_subscription_payment` | `finance_billing` | `L1829-L1892` | `"_asaas_payment_id" "text", "_clinic_id" "uuid", "_paid_value" numeric, "_payment_date" ti` |
| `create_clinic_subaccount` | `clinics_rbac` | `L1898-L2074` | `"_email" "text", "_password" "text", "_full_name" "text", "_operational_role" "public"."op` |
| `create_current_user_notification` | `clinics_rbac` | `L2080-L2105` | `"_clinic_id" "uuid", "_category" "text", "_event_type" "text", "_title" "text", "_body" "t` |
| `create_due_agenda_reminder_notifications` | `whatsapp_notifications` | `L2111-L2167` | `"_lookahead" interval DEFAULT '00:30:00'::interval` |
| `create_patient_registration_link` | `patients` | `L2173-L2257` | `"_patient_id" "uuid"` |
| `create_user_notification` | `clinics_rbac` | `L2263-L2322` | `"_user_id" "uuid", "_clinic_id" "uuid", "_actor_user_id" "uuid", "_category" "text", "_eve` |
| `current_user_can` | `clinics_rbac` | `L2328-L2615` | `"_capability" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `current_user_is_clinic_manager` | `clinics_rbac` | `L2621-L2626` | `"_clinic_id" "uuid"` |
| `decline_current_user_clinic_invitation` | `clinics_rbac` | `L2632-L2683` | `"_invitation_id" "uuid"` |
| `delete_current_user_notification` | `clinics_rbac` | `L2689-L2706` | `"_notification_id" "uuid"` |
| `end_clinic_user_security_sessions` | `sessions` | `L2712-L2759` | `"_target_user_id" "uuid", "_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `end_current_security_session` | `sessions` | `L2765-L2825` | `"_session_key" "text"` |
| `end_other_security_sessions` | `sessions` | `L2831-L2870` | `"_current_session_key" "text"` |
| `end_platform_clinic_access` | `anamnesis_forms` | `L2876-L2911` | `` |
| `enforce_clinic_membership_integrity` | `clinics_rbac` | `L2917-L2949` | `` |
| `ensure_clinic_patient` | `patients` | `L2955-L3139` | `"_clinic_id" "uuid", "_name" "text", "_name_key" "text", "_date_of_birth" "date", "_cpf" "` |
| `ensure_default_patient_group` | `patients` | `L3145-L3176` | `` |
| `ensure_notification_preferences` | `whatsapp_notifications` | `L3206-L3228` | `"_user_id" "uuid"` |
| `ensure_team_development_profile` | `clinics_rbac` | `L3234-L3288` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `ensure_team_development_profile_from_membership` | `clinics_rbac` | `L3294-L3302` | `` |
| `expire_abandoned_security_sessions` | `sessions` | `L3308-L3328` | `"_abandoned_window" interval DEFAULT '7 days'::interval` |
| `finalize_overdue_agenda_events` | `core_misc` | `L3334-L3446` | `"_batch_size" integer DEFAULT 500, "_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text"` |
| `generate_next_patient_code` | `patients` | `L3456-L3471` | `"_clinic_id" "uuid"` |
| `generate_profile_public_code` | `clinics_rbac` | `L3477-L3497` | `` |
| `generate_profile_public_code_for_clinic` | `clinics_rbac` | `L3503-L3510` | `"_clinic_id" "uuid"` |
| `get_active_platform_clinic_id` | `anamnesis_forms` | `L3516-L3527` | `"_user_id" "uuid"` |
| `get_asaas_webhook_logs` | `finance_billing` | `L3533-L3561` | `"_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0` |
| `get_clinic_active_terms` | `clinics_rbac` | `L4329-L4382` | `"p_clinic_id" "uuid"` |
| `get_clinic_collaborator_invitation` | `clinics_rbac` | `L3567-L3682` | `"_token" "text"` |
| `get_clinic_dashboard_analytics` | `clinics_rbac` | `L3688-L4171` | `"_clinic_id" "uuid", "_year" integer DEFAULT NULL::integer` |
| `get_clinic_feature_flags` | `clinics_rbac` | `L4177-L4229` | `"_clinic_id" "uuid"` |
| `get_clinic_pending_collaborator_invitations` | `clinics_rbac` | `L4235-L4289` | `"_clinic_id" "uuid"` |
| `get_clinic_share_collaborators` | `clinics_rbac` | `L4295-L4323` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `get_clinic_storage_usage` | `clinics_rbac` | `L16421-L16427` | `_clinic_id uuid)` |
| `get_clinic_subscription_summary` | `clinics_rbac` | `L4387-L4469` | `"_clinic_id" "uuid"` |
| `get_current_platform_role` | `anamnesis_forms` | `L4605-L4615` | `` |
| `get_current_user_pending_release_notes` | `clinics_rbac` | `L4621-L4748` | `` |
| `get_patient_registration_form` | `patients` | `L4754-L4829` | `"_token" "text", "_password" "text"` |
| `get_personal_professional_sessions_portfolio` | `sessions` | `L5388-L5527` | `"_query" "text" DEFAULT NULL::"text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" i` |
| `get_platform_clinic_detail` | `anamnesis_forms` | `L4835-L4895` | `"_clinic_id" "uuid"` |
| `get_platform_clinic_detail_by_route_key` | `anamnesis_forms` | `L4901-L4932` | `"_route_key" "text"` |
| `get_platform_clinic_forms_summary_by_route_key` | `anamnesis_forms` | `L4938-L5027` | `"_route_key" "text"` |
| `get_platform_clinic_roles_overview` | `anamnesis_forms` | `L5033-L5105` | `"_clinic_id" "uuid"` |
| `get_platform_dashboard` | `anamnesis_forms` | `L5111-L5169` | `` |
| `get_platform_person_detail` | `anamnesis_forms` | `L5175-L5382` | `"_item_type" "text", "_item_id" "uuid"` |
| `get_session_share_recipients` | `sessions` | `L5533-L5562` | `"_session_id" "uuid"` |
| `get_session_share_summary` | `sessions` | `L5568-L5606` | `"_session_ids" "uuid"[]` |
| `get_user_active_governance` | `clinics_rbac` | `L5612-L5642` | `"_user_id" "uuid"` |
| `get_user_clinic_id` | `clinics_rbac` | `L5648-L5669` | `"_user_id" "uuid"` |
| `handle_personal_signup` | `core_misc` | `L5675-L5904` | `"_user_id" "uuid", "_email" "text", "_full_name" "text" DEFAULT NULL::"text", "_cpf" "text` |
| `handle_signup` | `core_misc` | `L5910-L5950` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_full_name" "text" DEFAULT NULL::"tex` |
| `handle_signup` | `core_misc` | `L5956-L6032` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L6038-L6124` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `handle_signup` | `core_misc` | `L6130-L6263` | `"_user_id" "uuid", "_email" "text", "_cnpj" "text", "_subscription_plan" "public"."subscri` |
| `has_role` | `clinics_rbac` | `L6269-L6277` | `"_user_id" "uuid", "_role" "public"."app_role"` |
| `increment_community_template_import` | `anamnesis_forms` | `L6283-L6292` | `"p_template_id" "uuid"` |
| `invite_clinic_collaborator` | `clinics_rbac` | `L6298-L6511` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_email" "text" DEFAULT NULL::"text", "_operatio` |
| `is_active_clinic_member` | `clinics_rbac` | `L6517-L6529` | `"_clinic_id" "uuid", "_user_id" "uuid"` |
| `is_clinic_read_only` | `clinics_rbac` | `L6535-L6587` | `"_clinic_id" "uuid"` |
| `is_clinic_subscription_manager` | `clinics_rbac` | `L6593-L6615` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `is_platform_admin` | `anamnesis_forms` | `L6621-L6631` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner` | `anamnesis_forms` | `L6637-L6648` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `is_platform_owner_mfa_verified` | `anamnesis_forms` | `L6654-L6660` | `"_user_id" "uuid" DEFAULT "auth"."uid"()` |
| `leave_current_user_clinic` | `clinics_rbac` | `L6666-L6743` | `"_clinic_id" "uuid"` |
| `list_current_user_clinic_invitations` | `clinics_rbac` | `L6749-L6777` | `` |
| `list_current_user_clinics` | `clinics_rbac` | `L6783-L6835` | `` |
| `list_current_user_notification_preferences` | `clinics_rbac` | `L6841-L6867` | `` |
| `list_current_user_notifications` | `clinics_rbac` | `L6873-L6912` | `` |
| `list_feature_flags` | `platform_admin` | `L6918-L6953` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid"` |
| `list_platform_audit_events` | `anamnesis_forms` | `L6959-L6982` | `"_clinic_id" "uuid" DEFAULT NULL::"uuid", "_limit" integer DEFAULT 80` |
| `list_platform_clinics` | `anamnesis_forms` | `L7029-L7083` | `` |
| `list_platform_directory` | `anamnesis_forms` | `L7089-L7094` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_limit" integ` |
| `list_platform_directory` | `anamnesis_forms` | `L7100-L7460` | `"_query" "text" DEFAULT NULL::"text", "_kind" "text" DEFAULT 'all'::"text", "_status" "tex` |
| `list_platform_error_logs` | `anamnesis_forms` | `L6988-L7023` | `"_limit" integer DEFAULT 100, "_error_type" "text" DEFAULT NULL::"text", "_search" "text" ` |
| `list_platform_telemetry_events` | `anamnesis_forms` | `L7466-L7493` | `"_clinic_id" "uuid", "_limit" integer DEFAULT 100` |
| `list_platform_user_telemetry_events` | `anamnesis_forms` | `L7499-L7526` | `"_user_id" "uuid", "_limit" integer DEFAULT 100` |
| `log_platform_audit_event` | `anamnesis_forms` | `L7532-L7575` | `"_event_type" "text", "_clinic_id" "uuid" DEFAULT NULL::"uuid", "_reason" "text" DEFAULT N` |
| `log_platform_error` | `anamnesis_forms` | `L10971-L11008` | `"_error_type" "text", "_message" "text", "_scope" "text" DEFAULT NULL::"text", "_stack_tra` |
| `log_security_event` | `core_misc` | `L7774-L7870` | `"_clinic_id" "uuid", "_actor_user_id" "uuid", "_target_user_id" "uuid", "_event_type" "tex` |
| `log_session_edit_history` | `sessions` | `L7876-L7964` | `` |
| `manage_clinic_subscription_plan` | `clinics_rbac` | `L7970-L8175` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan", "_billing_cycle" "text" DEF` |
| `normalize_patient_name_key` | `patients` | `L8194-L8203` | `"_value" "text"` |
| `notification_category_enabled` | `whatsapp_notifications` | `L8209-L8222` | `"_preferences" "public"."notification_preferences", "_category" "text"` |
| `notify_clinic_access_session_created` | `sessions` | `L8228-L8273` | `` |
| `notify_clinic_collaborator_presence` | `clinics_rbac` | `L8279-L8360` | `"_clinic_id" "uuid", "_user_id" "uuid", "_status" "text"` |
| `notify_session_created` | `sessions` | `L8366-L8421` | `` |
| `platform_create_clinic` | `anamnesis_forms` | `L8427-L8476` | `"_name" "text", "_cnpj" "text", "_subscription_plan" "public"."subscription_plan" DEFAULT ` |
| `platform_normalize_search` | `anamnesis_forms` | `L8482-L8487` | `"_value" "text"` |
| `platform_override_clinic_subscription` | `anamnesis_forms` | `L8493-L8634` | `"_clinic_id" "uuid", "_new_plan" "public"."subscription_plan" DEFAULT NULL::"public"."subs` |
| `prevent_default_patient_group_delete` | `patients` | `L8640-L8656` | `` |
| `raise_exception_json` | `core_misc` | `L8662-L8668` | `"_message" "text"` |
| `record_asaas_webhook_event` | `finance_billing` | `L8674-L8720` | `"_event_id" "text", "_event_type" "text", "_payload" "jsonb", "_signature" "text" DEFAULT ` |
| `register_current_security_session` | `sessions` | `L8726-L8897` | `"_session_key" "text", "_browser" "text" DEFAULT NULL::"text", "_platform" "text" DEFAULT ` |
| `request_account_recovery_status` | `core_misc` | `L7581-L7708` | `"_identifier" "text"` |
| `resend_clinic_collaborator_invitation` | `clinics_rbac` | `L8903-L9005` | `"_invitation_id" "uuid"` |
| `reset_whatsapp_chat_sessions` | `sessions` | `L16446-L16451` | `` |
| `revoke_clinic_member_access` | `clinics_rbac` | `L9011-L9084` | `"_membership_id" "uuid"` |
| `revoke_session_share` | `sessions` | `L9090-L9118` | `"_session_id" "uuid", "_user_id" "uuid"` |
| `revoke_user_punishment` | `clinics_rbac` | `L9124-L9139` | `"_punishment_id" "uuid", "_reason" "text"` |
| `set_clinic_subscriptions_updated_at` | `clinics_rbac` | `L9145-L9152` | `` |
| `set_current_user_active_clinic` | `clinics_rbac` | `L9158-L9180` | `"_clinic_id" "uuid"` |
| `set_current_user_active_clinic_by_route_key` | `clinics_rbac` | `L9186-L9204` | `"_route_key" "text"` |
| `set_updated_at` | `core_misc` | `L9210-L9217` | `` |
| `share_sessions_with_collaborators` | `sessions` | `L9223-L9305` | `"_session_ids" "uuid"[], "_user_ids" "uuid"[], "_access_level" "text" DEFAULT 'can_evolve'` |
| `slugify_text` | `core_misc` | `L9311-L9335` | `"_val" "text"` |
| `start_platform_clinic_access` | `anamnesis_forms` | `L9341-L9401` | `"_clinic_id" "uuid", "_reason" "text"` |
| `submit_patient_registration_form` | `patients` | `L9407-L9613` | `"_token" "text", "_password" "text", "_payload" "jsonb"` |
| `submit_user_platform_feedback` | `anamnesis_forms` | `L9619-L9700` | `"_clinic_id" "uuid", "_ratings" "jsonb", "_problem_report" "text" DEFAULT NULL::"text", "_` |
| `sync_clinic_limits_from_subscription` | `clinics_rbac` | `L9706-L9754` | `` |
| `toggle_community_template_like` | `anamnesis_forms` | `L9760-L9793` | `"p_template_id" "uuid"` |
| `toggle_subscription_auto_renew` | `finance_billing` | `L9799-L9827` | `"_clinic_id" "uuid", "_auto_renew" boolean` |
| `touch_notification_preferences_updated_at` | `whatsapp_notifications` | `L9833-L9841` | `` |
| `touch_platform_feedbacks_updated_at` | `anamnesis_forms` | `L9847-L9854` | `` |
| `trg_auto_assign_patient_code` | `patients` | `L9860-L9873` | `` |
| `trg_patient_groups_set_clinic_id` | `patients` | `L9879-L9889` | `` |
| `trim_user_notifications` | `clinics_rbac` | `L9895-L9912` | `"_user_id" "uuid"` |
| `update_clinic_billing_due_window` | `clinics_rbac` | `L4474-L4600` | `"_clinic_id" "uuid", "_window" "text"` |
| `update_clinic_collaborator_invitation` | `clinics_rbac` | `L9918-L9962` | `"_invitation_id" "uuid", "_operational_role" "public"."operational_role_type" DEFAULT 'pro` |
| `update_clinic_concurrent_accesses` | `clinics_rbac` | `L9968-L10044` | `"_clinic_id" "uuid", "_extra_concurrent" integer` |
| `update_clinic_member_operational_fields` | `clinics_rbac` | `L10050-L10172` | `"_membership_id" "uuid", "_job_title" "text" DEFAULT NULL::"text", "_specialty" "text" DEF` |
| `update_clinic_subaccount` | `clinics_rbac` | `L10178-L10294` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_email" "text" DEFAULT` |
| `update_clinic_subaccount_profile` | `clinics_rbac` | `L10300-L10467` | `"_membership_id" "uuid", "_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" D` |
| `update_current_profile` | `clinics_rbac` | `L10473-L10594` | `"_full_name" "text" DEFAULT NULL::"text", "_social_name" "text" DEFAULT NULL::"text", "_em` |
| `update_current_user_notification_preferences` | `clinics_rbac` | `L10600-L10627` | `"_sound_mode" "text" DEFAULT NULL::"text", "_sound_key" "text" DEFAULT NULL::"text", "_not` |
| `update_team_development_profile` | `clinics_rbac` | `L10633-L10699` | `"_user_id" "uuid", "_development_status" "text" DEFAULT NULL::"text", "_internal_level" "t` |
| `update_updated_at_column` | `core_misc` | `L10705-L10713` | `` |
| `upsert_current_user_security_settings` | `clinics_rbac` | `L10719-L10772` | `"_alert_password_changed" boolean DEFAULT NULL::boolean, "_alert_new_login" boolean DEFAUL` |
| `upsert_feature_flag` | `platform_admin` | `L10778-L10965` | `"_key" "text", "_scope" "public"."feature_flag_scope", "_clinic_id" "uuid" DEFAULT NULL::"` |
| `upsert_user_telemetry_summary` | `clinics_rbac` | `L11014-L11112` | `"_clinic_id" "uuid", "_user_name" "text", "_page_views" integer, "_prints_detected" intege` |
| `user_has_active_clinic_membership` | `clinics_rbac` | `L11118-L11132` | `"_user_id" "uuid", "_clinic_id" "uuid"` |
| `validate_subscription_coupon` | `finance_billing` | `L11138-L11213` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text"` |
| `validate_subscription_coupon` | `finance_billing` | `L11219-L11499` | `"_code" "text", "_plan_type" "text" DEFAULT 'clinic'::"text", "_clinic_id" "uuid" DEFAULT ` |
| `validate_user_clinic` | `clinics_rbac` | `L11505-L11518` | `"_user_id" "uuid", "_cnpj" "text"` |
| `verify_password_recovery_identity` | `core_misc` | `L11524-L11549` | `"_email" "text", "_cpf" "text"` |

## 🛡️ Resumo de Políticas RLS com Capabilities
| Tabela | Policy | Linhas | Capabilities Detectadas |
| :--- | :--- | :--- | :--- |
| `agenda_events` | `Users delete clinic agenda events` | `L14541-L14541` | `agenda.delete_events` |
| `agenda_events` | `Users read clinic agenda events` | `L14599-L14599` | `agenda.read` |
| `agenda_events` | `Users update clinic agenda events` | `L14688-L14688` | `agenda.write` |
| `agenda_events` | `Users write clinic agenda events` | `L14724-L14724` | `agenda.write` |
| `anamnesis_form_templates` | `Users delete clinic anamnesis forms` | `L14545-L14545` | `forms.manage` |
| `anamnesis_form_templates` | `Users read clinic anamnesis forms` | `L14603-L14603` | `forms.read`, `anamnesis_forms.read` |
| `anamnesis_form_templates` | `Users update clinic anamnesis forms` | `L14692-L14692` | `forms.manage` |
| `anamnesis_form_templates` | `Users write clinic anamnesis forms` | `L14728-L14728` | `forms.manage` |
| `clinic_collaborator_invitations` | `Managers read clinic collaborator invitations` | `L14355-L14355` | `subaccounts.manage` |
| `clinic_group_color_slots` | `Users read clinic_group_color_slots` | `L14648-L14648` | `patients.read` |
| `clinic_group_color_slots` | `Users write clinic_group_color_slots` | `L14748-L14748` | `patients.write` |
| `clinic_memberships` | `Managers insert clinic memberships` | `L14349-L14351` | `subaccounts.manage` |
| `clinic_memberships` | `Managers update clinic memberships` | `L14359-L14359` | `subaccounts.manage` |
| `clinic_operational_role_capabilities` | `role capabilities are manageable by role admins` | `L14892-L14892` | `subaccounts_roles.manage` |
| `clinic_operational_roles` | `operational roles are manageable by role admins` | `L14820-L14820` | `subaccounts_roles.manage` |
| `clinic_subscriptions` | `Owners e gestores podem ver a assinatura` | `L14367-L14369` | `subscription_billing.read` |
| `clinic_terms` | `Users delete clinic terms` | `L14559-L14559` | `clinic_terms.manage` |
| `clinic_terms` | `Users insert clinic terms` | `L14583-L14583` | `clinic_terms.manage` |
| `clinic_terms` | `Users read clinic terms` | `L14644-L14644` | `patients.read`, `clinic_terms.manage`, `clinic_profile.read` |
| `clinic_terms` | `Users update clinic terms` | `L14704-L14704` | `clinic_terms.manage` |
| `clinics` | `Users update managed clinic` | `L14708-L14708` | `clinic_profile.manage` |
| `patient_clinical_snapshots` | `Users read patient_clinical_snapshots` | `L14680-L14680` | `patients.read` |
| `patient_clinical_snapshots` | `Users write patient_clinical_snapshots` | `L14752-L14752` | `patients.write` |
| `patient_evolution_groups` | `Users read clinic evolution groups` | `L14607-L14607` | `sessions.read` |
| `patient_evolution_groups` | `Users write clinic evolution groups` | `L14732-L14732` | `sessions.write` |
| `patient_file_uploads` | `Users delete patient file uploads` | `L14567-L14567` | `patients.delete`, `patients.write` |
| `patient_file_uploads` | `Users insert patient file uploads` | `L14587-L14587` | `patients.write` |
| `patient_file_uploads` | `Users read patient file uploads` | `L14676-L14676` | `patients.read` |
| `patient_file_uploads` | `Users update patient file uploads` | `L14720-L14720` | `patients.write` |
| `patient_group_templates` | `Users read clinic patient_group_templates` | `L14615-L14615` | `patients.read` |
| `patient_group_templates` | `Users write clinic patient_group_templates` | `L14736-L14736` | `patients.write` |
| `patient_groups` | `Users read clinic patient_groups` | `L14619-L14619` | `patient_groups.read`, `patients_groups.read`, `patients.read`, `sessions.read` |
| `patient_groups` | `Users write clinic patient_groups` | `L14740-L14740` | `patients.manage_groups`, `patient_groups.write`, `sessions.write` |
| `patients` | `Users delete clinic patients` | `L14555-L14555` | `patients.delete` |
| `patients` | `Users read clinic patients` | `L14623-L14623` | `patients.read` |
| `patients` | `Users update clinic patients` | `L14696-L14696` | `patients.write` |
| `patients` | `Users write clinic patients` | `L14744-L14744` | `patients.write` |
| `profiles` | `Managers update clinic profiles` | `L14363-L14363` | `subaccounts.manage` |
| `security_events` | `admins can read clinic security events` | `L14756-L14756` | `subaccounts.manage` |
| `session_edit_history` | `Users insert clinic session edit history` | `L14575-L14575` | `sessions.write` |
| `sessions` | `Users delete clinic draft sessions` | `L14549-L14551` | `session.delete_draft` |
| `sessions` | `Users insert clinic sessions` | `L14579-L14579` | `sessions.write` |
| `sessions` | `Users read clinic sessions` | `L14640-L14640` | `sessions.read` |
| `sessions` | `Users update clinic sessions` | `L14700-L14700` | `sessions.write` |
| `subscription_invoices` | `Owners e gestores podem ver as faturas` | `L14373-L14375` | `subscription_billing.read` |
| `team_development_profiles` | `team development readable by clinic admins or self` | `L14918-L14918` | `subaccounts_analytics.read` |
