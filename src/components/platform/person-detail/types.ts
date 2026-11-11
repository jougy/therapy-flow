import type { AffiliateTier } from "@/lib/affiliate-tiers";

export interface PlatformUserAffiliateCardProps {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  primaryClinicId?: string;
  onAffiliateStatusChange?: () => void;
}

export interface AffiliateRecordData {
  id: string;
  user_id: string;
  clinic_id?: string | null;
  tier: AffiliateTier;
  minimum_tier_floor: AffiliateTier;
  status: "active" | "suspended" | "banned" | "absorbed_by_platform";
  coupon_code?: string;
  referral_slug?: string;
  active_referrals_count?: number;
  total_sales_count?: number;
  lifetime_commission_cents?: number;
  created_at?: string;
}

export interface AffiliateInvitationData {
  id: string;
  token: string;
  floor_tier: AffiliateTier;
  status: "pending" | "accepted" | "rejected" | "expired";
  clinic_id?: string | null;
  invited_user_id?: string | null;
  invited_email?: string | null;
  expires_at?: string;
  created_at?: string;
  metadata?: {
    is_custom?: boolean;
    custom_commissions?: {
      first_month_percent?: number;
      recurring_percent?: number;
    };
    [key: string]: any;
  };
}
