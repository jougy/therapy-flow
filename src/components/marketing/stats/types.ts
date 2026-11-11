export type AsaasSplitStatus = "received" | "retained" | "refunded";
export type AffiliateTaxStatus = "up_to_date" | "pending_invoice" | "under_review";

export interface AffiliateSplitRecord {
  id: string;
  date: string;
  clinicName: string;
  planCycle: string;
  netAmountCents: number;
  splitPercent: number;
  asaasStatus: AsaasSplitStatus;
}

export interface AffiliateFinancialStatsData {
  availableBalanceCents: number;
  retainedBalanceCents: number;
  mrrCents: number;
  taxStatus: AffiliateTaxStatus;
  taxRegime?: string;
  splits: AffiliateSplitRecord[];
}

export interface AffiliateFinancialStatsBlockProps {
  data?: Partial<AffiliateFinancialStatsData>;
  clinicId?: string | null;
  onDownloadReport?: (format: "pdf" | "csv", year: number) => void;
  onNavigateFullStats?: () => void;
  className?: string;
}

export const DEFAULT_SPLITS: AffiliateSplitRecord[] = [
  {
    id: "split-1",
    date: "10/11/2026",
    clinicName: "Clínica FisioLife",
    planCycle: "Plano Equipe (Mensal)",
    netAmountCents: 19800,
    splitPercent: 20,
    asaasStatus: "received",
  },
  {
    id: "split-2",
    date: "08/11/2026",
    clinicName: "Espaço Integrar Saúde",
    planCycle: "Plano Solo (Mensal)",
    netAmountCents: 7900,
    splitPercent: 20,
    asaasStatus: "received",
  },
  {
    id: "split-3",
    date: "04/11/2026",
    clinicName: "Centro Reab Vital",
    planCycle: "Plano Clínica (Anual)",
    netAmountCents: 47800,
    splitPercent: 20,
    asaasStatus: "retained",
  },
  {
    id: "split-4",
    date: "28/10/2026",
    clinicName: "Studio Pilates Postura",
    planCycle: "Plano Solo (Mensal)",
    netAmountCents: 7900,
    splitPercent: 20,
    asaasStatus: "refunded",
  },
];

export const DEFAULT_STATS: AffiliateFinancialStatsData = {
  availableBalanceCents: 184000,
  retainedBalanceCents: 62000,
  mrrCents: 245000,
  taxStatus: "up_to_date",
  taxRegime: "MEI / Simples Nacional",
  splits: DEFAULT_SPLITS,
};
