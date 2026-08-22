import { useState } from "react";
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
  Calculator, 
  ShieldCheck,
  Zap,
  Users,
  CreditCard
} from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { supabase } from "@/integrations/supabase/client";

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
  const { isFeatureEnabled, loading } = useFeatureFlags();
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // State da Calculadora em Tempo Real
  const [extraConcurrent, setExtraConcurrent] = useState(0);
  const [extraSpaces, setExtraSpaces] = useState(0);

  // State do Cupom
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

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
        _code: couponInput.trim(),
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
    } catch (err: unknown) {
      setAppliedCoupon(null);
      setCouponError("Erro ao validar cupom. Tente novamente.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Cálculos Financeiros
  const baseClinicPrice = 60.0;
  const rawClinicMonthlyPrice = baseClinicPrice + extraConcurrent * 10.0;
  let finalClinicMonthlyPrice = rawClinicMonthlyPrice;

  if (appliedCoupon && appliedCoupon.valid) {
    if (appliedCoupon.discount_type === "PERCENTAGE") {
      finalClinicMonthlyPrice = Math.max(0, rawClinicMonthlyPrice * (1 - (appliedCoupon.discount_value || 0) / 100));
    } else if (appliedCoupon.discount_type === "FIXED_AMOUNT") {
      finalClinicMonthlyPrice = Math.max(0, rawClinicMonthlyPrice - (appliedCoupon.discount_value || 0));
    }
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setIsTermsModalOpen(true);
  };

  const handleProceedToOnboarding = (planId: string) => {
    let url = `/onboarding-clinica?plan=${planId}`;
    if (planId === "clinic") {
      url += `&concurrent=${2 + extraConcurrent}&spaces=${30 + extraSpaces}`;
    }
    if (appliedCoupon?.code) {
      url += `&coupon=${appliedCoupon.code}`;
    }
    navigate(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 text-center mb-8 max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-semibold mb-4">
          <Sparkles className="w-4 h-4" />
          Fase Beta: Assinatura 100% Isenta
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          Planos Transparentes para sua Clínica
        </h1>
        <p className="text-sm md:text-base text-neutral-400 max-w-2xl mx-auto">
          Escolha o plano ideal com calculadora de recursos em tempo real e suporte a cupons promocionais.
        </p>
      </motion.div>

      {/* Caixa de Cupom de Desconto Global */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="z-10 w-full max-w-xl mb-10 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-xl shadow-2xl space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <Tag className="w-4 h-4" />
          Possui um Cupom de Desconto?
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Ex: PRIMEIROMES100, BETA50, DEGUSTACAO30"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600 rounded-xl h-11 text-sm font-mono tracking-wider uppercase focus:border-blue-500"
          />
          <Button
            onClick={handleValidateCoupon}
            disabled={validatingCoupon || !couponInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-11 px-5 text-sm shrink-0"
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
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">
                  Cupom <strong>{appliedCoupon.code}</strong> aplicado: {appliedCoupon.description}
                </span>
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/20 text-[10px]">
                {appliedCoupon.discount_type === "PERCENTAGE" && `${appliedCoupon.discount_value}% OFF`}
                {appliedCoupon.discount_type === "FIXED_AMOUNT" && `R$ ${appliedCoupon.discount_value} OFF`}
                {appliedCoupon.discount_type === "TRIAL_DAYS" && `${appliedCoupon.discount_value} Dias Gratis`}
              </Badge>
            </motion.div>
          )}

          {couponError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{couponError}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Grid de Planos */}
      <div className="z-10 grid md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Card 1: Plano Solo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-neutral-800 to-neutral-900"
        >
          <div className="h-full rounded-[23px] bg-neutral-950/90 backdrop-blur-xl p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                  <UserRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Profissional Solo</h3>
                  <p className="text-xs text-emerald-400 font-medium">1 Profissional de Saúde</p>
                </div>
              </div>

              <p className="text-neutral-400 text-sm mb-6 min-h-[40px]">
                Perfeito para profissionais autônomos organizarem atendimentos individuais com total segurança.
              </p>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">R$ 50</span>
                  <span className="text-neutral-400 text-sm font-medium">/mês</span>
                </div>
                <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Isento na Fase Beta
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  "1 Profissional de saúde (titular)",
                  "1 Acesso simultâneo por vez",
                  "Prontuário eletrônico completo",
                  "Agendamento e calendário inteligente",
                  "Sem cobrança de subcontas",
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-white text-neutral-950 hover:bg-neutral-200 h-12 text-sm font-bold rounded-xl transition-all shadow-lg"
              onClick={() => {
                setSelectedPlanId("solo");
                handleProceedToOnboarding("solo");
              }}
            >
              Escolher Profissional Solo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>

        {/* Card 2: Plano Clínica com Equipe (Com Calculadora Interativa) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-blue-500 to-blue-900 shadow-2xl shadow-blue-900/30"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />

          <div className="h-full rounded-[23px] bg-neutral-950/90 backdrop-blur-xl p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Clínica com Equipe</h3>
                    <p className="text-xs text-blue-400 font-medium">Equipes e Consultórios Compartilhados</p>
                  </div>
                </div>
                <Badge className="bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider">
                  Recomendado
                </Badge>
              </div>

              <p className="text-neutral-400 text-sm mb-6 min-h-[40px]">
                Gestão completa de secretárias, profissionais e colaboradores com cotas personalizáveis.
              </p>

              <div className="mb-6">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-neutral-400">a partir de</span>
                  <span className="text-4xl font-extrabold text-white">R$ 60</span>
                  <span className="text-neutral-400 text-sm font-medium">/mês</span>
                </div>
                {appliedCoupon && appliedCoupon.valid ? (
                  <p className="text-xs text-blue-400 font-semibold mt-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Cupom {appliedCoupon.code} aplicado
                  </p>
                ) : (
                  <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Isento na Fase Beta
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {[
                  "Colaboradores e equipe ilimitados",
                  "2 acessos simultâneos inclusos (+R$ 10/mês por extra)",
                  "Controle avançado de permissões (RBAC)",
                  "Agendas compartilhadas e telemetria master",
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-xl shadow-blue-500/30 h-12 text-sm font-bold rounded-xl transition-all"
              onClick={() => {
                setSelectedPlanId("clinic");
                handleProceedToOnboarding("clinic");
              }}
            >
              Começar no Plano Clínica com Equipe
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      </div>

      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        planId={selectedPlanId}
      />
    </div>
  );
}
