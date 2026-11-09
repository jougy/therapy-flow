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
  | 'Assinaturas'
  | 'Agenda'
  | 'Marketing';

export interface FeatureFlagDefinition {
  key: string;
  label: string;
  description: string;
  category: FeatureFlagCategory;
  hasConfiguration: boolean;
  hasToggle?: boolean;
  completionPercentage?: number;
}

export const featureFlagsCatalog: FeatureFlagDefinition[] = [
  // Agenda da Clínica
  {
    key: 'agenda_module',
    label: 'Módulo da Agenda Clínica',
    description: 'Controla a exibição e funcionamento global da agenda clínica (/clinica/:clinicKey/agenda), widget na home e atalhos rápidos de compromissos.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'agenda_night_dawn_shift',
    label: 'Turno de Madrugada (00h00 às 06h59)',
    description: 'Habilita o 4º bloco de horários na visão diária e semanal cobrindo as 24 horas contínuas sem lacunas (Madrugada 00:00–06:59).',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 10,
  },
  {
    key: 'agenda_conflict_warning',
    label: 'Alerta de Conflitos e Sobreposições em Tempo Real',
    description: 'Exibe banner de aviso em tempo real no modal de agendamento ao selecionar horários que colidem com outros compromissos ativos do dia.',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'agenda_slot_condenser',
    label: 'Motor de Blocos Condensados de Horários Livres',
    description: 'Agrupa lacunas contíguas de horários disponíveis em botões compactos de agendamento direto com um clique, substituindo colunas extensas vazias.',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 15,
  },
  {
    key: 'agenda_master_onboarding',
    label: 'Agenda Master de Onboarding (Backoffice)',
    description: 'Agendamentos estratégicos de demonstração, onboarding e alinhamento de clínicas com a equipe Pluri Health.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'agenda_whatsapp_booking_flow',
    label: 'Agendamento Interativo via Bot WhatsApp',
    description: 'Fluxo interativo conversacional no WhatsApp para marcação automatizada de consultas e reuniões.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'agenda_google_calendar_sync',
    label: 'Sincronização em Tempo Real com Google Calendar (iCal)',
    description: 'Integração bidirecional e feed iCal com o Google Calendar e calendários externos.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'agenda_smart_blocks_buffers',
    label: 'Bloqueios Inteligentes & Margem de Segurança (Buffers)',
    description: 'Intervalos automáticos de respiro entre atendimentos, bloqueio de almoço e descansos programados.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  // Assinaturas & Financeiro
  {
    key: 'subscriptions_module',
    label: 'Módulo de Assinaturas e Cobrança',
    description: 'Controla a exibição e funcionamento global do sistema de faturamento recorrente, catálogo de planos (/planos), checkout e faturamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'subscription_free_trial_enabled',
    label: 'Teste Gratuito (Free Tier / Trial)',
    description: 'Habilita o período e cota de teste gratuito no onboarding e seleção de planos sem exigir cartão de crédito inicial.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'subscription_payment_methods',
    label: 'Métodos de Pagamento (PIX, Cartão, Boleto)',
    description: 'Configura e habilita os métodos de pagamento suportados no checkout com as respectivas regras de desconto e parcelamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'subscription_coupons_enabled',
    label: 'Cupons de Desconto Promocionais',
    description: 'Habilita a validação e aplicação de cupons promocionais na página de planos e no checkout oficial da plataforma.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  // Storage/Arquivos
  {
    key: 'storage_s3_integration',
    label: 'Anexo de Arquivos & Mídias (Storage)',
    description: 'Habilita o módulo de anexo de documentos, PDFs e imagens clínicas de pacientes e atendimentos.',
    category: 'Storage/Arquivos',
    hasConfiguration: true,
    completionPercentage: 100,
  },
  
  // Notificações (Adicionado para preencher a categoria, caso hajam features futuras ou para o lab)
  {
    key: 'notifications_email_sms',
    label: 'Notificações por Email/SMS',
    description: 'Habilita o envio de lembretes e notificações transacionais aos pacientes via Email e SMS.',
    category: 'Notificações',
    hasConfiguration: true,
    completionPercentage: 15,
  },
  {
    key: 'notifications_whatsapp_onboarding',
    label: 'WhatsApp: Boas-Vindas & Onboarding Automático',
    description: 'Disparo automático de boas-vindas, orientações iniciais e link de primeiro acesso para novos usuários via WhatsApp.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'notifications_whatsapp_transbordo',
    label: 'WhatsApp: Transbordo para Comercial Humano',
    description: 'Roteamento inteligente e transbordo de leads e clientes com dúvidas para o atendimento comercial humano oficial.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'notifications_whatsapp_billing',
    label: 'WhatsApp: Confirmação de Assinaturas & Upgrade (Asaas)',
    description: 'Notificações automáticas de confirmação de pagamento, liberação de planos e avisos de renovação/upgrade via Asaas.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'notifications_telegram_admin',
    label: 'Telegram: Alertas em Tempo Real do Administrador',
    description: 'Canal de telemetria e bot do Telegram para a diretoria receber eventos críticos (novos cadastros, pagamentos e incidentes).',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'whatsapp_flows_enabled',
    label: 'WhatsApp Flows (Formulários Nativos Deslizantes)',
    description: 'Ativa o preenchimento interativo de fichas e triagem via WhatsApp Flows nativo deslizante da Meta, com fallback inteligente para chat.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'notifications_patient_reminders',
    label: 'Lembretes de Consultas e Atendimentos (WhatsApp/SMS)',
    description: 'Envio programado de confirmação e lembretes de sessões para pacientes com antecedência configurável.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },

  // Dashboards
  {
    key: 'dashboards_general',
    label: 'Dashboard Geral',
    description: 'Habilita a visualização do painel de métricas e gráficos gerais da clínica.',
    category: 'Dashboards',
    hasConfiguration: false,
    completionPercentage: 100,
  },
  {
    key: 'dashboards_user',
    label: 'Dashboard do Usuário',
    description: 'Habilita a área de métricas individuais para o profissional (usuário logado).',
    category: 'Dashboards',
    hasConfiguration: false,
    completionPercentage: 15,
  },
  {
    key: 'dashboards_patient',
    label: 'Dashboard do Paciente',
    description: 'Habilita gráficos de evolução e sumário de dados no perfil do paciente.',
    category: 'Dashboards',
    hasConfiguration: true,
    completionPercentage: 100,
  },

  // Formulários
  {
    key: 'forms_creator',
    label: 'Criador de Formulários',
    description: 'Ativa o módulo de criação dinâmica de formulários (anamnese, evolução, etc).',
    category: 'Formulários',
    hasConfiguration: false,
    completionPercentage: 100,
  },
  {
    key: 'forms_editor',
    label: 'Editor de Formulários',
    description: 'Controla a disponibilidade de componentes da paleta, propriedades dos campos, menus do editor e opções interativas no construtor de formulários.',
    category: 'Formulários',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'forms_download_upload',
    label: 'Permissões de Download/Upload em Formulários',
    description: 'Permite que formulários preenchidos possam ser baixados em PDF ou anexem arquivos.',
    category: 'Formulários',
    hasConfiguration: true,
    completionPercentage: 15,
  },

  // Prontuário/Atendimentos
  {
    key: 'records_summary_blocks',
    label: 'Configuração de Blocos de Resumo',
    description: 'Permite customizar e ordenar os blocos de resumo exibidos na tela principal do prontuário.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
    completionPercentage: 15,
  },
  {
    key: 'clinic_sessions_list',
    label: 'Lista Geral de Atendimentos',
    description: 'Habilita a visualização da lista geral de atendimentos na página principal da clínica, com opções avançadas de edição.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
    completionPercentage: 100,
  },

  // Impressão & Segurança
  {
    key: 'anti_print_protection',
    label: 'Proteção Anti-Print Screen (Captura de Tela)',
    description: 'Bloqueia atalhos de captura de tela, desfoca a página e registra auditoria com selo de data/hora no Backoffice para rotas protegidas.',
    category: 'Impressão',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'print_general',
    label: 'Permitir Impressões no Sistema (Opção Global)',
    description: 'Habilita ou desabilita globalmente todas as rotinas e botões de impressão em papel e exportação física na plataforma.',
    category: 'Impressão',
    hasConfiguration: false,
    completionPercentage: 100,
  },
  {
    key: 'print_clinic_stats',
    label: 'Impressão de Estatísticas da Clínica',
    description: 'Exibe ou oculta o botão de impressão personalizada de relatórios e blocos de estatísticas da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
    completionPercentage: 100,
  },
  {
    key: 'forms_blank_print',
    label: 'Impressão de Fichas em Branco (Kit Offline)',
    description: 'Exibe ou oculta o botão de impressão de modelos e fichas de atendimento/cadastro em branco no gerenciador de formulários da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
    completionPercentage: 15,
  },
  {
    key: 'records_print_layout',
    label: 'Layout de Impressão do Prontuário',
    description: 'Habilita configurações avançadas de layout (cabeçalho, rodapé, logo) para impressão do prontuário.',
    category: 'Impressão',
    hasConfiguration: true,
    completionPercentage: 15,
  },
  {
    key: 'records_session_print',
    label: 'Impressão de Documentos de Atendimento',
    description: 'Exibe ou oculta a opção de impressão de atestados, receitas, declarações e evoluções de atendimentos.',
    category: 'Impressão',
    hasConfiguration: false,
    completionPercentage: 100,
  },

  // Governança & Compliance
  {
    key: 'terms_of_service_management',
    label: 'Termos de Uso e Consentimento',
    description: 'Gerenciamento dos Termos de Uso (Owner/Usuários, BR e Internacional, Responsabilidade de Impressão, Menor de Idade LGPD) e disparo de obrigatoriedade.',
    category: 'Governança',
    hasConfiguration: true,
    hasToggle: false,
    completionPercentage: 100,
  },
  {
    key: 'require_owner_terms_on_clinic_creation',
    label: 'Exigir Termos de Consentimento do Titular na Criação de Clínica',
    description: 'Exige o consentimento explícito dos Termos de Uso e Responsabilidade do Titular antes de criar um novo espaço.',
    category: 'Governança',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'observability_multicloud_engine',
    label: 'Motor de Telemetria Multicloud & Proteção de Disk I/O (10k+ CCU)',
    description: 'Controla o roteamento da matriz canônica de tempo por tela (Upstash Redis / Buffer Local / Supabase Batch), ingestão de erros (Axiom 500GB Free / Buffer Local), sanitizador LGPD Zero-PHI e taxa de amostragem para alta escala.',
    category: 'Governança',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'ui_animations_toggle',
    label: 'Ligar/Desligar Animações UI',
    description: 'Habilita opções para o usuário final reduzir ou desligar micro-animações do sistema.',
    category: 'UI/Experiência',
    hasConfiguration: false,
    completionPercentage: 15,
  },
  {
    key: 'ui_advanced_settings',
    label: 'Configurações Avançadas de UI',
    description: 'Libera temas extras e opções de densidade visual na interface da plataforma.',
    category: 'UI/Experiência',
    hasConfiguration: true,
    completionPercentage: 15,
  },
  {
    key: 'clinical_portfolio_enabled',
    label: 'Portfólio Clínico Profissional (Acervo Pessoal)',
    description: 'Habilita o acervo técnico seguro e o histórico de atendimentos realizados sob a responsabilidade do profissional no Espaço Pessoal (/espacopessoal).',
    category: 'UI/Experiência',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },

  // Tutoriais & Ajuda
  {
    key: 'tutorial_training_center',
    label: 'Central de Treinamento & Mini Cursos',
    description: 'Habilita o botão de Guia/Tutorial, a Central de Treinamento com mini cursos em capítulos e o assistente de jornada linear.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 100,
  },
  {
    key: 'system_helpers',
    label: 'Botões de Ajuda Rápida & Helpers Contextuais (?)',
    description: 'Controla a exibição dos botões de interrogação (?) com explicações contextuais por página, permitindo ocultar/exibir itens e editar as mensagens de ajuda.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: true,
    hasToggle: true,
    completionPercentage: 100,
  },

  // Marketing & Afiliados
  {
    key: 'marketing_affiliates_module',
    label: 'Módulo Central de Afiliados & Parcerias',
    description: 'Controla a exibição e funcionamento global do ecossistema de parceiros e afiliados, links nominais e subcontas.',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 15,
  },
  {
    key: 'marketing_backoffice_invite_affiliate',
    label: 'Conversão de Usuário em Afiliado (Backoffice Master)',
    description: 'Permite ao administrador convidar ou transformar usuários comuns em parceiros afiliados pelo diretório da plataforma (/platform).',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 10,
  },
  {
    key: 'marketing_affiliate_onboarding_form',
    label: 'Formulário de Onboarding & Aceite dos Termos de Afiliado',
    description: 'Fluxo de credenciamento do parceiro: dados bancários, e-mail fiscal para NFTS, validação 2FA obrigatória e aceite do Termo de Adesão.',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 20,
  },
  {
    key: 'marketing_asaas_split_engine',
    label: 'Motor de Split Nativo Asaas & Subcontas (MEI R$ 81k)',
    description: 'Provisionamento automático de subcontas no Asaas e divisão de comissão pré-crédito sem contaminação do teto MEI.',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 5,
  },
  {
    key: 'marketing_affiliate_portal',
    label: 'Portal do Afiliado (Desempenho, Hook e Registro)',
    description: 'Painel do parceiro com 3 abas operacionais: Métricas de conversão, Central de Links/Cupons e Dados cadastrais com proteção 2FA.',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 10,
  },
  {
    key: 'marketing_coupon_landing_page',
    label: 'Checkout com Cupom Nominal de Afiliado na Landing Page',
    description: 'Validação e aplicação nativa de cupons (?cupom=CODIGO) no checkout, com desconto de entrada e elegibilidade vitalícia da 1ª compra.',
    category: 'Marketing',
    hasConfiguration: false,
    hasToggle: true,
    completionPercentage: 15,
  },
];

// Re-export das tipagens e configuracoes modulares de flags
export * from "./feature-flags-configs";
