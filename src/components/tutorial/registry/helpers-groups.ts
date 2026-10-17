import type { HelperPageGroup } from "./types";
import { COMPONENT_HELP_REGISTRY } from "./component-help";

export const HELPERS_PAGE_GROUPS: HelperPageGroup[] = [
  {
    id: "espaco-pessoal",
    title: "Espaço Pessoal & Seleção de Clínicas",
    route: "/selecionar-clinica",
    iconName: "Building2",
    description: "Página inicial do profissional para alternar entre clínicas e gerenciar seu perfil.",
    helpers: [
      {
        id: "personal-welcome-block",
        name: "Boas-vindas & Visão Geral",
        description: "Bloco de boas-vindas do espaço pessoal com atalho para seus dados cadastrais.",
        targetSelector: "[data-tutorial='personal-welcome']",
      },
      {
        id: "personal-clinics-block",
        name: "Lista de Clínicas & Novo Espaço",
        description: "Card de clínicas cadastradas e botão para aquisição de novos consultórios.",
        targetSelector: "[data-tutorial='clinic-card-primary']",
      },
    ],
  },
  {
    id: "home-clinica",
    title: "Home da Clínica & Recepção",
    route: "/clinica/:route",
    iconName: "Users",
    description: "Tela principal de atendimento da clínica com busca de pacientes e agenda.",
    helpers: [
      {
        id: "patient-search-toolbar",
        name: "Barra de Busca & Filtros Táteis",
        description: "Busca rápida por nome, CPF e filtros por linha de cuidado ou status.",
        targetSelector: "[data-tutorial='patient-search-toolbar']",
      },
      {
        id: "agenda-widget",
        name: "Widget da Agenda Integrada",
        description: "Calendário interativo de consultas do dia e marcações futuras.",
        targetSelector: "[data-tutorial='agenda-widget']",
      },
      {
        id: "patient-card",
        name: "Card do Paciente & Relógio",
        description: "Status visual do atendimento, alertas e botão rápido de WhatsApp.",
        targetSelector: "[data-tutorial='patient-card-first']",
      },
    ],
  },
  {
    id: "novo-paciente",
    title: "Cadastro do Novo Paciente",
    route: "/pacientes/novo",
    iconName: "UserPlus",
    description: "Formulário de cadastro ágil de novos pacientes com busca de CEP.",
    helpers: [
      {
        id: "new-patient-form-basic",
        name: "Formulário de Cadastro Ágil",
        description: "Preenchimento de dados pessoais, convênio, responsável e endereço.",
        targetSelector: "[data-tutorial='new-patient-form-card']",
      },
    ],
  },
  {
    id: "prontuario-paciente",
    title: "Prontuário do Paciente",
    route: "/pacientes/:id",
    iconName: "ClipboardList",
    description: "Visualização completa do prontuário, histórico, timeline e documentos.",
    helpers: [
      {
        id: "patient-metrics-panel",
        name: "Painel de Métricas & Evolução",
        description: "Resumo clínico de sessões realizadas, faltas e scores de recuperação.",
        targetSelector: "[data-tutorial='patient-metrics-panel']",
      },
      {
        id: "patient-tab-sessions",
        name: "Aba de Sessões & Atendimentos",
        description: "Histórico cronológico de sessões e botão de nova evolução clínica.",
        targetSelector: "[data-tutorial='patient-tab-sessions']",
      },
    ],
  },
  {
    id: "sessao-detalhe",
    title: "Registro de Atendimento & Sessão",
    route: "/sessao/:id",
    iconName: "Stethoscope",
    description: "Área de atendimento em andamento, cronômetro, condutas e prescrições.",
    helpers: [
      {
        id: "session-timer",
        name: "Cronômetro da Sessão",
        description: "Temporizador de duração do atendimento clínico.",
        targetSelector: "[data-tutorial='session-timer']",
      },
      {
        id: "session-carelines",
        name: "Avaliação & Anamnese Clínica",
        description: "Evolução personalizada através dos campos modulares da clínica.",
        targetSelector: "[data-tutorial='session-anamnesis-form']",
      },
      {
        id: "session-conduct-notes",
        name: "Conduta & Evolução Clínica",
        description: "Registro textual da anamnese contínua e evolução do paciente.",
        targetSelector: "[data-tutorial='session-conduct-notes']",
      },
      {
        id: "session-tab-treatment",
        name: "Prescrição de Tratamento",
        description: "Indicação de exercícios, condutas domiciliares e frequência.",
        targetSelector: "[data-tutorial='session-tab-treatment']",
      },
      {
        id: "session-tab-payment",
        name: "Registro Financeiro",
        description: "Controle de pagamento da sessão, recibo e forma de cobrança.",
        targetSelector: "[data-tutorial='session-tab-payment']",
      },
      {
        id: "session-custom-forms",
        name: "Formulários Personalizados",
        description: "Acesso a questionários e escalas de avaliação na sessão.",
        targetSelector: "[data-tutorial='session-custom-forms']",
      },
    ],
  },
  {
    id: "dashboard-clinica",
    title: "Dashboard & Métricas da Clínica",
    route: "/dashboard",
    iconName: "LayoutDashboard",
    description: "Visão estratégica de indicadores financeiros, produtividade e atendimentos.",
    helpers: [
      {
        id: "clinic-kpis-block",
        name: "Painel de KPIs & Gráficos",
        description: "Visão consolidada de faturamento, novos pacientes e taxas de retorno.",
        targetSelector: "[data-tutorial='clinic-kpis-block']",
      },
    ],
  },
  {
    id: "configuracoes-clinica",
    title: "Configurações da Clínica & Pessoal",
    route: "/configuracoes",
    iconName: "Settings",
    description: "Painel de configurações gerais, equipe, modelos de formulários e segurança.",
    helpers: [
      {
        id: "settings-clinic-profile-block",
        name: "Perfil & Identidade Visual",
        description: "Logo, nome fantasia e dados de exibição da clínica.",
        targetSelector: "[data-tutorial='settings-clinic-profile-block']",
      },
      {
        id: "settings-clinic-legal-block",
        name: "Dados Jurídicos & CNPJ",
        description: "Razão social, CNPJ e enquadramento tributário.",
        targetSelector: "[data-tutorial='settings-clinic-legal-block']",
      },
      {
        id: "settings-clinic-address-block",
        name: "Endereço e Unidades",
        description: "Localização física do consultório ou filial.",
        targetSelector: "[data-tutorial='settings-clinic-address-block']",
      },
      {
        id: "settings-team-block",
        name: "Gestão de Equipe",
        description: "Visão geral da equipe de profissionais e colaboradores.",
        targetSelector: "[data-tutorial='settings-team-block']",
      },
      {
        id: "settings-team-invite-block",
        name: "Convite de Membros",
        description: "Envio de convites com definição de permissões.",
        targetSelector: "[data-tutorial='settings-team-invite-block']",
      },
      {
        id: "settings-team-pending-block",
        name: "Convites Pendentes",
        description: "Gerenciamento de convites enviados aguardando aceite.",
        targetSelector: "[data-tutorial='settings-team-pending-block']",
      },
      {
        id: "settings-team-directory-block",
        name: "Diretório de Profissionais",
        description: "Lista completa de colaboradores ativos e alteração de papéis.",
        targetSelector: "[data-tutorial='settings-team-directory-block']",
      },
      {
        id: "settings-team-concurrent-block",
        name: "Sessões Simultâneas",
        description: "Controle de limites de atendimentos simultâneos.",
        targetSelector: "[data-tutorial='settings-team-concurrent-block']",
      },
      {
        id: "settings-team-roles-modal-block",
        name: "Matriz de Permissões",
        description: "Definição de acessos por papel (Dono, Admin, Fisioterapeuta).",
        targetSelector: "[data-tutorial='settings-team-roles-modal-block']",
      },
      {
        id: "settings-profile-personal-block",
        name: "Perfil Pessoal do Profissional",
        description: "Nome, e-mail e dados do profissional conectado.",
        targetSelector: "[data-tutorial='settings-profile-personal-block']",
      },
      {
        id: "settings-profile-license-block",
        name: "Registro Profissional (CREFITO)",
        description: "Número do conselho regional e especialidade.",
        targetSelector: "[data-tutorial='settings-profile-license-block']",
      },
      {
        id: "settings-forms-block",
        name: "Gerenciador de Formulários",
        description: "Modelos de anamnese e fichas de avaliação clínica.",
        targetSelector: "[data-tutorial='settings-forms-block']",
      },
      {
        id: "settings-forms-universal-block",
        name: "Anamnese Universal",
        description: "Formulário padrão aplicado automaticamente a novos pacientes.",
        targetSelector: "[data-tutorial='settings-forms-universal-block']",
      },
      {
        id: "settings-forms-extras-block",
        name: "Formulários Extras",
        description: "Questionários complementares e escalas específicas.",
        targetSelector: "[data-tutorial='settings-forms-extras-block']",
      },
      {
        id: "settings-forms-analytics-block",
        name: "Métricas de Formulários",
        description: "Tempo médio de resposta e taxas de preenchimento.",
        targetSelector: "[data-tutorial='settings-forms-analytics-block']",
      },
      {
        id: "settings-security-personal-block",
        name: "Segurança Pessoal & MFA",
        description: "Autenticação em duas etapas e troca de senha do usuário.",
        targetSelector: "[data-tutorial='settings-security-personal-block']",
      },
      {
        id: "settings-security-clinic-block",
        name: "Políticas de Segurança da Clínica",
        description: "Regras de auditoria e controle de acesso.",
        targetSelector: "[data-tutorial='settings-security-clinic-block']",
      },
      {
        id: "settings-billing-block",
        name: "Assinatura & Faturamento Asaas",
        description: "Plano Pluri-Health ativo e dados de cobrança.",
        targetSelector: "[data-tutorial='settings-billing-block']",
      },
      {
        id: "settings-support-block",
        name: "Central de Suporte",
        description: "Canais de contato direto com o time Pluri-Health.",
        targetSelector: "[data-tutorial='settings-support-block']",
      },
    ],
  },
  {
    id: "editor-formularios",
    title: "Editor de Formulários",
    route: "/configuracoes/formularios/:id",
    iconName: "FileEdit",
    description: "Criador visual de anamneses, escalas de dor e fichas de avaliação.",
    helpers: [
      {
        id: "form-editor-tour",
        name: "Tour do Editor de Formulários",
        description: "Visão geral de cabeçalho, paleta e salvamento de versões.",
        targetSelector: "[data-tutorial='form-editor-tour']",
      },
      {
        id: "form-palette-cat-basicos",
        name: "Paleta: Campos Básicos",
        description: "Campos de texto simples, parágrafo, número, e-mail e telefone.",
        targetSelector: "[data-tutorial='form-palette-cat-basicos']",
      },
      {
        id: "form-palette-cat-opcoes",
        name: "Paleta: Múltipla Escolha & Seleção",
        description: "Caixas de seleção, botões de rádio e menus dropdown.",
        targetSelector: "[data-tutorial='form-palette-cat-opcoes']",
      },
      {
        id: "form-palette-cat-estrutura",
        name: "Paleta: Estrutura & Divisores",
        description: "Títulos de seção, divisores visuais e alertas informativos.",
        targetSelector: "[data-tutorial='form-palette-cat-estrutura']",
      },
      {
        id: "form-palette-cat-especiais",
        name: "Paleta: Componentes Especiais",
        description: "Grade de prescrição em tabela e bloco inteligente de endereço.",
        targetSelector: "[data-tutorial='form-palette-cat-especiais']",
      },
      {
        id: "form-editor-canvas",
        name: "Canvas de Construção",
        description: "Área central de montagem e reordenação dos campos.",
        targetSelector: "[data-tutorial='form-editor-canvas']",
      },
      {
        id: "form-editor-inspector",
        name: "Painel de Propriedades",
        description: "Configuração de obrigatoriedade, opções e regras lógicas.",
        targetSelector: "[data-tutorial='form-editor-inspector']",
      },
    ],
  },
];

export function getHelperDefaultData(helpId: string): {
  title: string;
  description: string;
  tip?: string;
  stepCount: number;
} {
  const found = COMPONENT_HELP_REGISTRY[helpId];
  if (!found) {
    return {
      title: "Ajuda do Componente 💡",
      description: "Este componente faz parte do fluxo operacional da clínica.",
      tip: "",
      stepCount: 1,
    };
  }

  if (Array.isArray(found)) {
    const first = found[0];
    return {
      title: first?.title || "Ajuda do Componente 💡",
      description: first?.description || "",
      tip: first?.tip || "",
      stepCount: found.length,
    };
  }

  return {
    title: found.title || "Ajuda do Componente 💡",
    description: found.description || "",
    tip: found.tip || "",
    stepCount: 1,
  };
}
