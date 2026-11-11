import type { AffiliateTier } from "@/lib/affiliate-tiers";

export type AffiliateStatus = "active" | "suspended" | "banned" | "absorbed_by_platform";
export type KycStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface AffiliateRecord {
  id: string;
  user_id?: string | null;
  clinic_id?: string | null;
  coupon_code: string;
  referral_slug: string;
  asaas_account_id: string;
  asaas_wallet_id?: string | null;
  status: AffiliateStatus;
  locked_reason?: string | null;
  tier: AffiliateTier;
  minimum_tier_floor: AffiliateTier;
  is_tier_manual_override: boolean;
  manual_tier_notes?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  first_month_commission_percent: number;
  recurring_commission_percent: number;
  is_subscription_waived: boolean;
  is_waiver_manual_override: boolean;
  active_referrals_count: number;
  total_sales_count: number;
  lifetime_commission_cents: number;
  kyc_status?: KycStatus;
  profile?: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
    cpf?: string | null;
  } | null;
}
