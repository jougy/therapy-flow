/**
 * Single Source of Truth (SSOT) para os metadados e tópicos da release beta-26.09.17-01.
 * Compartilhado entre scripts de deploy local, deploy de produção e verificação E2E.
 */
export const RELEASE_BETA_26_09_17_01 = {
  version: "beta-26.09.17-01",
  version_order: 2026091701,
  title: "Therapy-Flow Beta: Linha Completa de Atendimento, Cobrança Transparente & Gestão Clínica",
  summary:
    "Marco inaugural da versão Beta da plataforma! Atingimos a maturidade da jornada completa de ponta a ponta: cadastro inteligente com busca por CEP, relatórios e laudos para impressão, fluxo de consentimento de menores, novos planos de assinatura com checkout transparente e cupons, controle granular de permissões de equipe e editor dinâmico de fichas clínicas.",
  items: [
    {
      category: "added",
      title: "Preenchimento Automático de Endereço via CEP",
      body: "Ao digitar o CEP no cadastro de pacientes, os campos de logradouro, bairro, cidade e UF são preenchidos instantaneamente via integração em tempo real, agilizando a recepção e prevenindo erros de digitação.",
      sort_order: 10,
    },
    {
      category: "added",
      title: "Cupons de Desconto Promocionais e Flexibilidade de Checkout",
      body: "Suporte completo à aplicação de cupons percentuais e de valor fixo no checkout transparente de assinaturas e faturas da clínica.",
      sort_order: 20,
    },
    {
      category: "added",
      title: "Controle Granular de Permissões de Equipe (RBAC)",
      body: "Gerenciamento detalhado de funções e níveis de acesso personalizados para secretárias, estagiários, terapeutas e administradores da clínica.",
      sort_order: 30,
    },
    {
      category: "added",
      title: "Termos de Responsabilidade e Consentimento de Menores (LGPD/CFM)",
      body: "Fluxo completo de autorização para atendimento de pacientes menores de idade com assinatura presencial, link de consentimento online e impressão de comprovante para conformidade jurídica estrita.",
      sort_order: 40,
    },
    {
      category: "added",
      title: "Editor Dinâmico de Fichas de Avaliação e Anamnese (DesignLab)",
      body: "Novo motor de criação de formulários clínicos customizados com componentes arrastáveis, campos modulares e pré-visualização em tempo real.",
      sort_order: 50,
    },
    {
      category: "changed",
      title: "Transição Oficial para a Fase Beta da Plataforma",
      body: "Consolidação de toda a jornada principal de atendimento: cadastro, agendamento, prontuários, evoluções de sessões, pacotes e faturamento integrado.",
      sort_order: 10,
    },
    {
      category: "changed",
      title: "Diretório de Pacientes com Busca e Filtros Otimizados",
      body: "Aprimoramento na navegação e busca rápida por nome, CPF e status, com visualização moderna em cards adaptáveis para telas móveis e desktop.",
      sort_order: 20,
    },
    {
      category: "changed",
      title: "Laudos e Estatísticas de Pacientes Formatados para Impressão",
      body: "Layout institucional padronizado para impressão limpa de relatórios clínicos e gráficos de evolução do paciente.",
      sort_order: 30,
    },
    {
      category: "changed",
      title: "Precificação Solo Otimizada e Consolidação do Período de Testes (Trial)",
      body: "Ajuste no valor do plano individual e ativação simplificada de degustação gratuita com validação segura de cotas.",
      sort_order: 40,
    },
    {
      category: "fixed",
      title: "Isolamento de Status de Usuário em Múltiplas Clínicas",
      body: "Blindagem nas permissões para colaboradores que atuam em diferentes clínicas, garantindo total isolamento de dados e perfis operacionais.",
      sort_order: 10,
    },
    {
      category: "fixed",
      title: "Reenvio de Convites e Resolução de Códigos Públicos",
      body: "Tratamento de concorrência no aceite de convites de equipe e geração rápida de códigos públicos para novos profissionais.",
      sort_order: 20,
    },
    {
      category: "fixed",
      title: "Blindagem de Segurança e Otimização de Consultas",
      body: "Aprimoramento contínuo nos protocolos de segurança e isolamento de dados de prontuários e sessões, reduzindo o tempo de carregamento e assegurando sigilo profissional absoluto.",
      sort_order: 30,
    },
    {
      category: "fixed",
      title: "Scroll Vertical e Responsividade em Modais no Mobile",
      body: "Correção do comportamento de rolagem em modais de cadastro e relatórios em telas compactas (375px a 390px).",
      sort_order: 40,
    },
    {
      category: "removed",
      title: "Descontinuação de Telas Legadas da Antiga Tesouraria",
      body: "Remoção de seções obsoletas e redirecionamento para o módulo unificado de faturamento, faturas e planos.",
      sort_order: 10,
    },
  ],
};
