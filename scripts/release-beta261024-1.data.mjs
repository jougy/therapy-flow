/**
 * Single Source of Truth (SSOT) para os metadados e tópicos da release beta-26.10.24-1.
 * Compartilhado entre scripts de deploy local, deploy de produção e documentação.
 * Exclui deliberadamente informações internas de Backoffice e governança administrativa restrita.
 */
export const RELEASE_BETA_26_10_24_1 = {
  version: "beta-26.10.24-1",
  version_order: 2026102401,
  title: "Therapy-Flow Beta: Corretor Ortográfico Clínico, Anotações Visuais em Imagens, Agenda Multi-Turno & Notificações Acústicas",
  summary:
    "Grande atualização da plataforma trazendo o novo motor de Correção Ortográfica Clínica offline (Typo.js/Web Worker) com dicionário federado e termos de saúde; estúdio de anotações e demarcações clínicas em fotos de evolução com régua de dor e severidade; painel multi-turno na Agenda semanal (Madrugada, Manhã, Tarde e Noite) com alarmes sonoros configuráveis; módulo de convites idempotentes com papéis dinâmicos e suporte a convênio de saúde; e persistência otimizada com arquitetura modular ultra-rápida.",
  items: [
    // ADICIONADOS (added)
    {
      category: "added",
      title: "Engine de Corretor Ortográfico Clínico em Tempo Real (Typo.js + IndexedDB)",
      body: "Correção ortográfica inteligente integrada aos campos de conduta, evolução e anamnese. Processamento 100% no navegador via Web Worker sem lentidão na digitação, com suporte a termos médicos/fisioterápicos e persistência de dicionário offline.",
      sort_order: 10,
    },
    {
      category: "added",
      title: "Estúdio de Demarcação e Anotações Clínicas em Imagens de Evolução",
      body: "Novo editor vetorial para fotos de exames e posturas corporais: adicione setas, linhas de tração, marca-texto, círculos e pins de dor com slider gradiente de severidade (do verde ao roxo) e notas contextuais detalhadas.",
      sort_order: 20,
    },
    {
      category: "added",
      title: "Filtros Multi-Turno na Agenda Semanal (Madrugada, Manhã, Tarde e Noite)",
      body: "Navegação ágil e visual nos cards de dias da semana na Agenda. Botões interativos para filtrar múltiplos turnos simultaneamente com totalizadores de horários e limpeza em um toque.",
      sort_order: 30,
    },
    {
      category: "added",
      title: "Central de Notificações com Toques Acústicos e Modo Alarme Clínico",
      body: "Configuração pessoal de toques com biblioteca de sons sintetizados via Web Audio API (Suave, Chime, Pulso, Alarme Clínico e Sirene). Inclui prévia sonora instantânea e alarmes contínuos com parada automática em aba cruzada via BroadcastChannel.",
      sort_order: 40,
    },
    {
      category: "added",
      title: "Dock Dupla de Acesso Rápido e Seleção Long-Press no Mobile",
      body: "Nova barra ergonômica inferior no smartphone com gestos de toque longo (long-press com vibração tátil haptic) para menu rápido de ações em pacientes e navegação fluida em telas compactas (375px/390px).",
      sort_order: 50,
    },
    {
      category: "added",
      title: "Módulo Universal de Convênios de Saúde e Planos de Atendimento",
      body: "Suporte completo à associação de convênios médicos nos cadastros de pacientes e agendamentos, com controle transparente de guias, autorizações e modalidades de faturamento.",
      sort_order: 60,
    },

    // ALTERADOS (changed)
    {
      category: "changed",
      title: "Fluxo de Aceite Idempotente e Branding em Convites de Colaboradores",
      body: "Página pública de convite (/convite) remodelada com suporte dinâmico a cargos e permissões personalizadas, detecção automática do usuário conectado, validação de e-mail e exibição clara da clínica anfitriã.",
      sort_order: 10,
    },
    {
      category: "changed",
      title: "Visualização Mensal da Agenda com Painel Lateral Contextual e Fuso Horário",
      body: "Grade do mês compactada com painel lateral dinâmico de detalhes do dia selecionado, suporte nativo ao fuso horário de origem e badges com cores específicas por tipo de evento.",
      sort_order: 20,
    },
    {
      category: "changed",
      title: "Aprimoramento Visual nos Cards de Atendimento e Abreviatura Ergonômica",
      body: "Exibição elegante e compacta dos nomes dos profissionais responsáveis nos atendimentos históricos para evitar estouro de texto, além de botões diretos de evolução rápida e vínculo a grupos de tratamento.",
      sort_order: 30,
    },
    {
      category: "changed",
      title: "Compatibilidade Expandida para Contas e Assinaturas Cortesia Parceira",
      body: "Regras de verificação de quotas de planos atualizadas para reconhecer assinaturas de parceria institucional e cortesia sem emitir alertas indevidos de bloqueio ou expiração.",
      sort_order: 40,
    },

    // REPARADOS (fixed)
    {
      category: "fixed",
      title: "Desmonolitização de Componentes e Otimização Extrema de Carregamento",
      body: "Refatoração profunda da arquitetura do frontend dividindo páginas pesadas em submódulos indexados (Formulários, Agenda, Detalhe do Paciente e Detalhe da Sessão), reduzindo o bundle inicial e acelerando a abertura das telas.",
      sort_order: 10,
    },
    {
      category: "fixed",
      title: "Integridade Transacional e Blindagem de Políticas RLS no Prontuário",
      body: "Ajuste na camada de persistência de histórico de sessões e integridade referencial clínica-paciente-sessão, prevenindo interrupções ou descompassos em conexões instáveis.",
      sort_order: 20,
    },
    {
      category: "fixed",
      title: "Prevenção de Quebras de Layout e Bloqueio de Overflow em Viewports Móveis",
      body: "Remoção de contenções fixas e ajustes em modais de atendimento com vaul/bottom sheets, garantindo rolagem vertical suave e touch targets mínimos de 44x44px em iPhones e Androids.",
      sort_order: 30,
    },
    {
      category: "fixed",
      title: "Resiliência na Autenticação em 2 Etapas (2FA) e Desbloqueio de Sessões",
      body: "Tratamento aprimorado de fluxos de login com verificação rápida, contingência em caso de atraso de mensagens e prevenção de sessões duplicadas no aplicativo.",
      sort_order: 40,
    },
  ],
};
