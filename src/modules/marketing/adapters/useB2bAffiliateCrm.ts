import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MarketingCrmAdapter, CrmContact, CrmStageKey } from '../types';
import { DEFAULT_CRM_STAGES } from '../types';

export interface AffiliateConversionRecord {
  id: string;
  affiliate_id: string;
  customer_user_id?: string | null;
  clinic_id: string;
  asaas_subscription_id?: string | null;
  plan_type: string;
  billing_cycle: string;
  status: string;
  total_cycles_paid: number;
  next_due_date?: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  customer?: {
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  clinic?: { name?: string | null } | null;
  affiliate?: { coupon_code?: string | null; referral_slug?: string | null } | null;
}

const AFFILIATE_STAGE_MAP: Record<string, CrmStageKey> = {
  trial: 'new',
  active: 'active',
  past_due: 'grace_period',
  canceled: 'churn',
};

export function mapAffiliateStatusToStage(status?: string | null): CrmStageKey {
  const normalized = (status || '').toLowerCase().trim();
  return AFFILIATE_STAGE_MAP[normalized] || 'new';
}

export function formatAffiliatePlan(planType?: string | null): string {
  if (!planType) return 'Plano Padrão';
  const lower = planType.toLowerCase().trim();
  if (lower === 'solo') return 'Plano Solo';
  if (lower === 'clinic' || lower === 'clinica') return 'Plano Clínica';
  if (lower === 'team' || lower === 'equipe') return 'Plano Equipe';
  if (lower === 'enterprise') return 'Plano Enterprise';
  if (lower.startsWith('plano')) return planType.charAt(0).toUpperCase() + planType.slice(1);
  return `Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)}`;
}

export function formatAffiliateCycle(cycle?: string | null): string {
  if (!cycle) return 'Mensal';
  const lower = cycle.toLowerCase().trim();
  if (lower === 'monthly' || lower === 'mensal') return 'Mensal';
  if (lower === 'yearly' || lower === 'annual' || lower === 'anual') return 'Anual';
  if (lower === 'quarterly' || lower === 'trimestral') return 'Trimestral';
  if (lower === 'semiannual' || lower === 'semestral') return 'Semestral';
  return cycle.charAt(0).toUpperCase() + cycle.slice(1);
}

export function mapAffiliateConversionToContact(
  conversion: AffiliateConversionRecord,
  fallbackCoupon = 'PARCEIRO'
): CrmContact {
  const stage = mapAffiliateStatusToStage(conversion.status);
  const fullName =
    conversion.customer?.full_name?.trim() ||
    conversion.clinic?.name?.trim() ||
    `Lead ${conversion.id.slice(0, 8)}`;

  const firstName = fullName.split(' ')[0] || 'Parceiro';
  const phone = conversion.customer?.phone || '';
  const email = conversion.customer?.email || undefined;
  const avatarUrl = conversion.customer?.avatar_url || undefined;
  const coupon = conversion.affiliate?.coupon_code || fallbackCoupon;

  const planFormatted = formatAffiliatePlan(conversion.plan_type);
  const cycleFormatted = formatAffiliateCycle(conversion.billing_cycle);
  const primaryValue = `${planFormatted} (${cycleFormatted})`;
  const cycles = conversion.total_cycles_paid ?? 0;
  const secondaryValue = `${cycles} ${cycles === 1 ? 'ciclo' : 'ciclos'}`;

  return {
    id: conversion.id,
    targetType: 'affiliate_lead',
    fullName,
    phone,
    email,
    avatarUrl,
    badgeLabel: planFormatted,
    stage,
    lastInteractionAt: conversion.updated_at || conversion.created_at,
    clinicalOrBusinessMetric: {
      primaryLabel: 'Plano / Ciclo',
      primaryValue,
      secondaryLabel: 'Mensalidades Pagas',
      secondaryValue,
    },
    templateVariables: {
      primeiro_nome: firstName,
      first_name: firstName,
      plano: planFormatted,
      status: conversion.status,
      cupom: coupon,
    },
  };
}

export interface UseB2bAffiliateCrmOptions {
  affiliateId?: string | 'all' | null;
  enabled?: boolean;
}

export function useB2bAffiliateCrm(
  options: UseB2bAffiliateCrmOptions = {}
): MarketingCrmAdapter & { refetch: () => Promise<void> } {
  const { user, clinicId } = useAuth();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [rawConversions, setRawConversions] = useState<AffiliateConversionRecord[]>([]);
  const [resolvedAffiliateId, setResolvedAffiliateId] = useState<string | null>(
    options.affiliateId && options.affiliateId !== 'all' ? options.affiliateId : null
  );
  const [isLoading, setIsLoading] = useState(true);

  const isEnabled = options.enabled !== false;

  const fetchAffiliateData = useCallback(async () => {
    if (!isEnabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const isExplicitAll = options.affiliateId === 'all';
      let activeAffiliateId: string | null = null;

      if (options.affiliateId && !isExplicitAll) {
        activeAffiliateId = options.affiliateId;
      } else if (!isExplicitAll) {
        activeAffiliateId = resolvedAffiliateId;
        if (!activeAffiliateId && (user?.id || clinicId)) {
          let affQuery = (supabase as any)
            .from('affiliates')
            .select('id, coupon_code')
            .is('deleted_at', null);

          if (clinicId) affQuery = affQuery.eq('clinic_id', clinicId);
          else if (user?.id) affQuery = affQuery.eq('user_id', user.id);

          const { data: affData } = await affQuery.maybeSingle();
          if (affData?.id) {
            activeAffiliateId = affData.id;
            setResolvedAffiliateId(affData.id);
          }
        }
      }

      let convQuery = (supabase as any)
        .from('affiliate_conversions')
        .select(`
          id, affiliate_id, customer_user_id, clinic_id,
          asaas_subscription_id, plan_type, billing_cycle,
          status, total_cycles_paid, next_due_date,
          created_at, updated_at, deleted_at,
          customer:profiles!customer_user_id ( full_name, phone, email, avatar_url ),
          clinic:clinics!clinic_id ( name ),
          affiliate:affiliates!affiliate_id ( coupon_code )
        `)
        .is('deleted_at', null);

      if (activeAffiliateId) convQuery = convQuery.eq('affiliate_id', activeAffiliateId);

      const { data, error } = await convQuery.order('created_at', { ascending: false });
      if (error) {
        setContacts([]);
        setRawConversions([]);
        return;
      }

      const records = (data || []) as AffiliateConversionRecord[];
      setRawConversions(records);
      setContacts(records.map((c) => mapAffiliateConversionToContact(c)));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, options.affiliateId, resolvedAffiliateId, user?.id, clinicId]);

  useEffect(() => {
    if (isEnabled) {
      void fetchAffiliateData();
    }
  }, [fetchAffiliateData, isEnabled]);

  const handleAddNote = useCallback(async (contactId: string, note: string) => {
    if (!note.trim()) return;
    const target = rawConversions.find((c) => c.id === contactId);
    const targetAffId = target?.affiliate_id || resolvedAffiliateId;

    if (targetAffId) {
      await (supabase as any).from('affiliate_crm_logs').insert({
        affiliate_id: targetAffId,
        conversion_id: contactId,
        action_type: 'note',
        content: note.trim(),
      });
    }

    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, lastInteractionAt: new Date().toISOString() } : c))
    );
  }, [rawConversions, resolvedAffiliateId]);

  const handleStageChange = useCallback(async (contactId: string, newStage: CrmStageKey) => {
    const stageToStatus: Record<CrmStageKey, string> = {
      new: 'trial',
      active: 'active',
      stalled: 'past_due',
      grace_period: 'past_due',
      churn: 'canceled',
    };
    const nextStatus = stageToStatus[newStage] || 'active';

    await (supabase as any)
      .from('affiliate_conversions')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', contactId);

    const target = rawConversions.find((c) => c.id === contactId);
    const targetAffId = target?.affiliate_id || resolvedAffiliateId;
    if (targetAffId) {
      await (supabase as any).from('affiliate_crm_logs').insert({
        affiliate_id: targetAffId,
        conversion_id: contactId,
        action_type: 'status_change',
        content: `Estágio alterado para: ${newStage} (${nextStatus})`,
      });
    }

    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stage: newStage } : c)));
  }, [rawConversions, resolvedAffiliateId]);

  return {
    targetType: 'affiliate_lead',
    title: 'CRM de Afiliados e Parcerias',
    subtitle: 'Acompanhe indicações, conversões e esteira de parceiros',
    stages: DEFAULT_CRM_STAGES,
    contacts,
    isLoading,
    onAddNote: handleAddNote,
    onStageChange: handleStageChange,
    refetch: fetchAffiliateData,
  };
}
