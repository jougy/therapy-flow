export interface FeedbackQuestion {
  id: string;
  category: "usability" | "satisfaction" | "performance" | "routine" | "features" | "mobile";
  text: string;
  shortLabel: string;
}

export const FEEDBACK_QUESTIONS_POOL: FeedbackQuestion[] = [
  {
    id: "general_satisfaction",
    category: "satisfaction",
    text: "Qual é o seu nível de satisfação geral ao utilizar a plataforma?",
    shortLabel: "Satisfação Geral",
  },
  {
    id: "daily_routine_facilitation",
    category: "routine",
    text: "O quanto o sistema tem facilitado e agilizado a sua rotina no dia a dia?",
    shortLabel: "Facilitação da Rotina",
  },
  {
    id: "navigation_simplicity",
    category: "usability",
    text: "O quanto você considera simples e intuitivo encontrar o que precisa?",
    shortLabel: "Navegação e Menus",
  },
  {
    id: "loading_speed",
    category: "performance",
    text: "Como você avalia a velocidade e fluidez de carregamento das telas?",
    shortLabel: "Velocidade de Carregamento",
  },
  {
    id: "clinical_session_experience",
    category: "features",
    text: "Como é a sua experiência ao registrar e gerenciar os atendimentos e prontuários?",
    shortLabel: "Registro de Atendimentos",
  },
  {
    id: "anamnesis_forms_clarity",
    category: "features",
    text: "Qual é o nível de clareza e praticidade ao usar formulários e fichas de anamnese?",
    shortLabel: "Fichas de Anamnese",
  },
  {
    id: "agenda_ease",
    category: "routine",
    text: "Quão fácil é organizar seus horários e compromissos na agenda da clínica?",
    shortLabel: "Agenda de Horários",
  },
  {
    id: "security_and_privacy_trust",
    category: "satisfaction",
    text: "Quanto você se sente seguro(a) com a proteção e privacidade dos dados clínicos?",
    shortLabel: "Segurança e Privacidade",
  },
  {
    id: "mobile_usability",
    category: "mobile",
    text: "Como é a sua experiência ao acessar ou utilizar a plataforma pelo celular?",
    shortLabel: "Uso no Celular (Mobile)",
  },
  {
    id: "layout_visual_quality",
    category: "usability",
    text: "Qual é a sua avaliação sobre a organização visual e o design das telas?",
    shortLabel: "Design e Visual",
  },
  {
    id: "financial_controls_experience",
    category: "features",
    text: "Como você avalia os recursos de controle financeiro e cobranças?",
    shortLabel: "Controle Financeiro",
  },
  {
    id: "onboarding_and_learning",
    category: "usability",
    text: "Quão rápida e tranquila foi a sua curva de aprendizado nos primeiros acessos?",
    shortLabel: "Facilidade de Aprendizado",
  },
  {
    id: "time_saved_estimation",
    category: "routine",
    text: "Quanto tempo você sente que economiza em tarefas manuais com o sistema?",
    shortLabel: "Economia de Tempo",
  },
  {
    id: "patient_management_ease",
    category: "routine",
    text: "Como você classifica a facilidade para cadastrar, editar e buscar pacientes?",
    shortLabel: "Gestão de Pacientes",
  },
  {
    id: "notifications_clarity",
    category: "usability",
    text: "As notificações e avisos do sistema são claros e úteis para o seu dia a dia?",
    shortLabel: "Notificações do Sistema",
  },
  {
    id: "team_collaboration_ease",
    category: "routine",
    text: "Quão prático é colaborar com outros membros da equipe ou estagiários na clínica?",
    shortLabel: "Colaboração em Equipe",
  },
  {
    id: "system_stability",
    category: "performance",
    text: "Como você avalia a estabilidade geral da plataforma (ausência de travamentos)?",
    shortLabel: "Estabilidade do Sistema",
  },
  {
    id: "document_print_export",
    category: "features",
    text: "Como é a qualidade e facilidade para imprimir ou exportar prontuários em PDF?",
    shortLabel: "Exportação e Impressão",
  },
  {
    id: "clinic_switching_simplicity",
    category: "usability",
    text: "Quão simples é alternar entre suas clínicas ou seu espaço pessoal?",
    shortLabel: "Alternar Clínicas",
  },
  {
    id: "data_reliability_confidence",
    category: "satisfaction",
    text: "Qual é o seu nível de confiança de que suas informações estão sempre salvas?",
    shortLabel: "Confiança nos Dados",
  },
  {
    id: "dashboard_charts_usefulness",
    category: "features",
    text: "O quanto os gráficos e estatísticas do Dashboard ajudam na sua tomada de decisão?",
    shortLabel: "Gráficos do Dashboard",
  },
  {
    id: "account_settings_clarity",
    category: "usability",
    text: "Quão fácil é alterar suas configurações pessoais, senha e preferências de perfil?",
    shortLabel: "Configurações de Conta",
  },
  {
    id: "profession_fit",
    category: "satisfaction",
    text: "O quanto a plataforma atende perfeitamente às particularidades da sua área de atuação?",
    shortLabel: "Aderência à sua Área",
  },
  {
    id: "error_messages_helpfulness",
    category: "usability",
    text: "Quando ocorre algum erro ou preenchimento incorreto, as instruções são claras?",
    shortLabel: "Mensagens de Orientação",
  },
  {
    id: "patient_link_sharing",
    category: "features",
    text: "Quão prático é gerar e enviar formulários públicos para os pacientes preencherem?",
    shortLabel: "Envio de Links a Pacientes",
  },
  {
    id: "tabs_and_filters_organization",
    category: "usability",
    text: "Como você avalia a organização das abas e filtros de busca por pacientes e status?",
    shortLabel: "Filtros e Organização",
  },
  {
    id: "stress_reduction_routine",
    category: "routine",
    text: "O quanto o sistema reduz a sobrecarga e o estresse na gestão dos prontuários?",
    shortLabel: "Redução de Sobrecarga",
  },
  {
    id: "customization_options",
    category: "features",
    text: "Como você avalia as opções de customização de cores, tags e dados da clínica?",
    shortLabel: "Opções de Customização",
  },
  {
    id: "recommendation_likelihood",
    category: "satisfaction",
    text: "Qual é a probabilidade de você recomendar a plataforma para outro profissional?",
    shortLabel: "Recomendação a Colegas",
  },
  {
    id: "modern_evolution_feeling",
    category: "satisfaction",
    text: "Como você percebe a modernidade e evolução contínua da plataforma?",
    shortLabel: "Evolução e Modernidade",
  },
];

/**
 * Sorteia N perguntas (padrão: 5) de categorias distintas ou balanceadas
 */
export function pickRandomFeedbackQuestions(count = 5): FeedbackQuestion[] {
  const pool = [...FEEDBACK_QUESTIONS_POOL];
  // Algoritmo Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
