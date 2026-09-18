-- Migration: 20260917143000_add_forms_editor_feature_flag.sql
-- Descrição: Registro inicial seguro e idempotente da feature flag 'forms_editor' (escopo global)
-- Regra: Padrão Expand and Contract, sem alterações destrutivas nem drop de tabelas.

insert into public.feature_flags (
  key,
  scope,
  clinic_id,
  tag_id,
  value,
  description,
  starts_at,
  expires_at,
  reason
)
values (
  'forms_editor',
  'global',
  null,
  null,
  jsonb_build_object(
    'enabled', true,
    'components', jsonb_build_object(
      'short_text', true,
      'long_text', true,
      'simple_list', true,
      'number', true,
      'date', true,
      'select', true,
      'multiple_choice', true,
      'checklist', true,
      'tags', true,
      'slider', true,
      'calculated', true,
      'section', true,
      'horizontal_section', true,
      'section_selector', true,
      'radar_section', true,
      'table', true,
      'address_block', true
    ),
    'properties', jsonb_build_object(
      'required', true,
      'showInPatientList', true,
      'includeInGlobalDashboard', true,
      'enableFilter', true,
      'enableGrouping', true
    ),
    'menus', jsonb_build_object(
      'palette_sidebar', true,
      'flow', true,
      'properties', true,
      'settings', true,
      'design', true,
      'logic', true
    ),
    'options', jsonb_build_object(
      'flow_reorder', true,
      'flow_duplicate', true,
      'flow_delete', true,
      'flow_move_root', true,
      'settings_field_type', true,
      'settings_label', true,
      'settings_help_text', true,
      'settings_placeholder', true,
      'settings_advanced_options', true,
      'design_accent_color', true,
      'design_section_color', true,
      'design_color_palette', true,
      'design_action_buttons', true,
      'logic_parent_section', true,
      'logic_conditional_visibility', true
    )
  ),
  'Controle granular de componentes, propriedades e menus do Editor de Formulários (DesignLab/Fichas de Anamnese).',
  null,
  null,
  'Configuração padrão inicial do Editor de Formulários no escopo Global'
)
on conflict (key) where scope = 'global'
do nothing;

comment on table public.feature_flags is 'Tabela de governança de feature flags com suporte a escopos global, por tag e por clínica.';
