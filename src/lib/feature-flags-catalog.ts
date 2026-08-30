export type FeatureFlagCategory = 
  | 'Governança'
  | 'Storage/Arquivos'
  | 'Notificações'
  | 'Dashboards'
  | 'Formulários'
  | 'Prontuário/Atendimentos'
  | 'Impressão'
  | 'UI/Experiência'
  | 'Tutoriais & Ajuda'
  | 'Assinaturas';

export interface FeatureFlagDefinition {
  key: string;
  label: string;
  description: string;
  category: FeatureFlagCategory;
  hasConfiguration: boolean;
  hasToggle?: boolean;
}

export const featureFlagsCatalog: FeatureFlagDefinition[] = [
  // Assinaturas & Financeiro
  {
    key: 'subscriptions_module',
    label: 'Módulo de Assinaturas e Cobrança',
    description: 'Controla a exibição e funcionamento global do sistema de faturamento recorrente, catálogo de planos (/planos), checkout e faturamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_free_trial_enabled',
    label: 'Degustação Gratuita (Free Tier / Trial)',
    description: 'Habilita o período e cota de degustação gratuita no onboarding e seleção de planos sem exigir cartão de crédito inicial.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_payment_methods',
    label: 'Métodos de Pagamento (PIX, Cartão, Boleto)',
    description: 'Configura e habilita os métodos de pagamento suportados no checkout com as respectivas regras de desconto e parcelamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_coupons_enabled',
    label: 'Cupons de Desconto Promocionais',
    description: 'Habilita a validação e aplicação de cupons promocionais na página de planos e no checkout oficial da plataforma.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  // Storage/Arquivos
  {
    key: 'storage_s3_integration',
    label: 'Anexo de Arquivos & Mídias (Storage)',
    description: 'Habilita o módulo de anexo de documentos, PDFs e imagens clínicas de pacientes e atendimentos.',
    category: 'Storage/Arquivos',
    hasConfiguration: true,
  },
  
  // Notificações (Adicionado para preencher a categoria, caso hajam features futuras ou para o lab)
  {
    key: 'notifications_email_sms',
    label: 'Notificações por Email/SMS',
    description: 'Habilita o envio de lembretes e notificações transacionais aos pacientes via Email e SMS.',
    category: 'Notificações',
    hasConfiguration: true,
  },

  // Dashboards
  {
    key: 'dashboards_general',
    label: 'Dashboard Geral',
    description: 'Habilita a visualização do painel de métricas e gráficos gerais da clínica.',
    category: 'Dashboards',
    hasConfiguration: false,
  },
  {
    key: 'dashboards_user',
    label: 'Dashboard do Usuário',
    description: 'Habilita a área de métricas individuais para o profissional (usuário logado).',
    category: 'Dashboards',
    hasConfiguration: false,
  },
  {
    key: 'dashboards_patient',
    label: 'Dashboard do Paciente',
    description: 'Habilita gráficos de evolução e sumário de dados no perfil do paciente.',
    category: 'Dashboards',
    hasConfiguration: true,
  },

  // Formulários
  {
    key: 'forms_creator',
    label: 'Criador de Formulários',
    description: 'Ativa o módulo de criação dinâmica de formulários (anamnese, evolução, etc).',
    category: 'Formulários',
    hasConfiguration: false,
  },
  {
    key: 'forms_download_upload',
    label: 'Permissões de Download/Upload em Formulários',
    description: 'Permite que formulários preenchidos possam ser baixados em PDF ou anexem arquivos.',
    category: 'Formulários',
    hasConfiguration: true,
  },

  // Prontuário/Atendimentos
  {
    key: 'records_summary_blocks',
    label: 'Configuração de Blocos de Resumo',
    description: 'Permite customizar e ordenar os blocos de resumo exibidos na tela principal do prontuário.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
  },
  {
    key: 'clinic_sessions_list',
    label: 'Lista Geral de Atendimentos',
    description: 'Habilita a visualização da lista geral de atendimentos na página principal da clínica, com opções avançadas de edição.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
  },

  // Impressão & Segurança
  {
    key: 'anti_print_protection',
    label: 'Proteção Anti-Print Screen (Captura de Tela)',
    description: 'Bloqueia atalhos de captura de tela, desfoca a página e registra auditoria com selo de data/hora no Backoffice para rotas protegidas.',
    category: 'Impressão',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'print_general',
    label: 'Permitir Impressões no Sistema (Opção Global)',
    description: 'Habilita ou desabilita globalmente todas as rotinas e botões de impressão em papel e exportação física na plataforma.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'print_clinic_stats',
    label: 'Impressão de Estatísticas da Clínica',
    description: 'Exibe ou oculta o botão de impressão personalizada de relatórios e blocos de estatísticas da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'forms_blank_print',
    label: 'Impressão de Fichas em Branco (Kit Offline)',
    description: 'Exibe ou oculta o botão de impressão de modelos e fichas de atendimento/cadastro em branco no gerenciador de formulários da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'records_print_layout',
    label: 'Layout de Impressão do Prontuário',
    description: 'Habilita configurações avançadas de layout (cabeçalho, rodapé, logo) para impressão do prontuário.',
    category: 'Impressão',
    hasConfiguration: true,
  },
  {
    key: 'records_session_print',
    label: 'Impressão de Documentos de Atendimento',
    description: 'Exibe ou oculta a opção de impressão de atestados, receitas, declarações e evoluções de atendimentos.',
    category: 'Impressão',
    hasConfiguration: false,
  },

  // Governança & Compliance
  {
    key: 'terms_of_service_management',
    label: 'Termos de Uso e Consentimento',
    description: 'Gerenciamento dos Termos de Uso (Owner/Usuários, BR e Internacional, Responsabilidade de Impressão) e disparo de obrigatoriedade.',
    category: 'Governança',
    hasConfiguration: true,
    hasToggle: false,
  },
  {
    key: 'require_owner_terms_on_clinic_creation',
    label: 'Exigir Termos de Consentimento do Titular na Criação de Clínica',
    description: 'Exige o consentimento explícito dos Termos de Uso e Responsabilidade do Titular antes de criar um novo espaço.',
    category: 'Governança',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'ui_animations_toggle',
    label: 'Ligar/Desligar Animações UI',
    description: 'Habilita opções para o usuário final reduzir ou desligar micro-animações do sistema.',
    category: 'UI/Experiência',
    hasConfiguration: false,
  },
  {
    key: 'ui_advanced_settings',
    label: 'Configurações Avançadas de UI',
    description: 'Libera temas extras e opções de densidade visual na interface da plataforma.',
    category: 'UI/Experiência',
    hasConfiguration: true,
  },

  // Tutoriais & Ajuda
  {
    key: 'tutorial_training_center',
    label: 'Central de Treinamento & Mini Cursos',
    description: 'Habilita o botão de Guia/Tutorial, a Central de Treinamento com mini cursos em capítulos e o assistente de jornada linear.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'system_helpers',
    label: 'Botões de Ajuda Rápida & Helpers Contextuais (?)',
    description: 'Controla a exibição dos botões de interrogação (?) com explicações contextuais por página, permitindo ocultar/exibir itens e editar as mensagens de ajuda.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: true,
    hasToggle: true,
  },
];

