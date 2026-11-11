import type { AffiliateTier } from "@/lib/affiliate-tiers";
import type { AffiliateTelemetryData } from "@/lib/telemetry/affiliate-telemetry";

export type AffiliatePortalTab = "performance" | "hook" | "registry";

export interface AffiliatePortalPartner {
  id: string;
  name: string;
  email: string;
  slug: string;
  couponCode: string;
  tier: AffiliateTier;
  lifetimeCommissionCents: number;
  availableBalanceCents: number;
  retainedBalanceCents: number;
  overdueGraceDaysRemaining?: number;
  kycStatus: "APPROVED" | "PENDING" | "REJECTED";
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  pixKeyType?: string;
  hasActiveTransactions?: boolean;
}

export interface AffiliatePortalViewProps {
  partner: AffiliatePortalPartner;
  initialTelemetry?: Partial<AffiliateTelemetryData>;
  defaultTab?: AffiliatePortalTab;
  onRequestBankChange?: (totpCode: string) => void;
}

export function formatCents(cents: number): string {
  return ((cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
