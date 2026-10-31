/**
 * Matriz Canônica de Telas e Navegação Telemetria
 * Normaliza qualquer rota ou sub-rota dinâmica da aplicação para uma coluna canônica de permanência.
 */

export const CANONICAL_PAGE_COLUMNS = [
  "dashboard",
  "pacientes",
  "prontuario_sessoes",
  "agenda",
  "formularios",
  "financeiro",
  "equipe_acessos",
  "configuracoes",
  "relatorios",
  "assinatura",
  "backoffice_master",
  "outros",
] as const;

export type CanonicalPageColumn = (typeof CANONICAL_PAGE_COLUMNS)[number];

export type PageDwellMatrix = Partial<Record<CanonicalPageColumn, number>>;

/**
 * Normaliza um pathname para sua coluna canônica correspondente.
 */
export function resolveCanonicalPageColumn(pathname: string): CanonicalPageColumn {
  if (!pathname) return "dashboard";

  // Remover query e fragmento hash
  const rawClean = pathname.split("?")[0].split("#")[0].trim().toLowerCase();
  const normalized = rawClean.startsWith("/") ? rawClean : `/${rawClean}`;

  // Casos puros de dashboard / home
  if (
    normalized === "/" ||
    normalized === "" ||
    normalized === "/dashboard" ||
    normalized === "/home" ||
    /^\/clinica\/[^/]+\/?$/.test(normalized)
  ) {
    return "dashboard";
  }

  // Normalização de prefixo /clinica/:clinicKey/...
  let effectivePath = normalized;
  const clinicaPrefixMatch = normalized.match(/^\/clinica\/[^/]+(\/.*)$/);
  if (clinicaPrefixMatch) {
    effectivePath = clinicaPrefixMatch[1];
    if (effectivePath === "/" || effectivePath === "") {
      return "dashboard";
    }
  }

  // Backoffice Master
  if (/(^|\/)(platform|admin|master)(\/|$)/.test(effectivePath)) {
    return "backoffice_master";
  }

  // Pacientes (inclui sub-rotas como /pacientes/PAC-123)
  if (/(^|\/)(pacientes?)(\/|$)/.test(effectivePath)) {
    return "pacientes";
  }

  // Prontuário e Sessões
  if (/(^|\/)(sessoes|sessao|atendimentos|atendimento|prontuario|evolucao)(\/|$)/.test(effectivePath)) {
    return "prontuario_sessoes";
  }

  // Agenda
  if (/(^|\/)(agenda)(\/|$)/.test(effectivePath)) {
    return "agenda";
  }

  // Formulários
  if (/(^|\/)(formularios?|anamnese|designlab)(\/|$)/.test(effectivePath)) {
    return "formularios";
  }

  // Financeiro
  if (/(^|\/)(financeiro|pagamentos?|faturas?|recibos?)(\/|$)/.test(effectivePath)) {
    return "financeiro";
  }

  // Equipe e Acessos
  if (/(^|\/)(equipe|colaboradores|membros|convites|papeis)(\/|$)/.test(effectivePath)) {
    return "equipe_acessos";
  }

  // Configurações
  if (/(^|\/)(configuracoes|perfil|seguranca)(\/|$)/.test(effectivePath)) {
    return "configuracoes";
  }

  // Relatórios
  if (/(^|\/)(relatorios?|estatisticas|analytics)(\/|$)/.test(effectivePath)) {
    return "relatorios";
  }

  // Assinatura
  if (/(^|\/)(assinatura|planos?|upgrade|pagamento-clinica)(\/|$)/.test(effectivePath)) {
    return "assinatura";
  }

  // Dashboard / Home explícito no effectivePath
  if (/(^|\/)(dashboard|home)(\/|$)/.test(effectivePath)) {
    return "dashboard";
  }

  return "outros";
}
