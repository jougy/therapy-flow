export interface AffiliateCampaignConfig {
  isActive: boolean;
  title: string;
  description: string;
  targetCount: number;
  bonusValueCents: number;
  endDate: string;
  rulesList: string[];
  badgeLabel?: string;
}

export const DEFAULT_CAMPAIGN_RULES: string[] = [
  "Meta e Premiação: Atinja o número estipulado de indicações válidas de clínicas para desbloquear o bônus pontual.",
  "Bônus Cumulativo: O bônus pontual é cumulativo e não desconta da sua comissão recorrente mensal de até 30%.",
  "Liquidação Direta no Asaas: O valor será creditado na sua subconta Asaas no primeiro ciclo de fechamento após a confirmação das assinaturas.",
  "Verificação & Anti-Fraude: Válido exclusivamente para clínicas reais com primeira mensalidade quitada e aprovadas pelo sistema antifraude.",
];

export function getDefaultCampaignEndDateString(): string {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return lastDayOfMonth.toISOString();
}

export const DEFAULT_CAMPAIGN_CONFIG: AffiliateCampaignConfig = {
  isActive: true,
  title: "🏆 Sprint do Mês da Fisioterapia",
  description:
    "Indique 3 clínicas parceiras e garanta um bônus pontual de R$ 300,00 direto na sua subconta Asaas, além das comissões recorrentes.",
  targetCount: 3,
  bonusValueCents: 30000,
  endDate: getDefaultCampaignEndDateString(),
  rulesList: DEFAULT_CAMPAIGN_RULES,
  badgeLabel: "Desafio Sazonal Ativo",
};
