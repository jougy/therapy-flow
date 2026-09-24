import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Type,
  AlignLeft,
  ListPlus,
  Hash,
  Calendar,
  ChevronDownSquare,
  CircleDot,
  CheckSquare,
  Tags,
  Sliders,
  Folder,
  Columns,
  ToggleLeft,
  Hexagon,
  Table,
  MapPin,
  AlertCircle,
  UserCheck,
  BarChart3,
  Filter,
  Layers,
  Layers3,
  Workflow,
  Settings2,
  SlidersHorizontal,
  Palette,
  GitBranch,
  ArrowUpDown,
  Copy,
  Trash2,
  FolderInput,
  Component,
  HelpCircle,
  Sparkles,
  Paintbrush,
  Grid,
  FolderTree,
  Eye,
  Calculator,
} from "lucide-react";
import type { FormEditorFlagConfig } from "@/lib/feature-flags-catalog";

export type FormEditorTabKey = "components" | "properties" | "menus" | "options";
export type ConfigAccentColor = "blue" | "purple" | "amber" | "emerald";

export interface ConfigItem<K extends string = string> {
  key: K;
  label: string;
  desc: string;
  icon: ComponentType<LucideProps>;
}

export interface ComponentCategoryConfig {
  name: string;
  items: ConfigItem<keyof FormEditorFlagConfig["components"]>[];
}

export interface MenuOptionsGroupConfig {
  groupName: string;
  icon: ComponentType<LucideProps>;
  items: ConfigItem<keyof FormEditorFlagConfig["options"]>[];
}

export const TOTAL_FORM_COMPONENTS = 17;
export const TOTAL_FIELD_PROPERTIES = 5;
export const TOTAL_EDITOR_MENUS = 6;
export const TOTAL_MENU_OPTIONS = 15;

export const COMPONENT_CATEGORIES_CONFIG: readonly ComponentCategoryConfig[] = [
  {
    name: "Básicos",
    items: [
      { key: "short_text", label: "Texto curto", desc: "Linha única de resposta", icon: Type },
      { key: "long_text", label: "Texto longo", desc: "Área de texto livre", icon: AlignLeft },
      { key: "simple_list", label: "Lista de itens", desc: "Lista dinâmica com botão de adicionar", icon: ListPlus },
      { key: "number", label: "Apenas números", desc: "Contagens e valores numéricos", icon: Hash },
      { key: "date", label: "Data", desc: "Calendário interativo", icon: Calendar },
    ],
  },
  {
    name: "Opções & Seleção",
    items: [
      { key: "select", label: "Droplist", desc: "Menu suspenso de escolha única", icon: ChevronDownSquare },
      { key: "multiple_choice", label: "Múltipla escolha", desc: "Opções exclusivas (radio)", icon: CircleDot },
      { key: "checklist", label: "Checklist", desc: "Múltiplas opções de marcação", icon: CheckSquare },
      { key: "tags", label: "Campo de tags", desc: "Tags coloridas e criação dinâmica", icon: Tags },
      { key: "slider", label: "Slidebar", desc: "Escala deslizante numérica", icon: Sliders },
    ],
  },
  {
    name: "Estrutura & Agrupamento",
    items: [
      { key: "section", label: "Seção sanfona", desc: "Agrupador vertical retrátil", icon: Folder },
      { key: "horizontal_section", label: "Etapas Horizontais", desc: "Colunas com rolagem lateral ou navegação em etapas", icon: Columns },
      { key: "section_selector", label: "Seletor de seções", desc: "Switches de visibilidade condicional", icon: ToggleLeft },
      { key: "radar_section", label: "Polígono de Status", desc: "Radar de atributos com sliders e métricas", icon: Hexagon },
    ],
  },
  {
    name: "Especiais",
    items: [
      { key: "table", label: "Tabela", desc: "Grade de colunas personalizadas", icon: Table },
      { key: "address_block", label: "Bloco de Endereço", desc: "CEP, logradouro e GPS", icon: MapPin },
      { key: "calculated", label: "Campos calculados", desc: "Fórmulas matemáticas e classificações clínicas", icon: Calculator },
    ],
  },
] as const;

export const FIELD_PROPERTIES_CONFIG: readonly ConfigItem<keyof FormEditorFlagConfig["properties"]>[] = [
  {
    key: "required",
    label: "Obrigatório",
    desc: "Exige resposta do paciente ou profissional antes de enviar o formulário.",
    icon: AlertCircle,
  },
  {
    key: "showInPatientList",
    label: "Resumo do paciente",
    desc: "Mostra a resposta resumida deste campo na lista e cabeçalho do paciente.",
    icon: UserCheck,
  },
  {
    key: "includeInGlobalDashboard",
    label: "Dashboard global",
    desc: "Contabiliza métricas nas estatísticas agregadas dos dashboards da clínica.",
    icon: BarChart3,
  },
  {
    key: "enableFilter",
    label: "Filtrar",
    desc: "Habilita este campo como parâmetro dinâmico de filtro em buscas e listagens.",
    icon: Filter,
  },
  {
    key: "enableGrouping",
    label: "Agrupar",
    desc: "Permite categorizar e agrupar históricos de atendimentos com base neste campo.",
    icon: Layers,
  },
] as const;

export const EDITOR_MENUS_CONFIG: readonly ConfigItem<keyof FormEditorFlagConfig["menus"]>[] = [
  {
    key: "palette_sidebar",
    label: "Menu de Componentes",
    desc: "Barra lateral esquerda com a paleta de novos componentes arrastáveis.",
    icon: Layers3,
  },
  {
    key: "flow",
    label: "Aba Fluxo",
    desc: "Árvore hierárquica e ordenação dos blocos e seções no painel direito.",
    icon: Workflow,
  },
  {
    key: "properties",
    label: "Aba Propriedades",
    desc: "Painel de configuração e inspeção dos detalhes do campo selecionado.",
    icon: Settings2,
  },
  {
    key: "settings",
    label: "Sub-aba Ajustes",
    desc: "Configuração de rótulo, ajuda, obrigatoriedade e tipo de campo.",
    icon: SlidersHorizontal,
  },
  {
    key: "design",
    label: "Sub-aba Design",
    desc: "Personalização de cores de destaque, paletas e estilos visuais do campo/seção.",
    icon: Palette,
  },
  {
    key: "logic",
    label: "Sub-aba Regras",
    desc: "Comportamento clínico (obrigatoriedade, resumo, dashboard, filtros, agrupamento), aninhamento e visibilidade condicional.",
    icon: SlidersHorizontal,
  },
] as const;

export const MENU_OPTIONS_GROUPS_CONFIG: readonly MenuOptionsGroupConfig[] = [
  {
    groupName: "Opções do Fluxo",
    icon: Workflow,
    items: [
      { key: "flow_reorder", label: "Reordenar", desc: "Botões para subir ou descer elementos na árvore de fluxo.", icon: ArrowUpDown },
      { key: "flow_duplicate", label: "Duplicar", desc: "Botão rápido de duplicação do elemento na árvore.", icon: Copy },
      { key: "flow_delete", label: "Excluir", desc: "Botão de exclusão do elemento diretamente pela árvore.", icon: Trash2 },
      { key: "flow_move_root", label: "Mover raiz", desc: "Seletor para mover elemento para a raiz ou trocar de seção.", icon: FolderInput },
    ],
  },
  {
    groupName: "Opções de Ajustes",
    icon: SlidersHorizontal,
    items: [
      { key: "settings_field_type", label: "Tipo de campo", desc: "Permitir alterar o tipo de um campo já inserido.", icon: Component },
      { key: "settings_label", label: "Rótulo / Pergunta", desc: "Edição do título / pergunta principal do campo.", icon: Type },
      { key: "settings_help_text", label: "Ajuda", desc: "Edição do texto de orientação e dica contextual.", icon: HelpCircle },
      { key: "settings_placeholder", label: "Placeholder", desc: "Edição do texto indicativo exibido dentro do campo vazio.", icon: AlignLeft },
      { key: "settings_advanced_options", label: "Opções avançadas", desc: "Modo de seleção, tags customizadas, colunas de tabela e botões dinâmicos.", icon: Sparkles },
    ],
  },
  {
    groupName: "Opções de Design",
    icon: Palette,
    items: [
      { key: "design_accent_color", label: "Cor de destaque", desc: "Seletor de cor hexadecimal e transparência (Alpha).", icon: Paintbrush },
      { key: "design_section_color", label: "Editar cor da seção", desc: "Ajuste específico de cores para contêineres e seções.", icon: Palette },
      { key: "design_color_palette", label: "Paleta de cores", desc: "Atalhos rápidos com as cores pré-definidas da clínica.", icon: Grid },
      { key: "design_action_buttons", label: "Botões de duplicar/excluir", desc: "Botões de ação no rodapé do painel de propriedades.", icon: Layers },
    ],
  },
  {
    groupName: "Opções de Regras",
    icon: SlidersHorizontal,
    items: [
      { key: "logic_parent_section", label: "Seção pai", desc: "Seleção do contêiner ou seção pai que engloba o campo.", icon: FolderTree },
      { key: "logic_conditional_visibility", label: "Visibilidade condicional", desc: "Configuração de exibição condicionada ao Seletor de Seções.", icon: Eye },
    ],
  },
] as const;
