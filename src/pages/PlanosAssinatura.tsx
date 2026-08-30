import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  Building2, 
  UserRound, 
  Tag, 
  Check, 
  AlertCircle, 
  Users, 
  QrCode, 
  Award,
  ArrowLeft,
  X,
  Loader2
} from "lucide-react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculatePlanPrice, BillingCycle } from "@/utils/subscriptionPricing";
import { toast } from "sonner";

interface CouponValidationResult {
  valid: boolean;
  coupon_id?: string;
  code?: string;
  description?: string;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_DAYS";
  discount_value?: number;
  message?: string;
}

export default function PlanosAssinatura() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clinic, clinicId: activeClinicId, session, selectClinic, refreshAuthState } = useAuth();
  const { isFeatureEnabled, loading } = useFeatureFlags();
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activatingTrial, setActivatingTrial] = useState(false);

  const existingClinicId = searchParams.get("clinicId") || activeClinicId || clinic?.id;
  const existingClinicName = clinic?.name;

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Verificar se a clínica existente já possui assinatura ativa/paga
  useEffect(() => {
    if (!existingClinicId) {
      setHasActiveSubscription(false);
      return;
    }

    let active = true;
    async function checkExistingSubscription() {
      try {
        const { data, error } = await supabase
          .from("clinic_subscriptions")
          .select("status, is_free_trial")
          .eq("clinic_id", existingClinicId)
          .maybeSingle();

        if (active && !error && data) {
          const status = (data.status || "").toUpperCase();
          const isPaidActive = status === "ACTIVE" || status === "CONFIRMED" || status === "RECEIVED";
          setHasActiveSubscription(isPaidActive);
        }
      } catch (err) {
        console.warn("Aviso ao checar assinatura ativa da clínica:", err);
      }
    }

    void checkExistingSubscription();

    return () => {
      active = false;
    };
  }, [existingClinicId]);

  const isFreeTrialEnabled = isFeatureEnabled("subscription_free_trial_enabled");

  // Ciclo Selecionado: Degustação Grátis (Free), Mensal, Trimestral ou Anual
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle | "free">("annual");

  // State da Calculadora de Acessos Extras na Clínica
  const [extraConcurrent, setExtraConcurrent] = useState(0);

  // State do Cupom
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFreeTrialEnabled && selectedCycle === "free") {
      setSelectedCycle("annual");
    }
  }, [isFreeTrialEnabled, selectedCycle]);

  if (!loading && !isFeatureEnabled("subscriptions_module")) {
    return <Navigate to="/espacopessoal" replace />;
  }

  // Validação do Cupom via RPC Supabase
  const handleValidateCoupon = async () => {
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
        _plan_type: selectedPlanId || "clinic",
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
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const isFreeCycle = selectedCycle === "free";

  // Cálculos via Utilitário Centralizado para planos pagos
  const soloPricing = calculatePlanPrice({
    planType: "solo",
    billingCycle: isFreeCycle ? "annual" : selectedCycle,
    coupon: appliedCoupon,
  });

  const clinicPricing = calculatePlanPrice({
    planType: "clinic",
    billingCycle: isFreeCycle ? "annual" : selectedCycle,
    additionalSeats: extraConcurrent,
    coupon: appliedCoupon,
  });

  const handleSelectPlan = async (planId: "solo" | "clinic") => {
    if (activatingTrial) return;

    if (isFreeCycle) {
      if (!existingClinicId) {
        navigate(`/onboarding-clinica?plan=${planId}&cycle=annual&trial=true`);
        return;
      }

      setActivatingTrial(true);
      try {
        const { error: rpcError } = await supabase.rpc("activate_clinic_free_trial", {
          _clinic_id: existingClinicId,
          _plan_type: planId,
        });

        if (rpcError) throw rpcError;

        if (typeof refreshAuthState === "function") {
          await refreshAuthState();
        }

        if (typeof selectClinic === "function") {
          try {
            await selectClinic(existingClinicId);
          } catch (selectErr) {
            console.warn("Auto-seleção de clínica:", selectErr);
          }
        }

        toast.success("Plano Degustação Grátis ativado com sucesso (20 atendimentos e 5 pacientes inclusos)!");
        navigate("/espacopessoal", { replace: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao ativar degustação grátis.";
        toast.error(msg);
      } finally {
        setActivatingTrial(false);
      }
      return;
    }

    // Se o ciclo for pago
    if (existingClinicId) {
      let url = `/pagamento/${existingClinicId}?plan=${planId}&cycle=${selectedCycle}`;
      if (planId === "clinic") {
        url += `&concurrent=${2 + extraConcurrent}`;
      }
      if (appliedCoupon?.code) {
        url += `&coupon=${appliedCoupon.code}`;
      }
      navigate(url);
      return;
    }

    // Caso não tenha clínica criada ainda
    let url = `/onboarding-clinica?plan=${planId}&cycle=${selectedCycle}`;
    if (planId === "clinic") {
      url += `&concurrent=${2 + extraConcurrent}&spaces=30`;
    }
    if (appliedCoupon?.code) {
      url += `&coupon=${appliedCoupon.code}`;
    }
    navigate(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start px-4 py-8 sm:py-12 relative overflow-y-auto overflow-x-hidden">
      {/* Botão de Retorno ao Espaço Pessoal */}
      <div className="w-full max-w-5xl mb-4 z-10 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/espacopessoal")}
          className="text-muted-foreground hover:text-foreground -ml-2 gap-1.5 font-medium min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Espaço Pessoal
        </Button>
      </div>

      {/* Background Ambient Glow adaptável */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 dark:bg-blue-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 text-center mb-8 max-w-3xl space-y-3"
      >
        <div className="flex justify-center mb-2">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-12 w-12 drop-shadow-md hidden sm:block mt-1"
          />
        </div>
        {existingClinicName ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs sm:text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Ativando plano para o espaço: <span className="text-foreground font-bold">{existingClinicName}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary dark:text-blue-400 border border-primary/20 text-xs sm:text-sm font-semibold">
            <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            Planos Flexíveis e Transparentes para sua Prática
          </div>
        )}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Escolha o Plano Ideal para seu Espaço
        </h1>
        <p className="text-xs sm:text-base text-muted-foreground max-w-2xl mx-auto">
          {existingClinicName
            ? `Selecione a modalidade e ciclo desejados para dar continuidade à sua clínica sem limitações.`
            : `Economize até 25% no plano anual ou comece com o teste grátis volumétrico de 20 atendimentos.`}
        </p>

        {/* SELETOR DE CICLOS DE PAGAMENTO E DEGUSTAÇÃO FREE */}
        <div className="pt-4 flex justify-center">
          <div className="p-1.5 bg-muted/60 dark:bg-neutral-900/90 border border-border dark:border-neutral-800 rounded-2xl inline-flex items-center gap-1 shadow-sm dark:shadow-2xl backdrop-blur-md flex-wrap justify-center">
            {!hasActiveSubscription && isFreeTrialEnabled && (
              <button
                type="button"
                onClick={() => setSelectedCycle("free")}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                  selectedCycle === "free"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Degustação Grátis (Free)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedCycle("monthly")}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                selectedCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Mensal</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCycle("quarterly")}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                selectedCycle === "quarterly"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Trimestral</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] uppercase font-extrabold">
                -10% OFF
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCycle("annual")}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                selectedCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Anual</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-extrabold">
                -25% OFF
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Caixa de Cupom de Desconto Global (Apenas para planos pagos) */}
      {!isFreeCycle && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="z-10 w-full max-w-xl mb-8 p-4 rounded-2xl bg-card border border-border shadow-md dark:bg-neutral-900/80 dark:border-neutral-800 backdrop-blur-xl space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary dark:text-blue-400">
            <Tag className="w-4 h-4" />
            Possui um Cupom Promocional?
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="EX: PRIMEIROMES100, BETA50"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11 text-sm font-mono tracking-wider uppercase focus:border-primary"
            />
            <Button
              onClick={handleValidateCoupon}
              disabled={validatingCoupon || !couponInput.trim()}
              className="font-semibold rounded-xl h-11 px-5 text-sm shrink-0 min-h-[44px]"
            >
              {validatingCoupon ? "Validando..." : "Aplicar"}
            </Button>
          </div>

          {/* Feedback visual do cupom */}
          <AnimatePresence>
            {appliedCoupon && appliedCoupon.valid && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">
                    Cupom <strong>{appliedCoupon.code}</strong> aplicado: {appliedCoupon.description}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 text-[10px]">
                    {appliedCoupon.discount_type === "PERCENTAGE" && `${appliedCoupon.discount_value}% OFF`}
                    {appliedCoupon.discount_type === "FIXED_AMOUNT" && `R$ ${appliedCoupon.discount_value} OFF`}
                    {appliedCoupon.discount_type === "TRIAL_DAYS" && `${appliedCoupon.discount_value} Dias Grátis`}
                  </Badge>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 rounded-md text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
                    title="Remover cupom"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {couponError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{couponError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Grid de Planos Principais */}
      <div className="z-10 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Card 1: Plano Solo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-border to-border/40 dark:from-neutral-800 dark:to-neutral-900 shadow-lg transition-shadow hover:shadow-xl"
        >
          <div className="h-full rounded-[23px] bg-card/95 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between space-y-6 border border-border/50">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">Profissional Solo</h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">1 Profissional de Saúde Titular</p>
                </div>
              </div>

              <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                {isFreeCycle
                  ? "Experimente gratuitamente com até 20 atendimentos clínicos e 5 pacientes inclusos."
                  : "Perfeito para profissionais autônomos organizarem atendimentos individuais com prontuário completo."}
              </p>

              {/* Preço Dinâmico / Free */}
              <div className="mb-6 p-4 rounded-2xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800 space-y-1.5">
                {isFreeCycle ? (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        Grátis
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/ 20 atendimentos</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-2">
                      Sem prazo de expiração de dias. Até 5 pacientes e 1 formulário extra.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-foreground">
                        R$ {soloPricing.monthlyEquivalent.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/mês</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800">
                      <span>
                        Total: <strong className="text-foreground font-semibold">R$ {soloPricing.periodTotal.toFixed(2)}</strong>/{soloPricing.periodLabel}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> PIX: R$ {soloPricing.pixDiscountTotal.toFixed(2)} (-5%)
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3 mb-6">
                {[
                  "1 Profissional de saúde (titular)",
                  "1 Acesso simultâneo por vez",
                  isFreeCycle ? "Até 20 atendimentos clínicos" : "Atendimentos e pacientes ilimitados",
                  isFreeCycle ? "Até 5 pacientes cadastrados" : "Prontuário eletrônico completo e anamnese",
                  isFreeCycle ? "1 Formulário personalizado extra" : "Agendamento e calendário inteligente",
                  !isFreeCycle && "Pacotes de sessões e controle financeiro",
                ].filter(Boolean).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/80 dark:text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 min-h-[48px]"
                disabled={activatingTrial}
                onClick={() => handleSelectPlan("solo")}
              >
                {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isFreeCycle ? "Ativar Degustação Grátis Solo" : "Contratar Profissional Solo"}
                {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Plano Clínica com Equipe */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-primary to-primary/40 dark:from-blue-500 dark:to-blue-900 shadow-xl shadow-primary/10 dark:shadow-blue-900/30"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary dark:via-blue-400 to-transparent" />

          <div className="h-full rounded-[23px] bg-card/95 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden space-y-6 border border-border/50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-md">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Clínica com Equipe</h3>
                    <p className="text-xs text-primary dark:text-blue-400 font-semibold">Equipes e Consultórios Compartilhados</p>
                  </div>
                </div>
                <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider">
                  Recomendado
                </Badge>
              </div>

              <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                {isFreeCycle
                  ? "Experimente gratuitamente com até 4 acessos simultâneos, 20 atendimentos e 5 pacientes."
                  : "Gestão completa de secretárias, profissionais e colaboradores com cotas personalizáveis de acessos."}
              </p>

              {/* Preço Dinâmico / Free Clínica */}
              <div className="mb-6 p-4 rounded-2xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800 space-y-1.5">
                {isFreeCycle ? (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-primary dark:text-blue-400">
                        Grátis
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/ 20 atendimentos</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-2">
                      4 acessos simultâneos na degustação. Sem prazo de dias.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-foreground">
                        R$ {clinicPricing.monthlyEquivalent.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/mês</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800">
                      <span>
                        Total: <strong className="text-foreground font-semibold">R$ {clinicPricing.periodTotal.toFixed(2)}</strong>/{clinicPricing.periodLabel}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> PIX: R$ {clinicPricing.pixDiscountTotal.toFixed(2)} (-5%)
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Ajuste de Acessos Simultâneos (apenas para planos pagos) */}
              {!isFreeCycle && (
                <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-neutral-900/40 border border-border dark:border-neutral-800/80 space-y-2 mb-6">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary dark:text-blue-400" /> Acessos Simultâneos:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={extraConcurrent === 0}
                        onClick={() => setExtraConcurrent((prev) => Math.max(0, prev - 1))}
                        className="w-8 h-8 rounded-lg bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center font-bold text-foreground text-xs transition-colors min-h-[32px] min-w-[32px]"
                        aria-label="Diminuir acessos simultâneos"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-primary dark:text-blue-400 text-sm px-1">
                        {2 + extraConcurrent} acessos
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtraConcurrent((prev) => prev + 1)}
                        className="w-8 h-8 rounded-lg bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center font-bold text-foreground text-xs transition-colors min-h-[32px] min-w-[32px]"
                        aria-label="Aumentar acessos simultâneos"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    2 inclusos no plano base (+R$ {clinicPricing.extraSeatRate.toFixed(2)}/mês por acesso extra).
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {[
                  "Colaboradores e equipe ilimitados (até 30 vagas base)",
                  isFreeCycle ? "4 acessos simultâneos inclusos na degustação" : `${2 + extraConcurrent} acessos simultâneos inclusos`,
                  isFreeCycle ? "Até 20 atendimentos clínicos" : "Atendimentos e pacientes ilimitados",
                  isFreeCycle ? "Até 5 pacientes cadastrados" : "Controle avançado de permissões (RBAC)",
                  isFreeCycle ? "1 Formulário personalizado extra" : "Agendas compartilhadas e telemetria master",
                  !isFreeCycle && "Prontuário completo, relatórios e evolução clínica",
                ].filter(Boolean).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/80 dark:text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-primary dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button
                className="w-full font-bold shadow-md h-12 text-sm rounded-xl transition-all min-h-[48px]"
                disabled={activatingTrial}
                onClick={() => handleSelectPlan("clinic")}
              >
                {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isFreeCycle ? "Ativar Degustação Grátis Clínica" : "Contratar Clínica com Equipe"}
                {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Banner Informativo sobre o Teste Grátis Volumétrico */}
      {!hasActiveSubscription && isFreeTrialEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="z-10 w-full max-w-5xl mt-10 p-6 rounded-3xl bg-card/60 dark:bg-neutral-900/40 border border-border dark:border-neutral-800 text-foreground text-xs sm:text-sm flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-foreground text-sm sm:text-base">Como funciona a Degustação Gratuita?</h4>
              <p className="text-xs text-muted-foreground">
                Você pode cadastrar até <strong>5 pacientes</strong>, realizar até <strong>20 atendimentos clínicos</strong> com <strong>1 formulário personalizado extra</strong> e até <strong>4 acessos simultâneos</strong> sem limite de tempo e sem necessidade de cartão de crédito.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        planId={selectedPlanId}
      />
    </div>
  );
}

