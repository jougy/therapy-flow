/**
 * Single Source of Truth (SSOT) para os metadados e tópicos da release beta-26.10.10-01.
 * Compartilhado entre scripts de deploy local, deploy de produção e verificação E2E.
 * Exclui deliberadamente informações internas de Backoffice e governança.
 */
export const RELEASE_BETA_26_10_10_01 = {
  version: "beta-26.10.10-01",
  version_order: 2026101001,
  title: "Therapy-Flow Beta: Multi-Cartão & Renovação em 1-Clique, TCLE na Ficha do Paciente, Mensageria Inteligente e Descontos Oficiais",
  summary:
    "Atualização robusta da plataforma trazendo suporte a múltiplos cartões de crédito salvos (padrão Mercado Livre/Shopee) e renovação rápida de planos em 1-clique; acesso direto e impressão física A4 dos Termos de Consentimento (TCLE Adulto e Menor de Idade) diretamente no cabeçalho do paciente; atualização canônica dos descontos nos ciclos trimestral (-15% OFF) e anual (-35% OFF) com destaque de Plano Ilimitado Ativo; inclusão de linha digitável e código de barras nas faturas em Boleto Bancário; campos inclusivos de identidade no perfil e cadastro; padronização de dicas contextuais dispensáveis e persistência ampliada de sessão no PWA.",
  items: [
    // ADICIONADOS
    {
      category: "added",
      title: "Carteira de Cartões de Crédito Salvos e Renovação Rápida (Padrão 1-Clique)",
      body: "Possibilidade de salvar múltiplos cartões de crédito de forma segura para renovações e pagamentos recorrentes. No checkout, basta escolher o cartão salvo com identificação da bandeira e banco emissor (ex: BTG, Nubank, Itaú) e digitar apenas o código CVV de segurança.",
      sort_order: 10,
    },
    {
      category: "added",
      title: "Acesso Direto aos Termos de Consentimento (TCLE) no Prontuário do Paciente",
      body: "Adicionadas as ações 'Imprimir Termo de Consentimento (Adulto)' e 'Imprimir Termo do Responsável (Menor)' no menu de opções rápidas do paciente, permitindo gerar a versão impressa A4 pronta para assinatura física em 1 clique.",
      sort_order: 20,
    },
    {
      category: "added",
      title: "Linha Digitável e Código de Barras Completo em Faturas por Boleto Bancário",
      body: "Ao gerar faturas de assinatura via boleto, o sistema agora disponibiliza a linha digitável copiada com um toque e o código de barras numérico oficial, agilizando o pagamento pelo aplicativo de qualquer banco.",
      sort_order: 30,
    },
    {
      category: "added",
      title: "Campos Inclusivos de Gênero e Pronome de Preferência no Perfil e Cadastro",
      body: "Possibilidade de informar gênero autodeclarado e pronomes de tratamento de forma opcional (com opção livre de digitação) no cadastro e na edição de perfil pessoal, respeitando a identidade de cada profissional.",
      sort_order: 40,
    },
    {
      category: "added",
      title: "Dicas Contextuais Informativas Dispensáveis (DismissibleInfoTip)",
      body: "Novas caixas de aviso e dicas operacionais sobre LGPD, sigilo profissional, bloco padrão e atalhos de atendimento que podem ser dispensadas após a leitura para liberar espaço na tela.",
      sort_order: 50,
    },

    // ALTERADOS
    {
      category: "changed",
      title: "Descontos Canônicos de Assinatura: Trimestral (-15% OFF) e Anual (-35% OFF)",
      body: "Atualização das condições especiais de contratação na página de planos e no modal de alteração de ciclo, garantindo maior economia aos profissionais e clínicas parceiras.",
      sort_order: 10,
    },
    {
      category: "changed",
      title: "Destaque Visual de 'Plano Ilimitado Ativo' no Painel de Faturamento e Planos",
      body: "Visualização aprimorada da assinatura em vigência com crachá 'Plano Ilimitado Ativo', detalhamento de acessos simultâneos contratados e diferenciação nítida entre planos ativos e expirados.",
      sort_order: 20,
    },
    {
      category: "changed",
      title: "Padronização Canônica para 'Teste Gratuito (7 dias)'",
      body: "Uniformização em todas as telas, tutoriais e avisos da plataforma, garantindo clareza e transparência no período experimental para novos consultórios.",
      sort_order: 30,
    },
    {
      category: "changed",
      title: "Fluxo Otimizado de Checkout Direto para Planos Profissionais Solo",
      body: "A contratação de planos Solo agora direciona o profissional diretamente para o checkout seguro de sua clínica individual provisionada, sem etapas intermediárias desnecessárias.",
      sort_order: 40,
    },

    // REPARADOS
    {
      category: "fixed",
      title: "Impressão Isolada de Termos de Consentimento em Folha A4 (@media print)",
      body: "Correção na camada de impressão que isola completamente o documento no padrão A4 em folha limpa, evitando elementos sobrepostos ou cortes em tabelas de identificação e linhas de assinatura.",
      sort_order: 10,
    },
    {
      category: "fixed",
      title: "Barra de Seleção de Porte de Equipe em Telas Claras e Escuras",
      body: "Substituição do controle seletor de planos por controle interativo com contraste perfeito em temas claro e escuro, facilitando a navegação táctil no smartphone e desktop.",
      sort_order: 20,
    },
    {
      category: "fixed",
      title: "Resiliência e Persistência de Sessão e Clínica Ativa no PWA / Smartphone",
      body: "Aprimoramento no armazenamento da clínica em uso e autenticação, garantindo que o profissional permaneça conectado na clínica correta ao reabrir o aplicativo PWA instalado no smartphone.",
      sort_order: 30,
    },
    {
      category: "fixed",
      title: "Ergonomia dos Campos de Horário de Chegada e Início do Atendimento no Mobile",
      body: "Ajuste no cabeçalho dos campos de data e horário do atendimento e presença, realocando o botão 'Agora' para evitar estouro horizontal em aparelhos compactos (375px a 390px).",
      sort_order: 40,
    },
    {
      category: "fixed",
      title: "Estabilidade no Registro Histórico e Conclusão de Atendimentos Clínicos",
      body: "Blindagem na persistência de alterações de presenças e atendimentos no prontuário, garantindo salvamento fluido e contínuo mesmo com oscilações temporárias de conexão.",
      sort_order: 50,
    },
  ],
};
