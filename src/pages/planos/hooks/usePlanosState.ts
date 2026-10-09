import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { supabase } from "@/integrations/supabase/client";
import { calculatePlanPrice, BillingCycle, PlanPriceCalculation, PlanType, parsePlanType, parseBillingCycle } from "@/utils/subscriptionPricing";
import { trackBeginCheckoutEvent } from "@/lib/analytics-tracker";
import { CouponValidationResult } from "../components/PlanCouponInput";
import { toast } from "sonner";

export interface UsePlanosStateReturn {
  existingClinicId: string | null | undefined;
  existingClinicName: string | undefined;
  hasActiveSubscription: boolean;
  activeSubscriptionPlan: PlanType | null;
  activeSubscriptionCycle: BillingCycle | null;
  isFreeTrialEnabled: boolean;
  audience: "prof" | "clinic";
  setAudience: (aud: "prof" | "clinic") => void;
  selectedCycle: BillingCycle | "free";
  setSelectedCycle: (cycle: BillingCycle | "free") => void;
  isFreeCycle: boolean;
  selectedPlanId: string | null;
  activatingTrial: boolean;
  extraConcurrent: number;
  setExtraConcurrent: React.Dispatch<React.SetStateAction<number>>;
  extraConcurrentEnterprise: number;
  setExtraConcurrentEnterprise: React.Dispatch<React.SetStateAction<number>>;
  couponInput: string;
  setCouponInput: (val: string) => void;
  validatingCoupon: boolean;
  appliedCoupon: CouponValidationResult | null;
  couponError: string | null;
  handleValidateCoupon: () => Promise<void>;
  handleRemoveCoupon: () => void;
  // Preços dos novos 6 planos
  profBasicoPricing: PlanPriceCalculation;
  profMedioPricing: PlanPriceCalculation;
  profTopPricing: PlanPriceCalculation;
  clinicaBasicoPricing: PlanPriceCalculation;
  clinicaMedioPricing: PlanPriceCalculation;
  clinicaTopPricing: PlanPriceCalculation;
  // Aliases legados para compatibilidade
  soloPricing: PlanPriceCalculation;
  clinicPricing: PlanPriceCalculation;
  enterprisePricing: PlanPriceCalculation;
  handleSelectPlan: (planId: PlanType) => Promise<void>;
  isTermsModalOpen: boolean;
  setIsTermsModalOpen: (open: boolean) => void;
  loading: boolean;
  isModuleEnabled: boolean;
}

/**
 * Hook customizado de gerenciamento de estado e regras de negócio da página de Planos.
 *
 * Princípios de Engenharia:
 * - Desacopla regras de negócio, efeitos de assinatura e chamadas RPC da camada de apresentação (View).
 * - Otimização de Performance (Big-O):
 *   - Precificações recalculadas com complexidade O(1) via `useMemo`.
 *   - Callbacks estabilizados via `useCallback` para manter referências estáveis nas props dos cards filhos.
 */
export function usePlanosState(): UsePlanosStateReturn {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, clinic, clinicId: activeClinicId, selectClinic, refreshAuthState } = useAuth();
  const { isFeatureEnabled, loading } = useFeatureFlags();

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activatingTrial, setActivatingTrial] = useState(false);

  const existingClinicId = searchParams.get("clinicId") || activeClinicId || clinic?.id;
  const existingClinicName = clinic?.name;
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [activeSubscriptionPlan, setActiveSubscriptionPlan] = useState<PlanType | null>(null);
  const [activeSubscriptionCycle, setActiveSubscriptionCycle] = useState<BillingCycle | null>(null);

  // Perfil Selecionado: Para Profissional ('prof') vs Para Clínica ('clinic')
  const [audience, setAudience] = useState<"prof" | "clinic">("prof");

  // Ciclo Selecionado: Teste Gratuito (Free), Mensal, Trimestral ou Anual
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle | "free">("annual");

  // State da Calculadora de Acessos Extras na Clínica e Enterprise
  const [extraConcurrent, setExtraConcurrent] = useState(0);
  const [extraConcurrentEnterprise, setExtraConcurrentEnterprise] = useState(0);

  // State do Cupom Promocional
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Verificação assíncrona se a clínica já possui assinatura ativa/paga
  useEffect(() => {
    let active = true;
    async function checkExistingSubscription() {
      let targetClinicId = existingClinicId;
      if (!targetClinicId && user?.id) {
        try {
          const { data: memData } = await supabase
            .from("clinic_memberships")
            .select("clinic_id")
            .eq("user_id", user.id)
            .eq("operational_role", "owner")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (memData?.clinic_id) {
            targetClinicId = memData.clinic_id;
          }
        } catch (err) {
          console.warn("Aviso ao buscar clínica do usuário:", err);
        }
      }

      if (!targetClinicId) {
        if (active) {
          setHasActiveSubscription(false);
          setActiveSubscriptionPlan(null);
          setActiveSubscriptionCycle(null);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clinic_subscriptions")
          .select("status, is_free_trial, plan_type, billing_cycle")
          .eq("clinic_id", targetClinicId)
          .maybeSingle();

        if (active && !error && data) {
          const status = (data.status || "").toUpperCase();
          const isPaidActive = status === "ACTIVE" || status === "CONFIRMED" || status === "RECEIVED";
          setHasActiveSubscription(isPaidActive);
          if (isPaidActive && data.plan_type) {
            const parsedPlan = parsePlanType(data.plan_type);
            setActiveSubscriptionPlan(parsedPlan);
            if (data.billing_cycle) {
              setActiveSubscriptionCycle(parseBillingCycle(data.billing_cycle));
            }
          } else {
            setActiveSubscriptionPlan(null);
            setActiveSubscriptionCycle(null);
          }
        }
      } catch (err) {
        console.warn("Aviso ao checar assinatura ativa da clínica:", err);
      }
    }
    void checkExistingSubscription();
    return () => { active = false; };
  }, [existingClinicId, user?.id]);

  const isFreeTrialEnabled = isFeatureEnabled("subscription_free_trial_enabled");

  useEffect(() => {
    if (!isFreeTrialEnabled && selectedCycle === "free") {
      setSelectedCycle("annual");
    }
  }, [isFreeTrialEnabled, selectedCycle]);

  // Validação do Cupom via RPC Supabase
  const handleValidateCoupon = useCallback(async () => {
    if (!couponInput.trim()) {
      setCouponError("Informe o código do cupom.");
      setAppliedCoupon(null);
      return;
    }
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data, error } = await supabase.rpc("validate_subscription_coupon", {
        _code: couponInput.trim().toUpperCase(),
        _plan_type: selectedPlanId || (audience === "clinic" ? "clinica_medio" : "prof_medio"),
        _clinic_id: existingClinicId || null,
        _billing_cycle: selectedCycle !== "free" ? selectedCycle : null,
      });
      if (error) throw error;
      const result = data as CouponValidationResult;
      if (result && result.valid) {
        setAppliedCoupon(result);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(result?.message || "Cupom inválido ou expirado.");
      }
    } catch {
      setAppliedCoupon(null);
      setCouponError("Erro ao validar cupom. Tente novamente.");
    } finally {
      setValidatingCoupon(false);
    }
  }, [couponInput, selectedPlanId, audience, existingClinicId, selectedCycle]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }, []);

  const isFreeCycle = selectedCycle === "free";

  // Cálculos de precificação memoizados para os 6 novos planos (Complexidade O(1))
  const targetBillingCycle = isFreeCycle ? "annual" : selectedCycle;

  // Planos Profissionais
  const profBasicoPricing = useMemo(() => calculatePlanPrice({
    planType: "prof_basico",
    billingCycle: targetBillingCycle,
    coupon: appliedCoupon,
  }), [targetBillingCycle, appliedCoupon]);

  const profMedioPricing = useMemo(() => calculatePlanPrice({
    planType: "prof_medio",
    billingCycle: targetBillingCycle,
    coupon: appliedCoupon,
  }), [targetBillingCycle, appliedCoupon]);

  const profTopPricing = useMemo(() => calculatePlanPrice({
    planType: "prof_top",
    billingCycle: targetBillingCycle,
    coupon: appliedCoupon,
  }), [targetBillingCycle, appliedCoupon]);

  // Planos Clínicas
  const clinicaBasicoPricing = useMemo(() => calculatePlanPrice({
    planType: "clinica_basico",
    billingCycle: targetBillingCycle,
    additionalSeats: extraConcurrent,
    coupon: appliedCoupon,
  }), [targetBillingCycle, extraConcurrent, appliedCoupon]);

  const clinicaMedioPricing = useMemo(() => calculatePlanPrice({
    planType: "clinica_medio",
    billingCycle: targetBillingCycle,
    additionalSeats: extraConcurrent,
    coupon: appliedCoupon,
  }), [targetBillingCycle, extraConcurrent, appliedCoupon]);

  const clinicaTopPricing = useMemo(() => calculatePlanPrice({
    planType: "clinica_top",
    billingCycle: targetBillingCycle,
    additionalSeats: extraConcurrent,
    coupon: appliedCoupon,
  }), [targetBillingCycle, extraConcurrent, appliedCoupon]);

  // Aliases Legados para retrocompatibilidade
  const soloPricing = profMedioPricing;
  const clinicPricing = clinicaMedioPricing;
  const enterprisePricing = clinicaTopPricing;

  // Seleção e ativação de plano (Trial ou Checkout)
  const handleSelectPlan = useCallback(async (planId: PlanType) => {
    setSelectedPlanId(planId);
    if (activatingTrial) return;

    if (isFreeCycle) {
      const trialPlan = "clinica_medio";
      if (!existingClinicId) {
        navigate(`/onboarding-clinica?plan=${trialPlan}&cycle=annual&trial=true`);
        return;
      }
      setActivatingTrial(true);
      try {
        // Verificar se a clínica já possui cartão de crédito tokenizado em clinic_subscriptions
        const { data: subData } = await supabase
          .from("clinic_subscriptions")
          .select("trial_card_token")
          .eq("clinic_id", existingClinicId)
          .maybeSingle();

        if (!subData?.trial_card_token) {
          // Exige registro prévio de cartão com validação simbólica de R$ 0,01
          navigate(`/pagamento/${existingClinicId}?plan=${trialPlan}&cycle=annual&trial=true`);
          return;
        }

        const { error: rpcError } = await supabase.rpc("activate_clinic_free_trial", {
          _clinic_id: existingClinicId,
          _plan_type: trialPlan,
        });
        if (rpcError) throw rpcError;
        if (typeof refreshAuthState === "function") await refreshAuthState();
        if (typeof selectClinic === "function") {
          try { await selectClinic(existingClinicId); } catch (e) { console.warn("Auto-seleção:", e); }
        }
        toast.success("Teste Gratuito (7 dias) ativado com sucesso!");
        navigate("/espacopessoal", { replace: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao ativar teste gratuito.";
        if (msg.includes("CARD_REQUIRED_FOR_TRIAL")) {
          navigate(`/pagamento/${existingClinicId}?plan=${trialPlan}&cycle=annual&trial=true`);
          return;
        }
        toast.error(msg);
      } finally {
        setActivatingTrial(false);
      }
      return;
    }

    // Cálculo dinâmico de assentos base do plano selecionado
    const baseSeats =
      planId === "clinica_top" ? 8 :
      planId === "clinica_medio" ? 4 :
      planId === "clinica_basico" ? 2 :
      planId === "prof_top" ? 2 :
      planId === "clinic" ? 4 :
      planId === "enterprise" ? 10 : 1;

    const isClinicPlan =
      planId === "clinica_basico" ||
      planId === "clinica_medio" ||
      planId === "clinica_top" ||
      planId === "clinic" ||
      planId === "enterprise";

    const targetSeats = isClinicPlan ? baseSeats + extraConcurrent : baseSeats;
    const couponQuery = appliedCoupon?.code ? `&coupon=${appliedCoupon.code}` : "";

    const checkoutCycle: BillingCycle = selectedCycle === "free" ? "monthly" : selectedCycle;
    const pricing = calculatePlanPrice({
      planType: planId,
      billingCycle: checkoutCycle,
      additionalSeats: isClinicPlan ? extraConcurrent : 0,
      coupon: appliedCoupon,
    });

    trackBeginCheckoutEvent({
      planKey: planId,
      category: isClinicPlan ? "Equipe" : "Solo",
      value: pricing.periodTotal,
      valueCents: Math.round(pricing.periodTotal * 100),
      couponCode: appliedCoupon?.code,
    });


    const isSoloPlan =
      planId === "prof_basico" ||
      planId === "prof_medio" ||
      planId === "prof_top" ||
      planId === "solo";

    // 1. Se for plano Profissional Solo:
    // Pula qualquer etapa de registro de clínica e vai direto para a página de checkout Asaas
    if (isSoloPlan) {
      let targetClinicId = existingClinicId;
      if (!targetClinicId && user?.id) {
        try {
          const { data: memData } = await supabase
            .from("clinic_memberships")
            .select("clinic_id")
            .eq("user_id", user.id)
            .eq("operational_role", "owner")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (memData?.clinic_id) {
            targetClinicId = memData.clinic_id;
          }
        } catch (err) {
          console.warn("Aviso ao buscar clínica solo:", err);
        }
      }

      if (targetClinicId) {
        navigate(`/pagamento/${targetClinicId}?plan=${planId}&cycle=${checkoutCycle}${couponQuery}`);
        return;
      }
    }

    // 2. Se for plano Clínica com Equipe (clinica_basico, clinica_medio, clinica_top, clinic, enterprise):
    // Se o usuário já tiver uma clínica solo e quiser transformá-la em clínica com equipe,
    // permite upgrade sem perder prontuários via onboarding-clinica?mode=upgrade.
    if (isClinicPlan) {
      const seatsQuery = `&concurrent=${targetSeats}`;
      const spacesQuery = "&spaces=30";

      if (existingClinicId) {
        navigate(`/onboarding-clinica?mode=upgrade&clinicId=${existingClinicId}&plan=${planId}&cycle=${selectedCycle}${seatsQuery}${couponQuery}`);
        return;
      }

      navigate(`/onboarding-clinica?plan=${planId}&cycle=${selectedCycle}${seatsQuery}${spacesQuery}${couponQuery}`);
      return;
    }

    if (existingClinicId) {
      navigate(`/pagamento/${existingClinicId}?plan=${planId}&cycle=${selectedCycle}${couponQuery}`);
      return;
    }

    navigate(`/pagamento/solo?plan=${planId}&cycle=${selectedCycle}${couponQuery}`);
  }, [activatingTrial, isFreeCycle, existingClinicId, user?.id, extraConcurrent, appliedCoupon, selectedCycle, navigate, refreshAuthState, selectClinic]);

  return {
    existingClinicId,
    existingClinicName,
    hasActiveSubscription,
    activeSubscriptionPlan,
    activeSubscriptionCycle,
    isFreeTrialEnabled,
    audience,
    setAudience,
    selectedCycle,
    setSelectedCycle,
    isFreeCycle,
    selectedPlanId,
    activatingTrial,
    extraConcurrent,
    setExtraConcurrent,
    extraConcurrentEnterprise,
    setExtraConcurrentEnterprise,
    couponInput,
    setCouponInput,
    validatingCoupon,
    appliedCoupon,
    couponError,
    handleValidateCoupon,
    handleRemoveCoupon,
    profBasicoPricing,
    profMedioPricing,
    profTopPricing,
    clinicaBasicoPricing,
    clinicaMedioPricing,
    clinicaTopPricing,
    soloPricing,
    clinicPricing,
    enterprisePricing,
    handleSelectPlan,
    isTermsModalOpen,
    setIsTermsModalOpen,
    loading,
    isModuleEnabled: isFeatureEnabled("subscriptions_module"),
  };
}
