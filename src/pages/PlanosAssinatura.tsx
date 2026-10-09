import React from "react";
import { ArrowLeft, Table2, Award, Sparkles } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { usePlanosState } from "./planos/hooks/usePlanosState";
import { PlanType, BillingCycle } from "@/utils/subscriptionPricing";
import {
  PlanAudienceSelector,
  PlanBillingCycleSelector,
  PlanCouponInput,
  PlanStepper,
  PlanStagePaid,
  PlanStageEnterprise,
  PlanComparisonModal,
  PlanDetailsModal,
  PlanFAQModal,
  AudienceType,
} from "./planos/components";

/**
 * Página Principal de Planos e Assinaturas (Bento Interativo Pluri-Health).
 *
 * Arquitetura & UX:
 * - Coluna Esquerda:
 *   - Eyebrow com ícone ⚡
 *   - Título e subtítulo dinâmico
 *   - Seletor de Perfil (Profissional, Clínica, Enterprise)
 *   - Seletor de Ciclos (Mensal, Trimestral -15%, Anual -35% OFF)
 *   - Stepper / Slider tátil ("Porte do seu atendimento") com 3 botões de etapa
 *   - Campo de Cupom Promocional
 *   - Trust signals: "✔ Ativação imediata · PIX com 5% de desconto"
 * - Coluna Direita (Palco Bento):
 *   - Card do plano ativo com animações suaves (Framer Motion)
 *   - Bloco de Bônus de Lançamento em gradiente âmbar
 *   - Grid de features com destaque em negrito
 *   - Ação de contratação direta (Solo pula onboarding e vai direto ao Asaas)
 *   - Visão Enterprise dedicada com dark slate
 */
export default function PlanosAssinatura() {
  const navigate = useNavigate();
  const [detailsPlanId, setDetailsPlanId] = React.useState<PlanType | null>(null);
  const [isFAQModalOpen, setIsFAQModalOpen] = React.useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = React.useState(false);

  // Estado do Stepper (0 = Básico, 1 = Médio, 2 = Top)
  const [stepIndex, setStepIndex] = React.useState(1);

  const {
    existingClinicName,
    hasActiveSubscription,
    activeSubscriptionPlan,
    activeSubscriptionCycle,
    audience,
    setAudience,
    selectedCycle,
    setSelectedCycle,
    selectedPlanId,
    activatingTrial,
    extraConcurrent,
    setExtraConcurrent,
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
    handleSelectPlan,
    isTermsModalOpen,
    setIsTermsModalOpen,
    loading,
    isModuleEnabled,
  } = usePlanosState();

  const [activeAudience, setActiveAudience] = React.useState<AudienceType>(audience);

  // Sincroniza audience do hook com activeAudience local
  React.useEffect(() => {
    if (activeAudience !== "enterprise") {
      setAudience(activeAudience);
    }
  }, [activeAudience, setAudience]);

  React.useEffect(() => {
    if (audience !== activeAudience && activeAudience !== "enterprise") {
      setActiveAudience(audience);
    }
  }, [audience, activeAudience]);

  const handleOpenDetails = React.useCallback((p: PlanType) => {
    setDetailsPlanId(p);
  }, []);

  const handleAudienceChange = React.useCallback((aud: AudienceType) => {
    setActiveAudience(aud);
    if (aud !== "enterprise") {
      setAudience(aud);
    }
  }, [setAudience]);

  // Resolução O(1) de pricing indexado para o modal de detalhes
  const pricingByPlanMap: Record<PlanType, typeof profMedioPricing> = React.useMemo(() => ({
    prof_basico: profBasicoPricing,
    prof_medio: profMedioPricing,
    prof_top: profTopPricing,
    clinica_basico: clinicaBasicoPricing,
    clinica_medio: clinicaMedioPricing,
    clinica_top: clinicaTopPricing,
    solo: profMedioPricing,
    clinic: clinicaMedioPricing,
    enterprise: clinicaTopPricing,
  }), [
    profBasicoPricing,
    profMedioPricing,
    profTopPricing,
    clinicaBasicoPricing,
    clinicaMedioPricing,
    clinicaTopPricing,
  ]);

  // Matriz de dados dos planos por perfil e step
  const currentPlan = React.useMemo(() => {
    if (activeAudience === "clinic") {
      if (stepIndex === 0) {
        return {
          id: "clinica_basico" as PlanType,
          name: "Básico",
          tagline: "Consultórios e salas compartilhadas",
          badge: undefined,
          featured: false,
          pricing: clinicaBasicoPricing,
          allowExtraSeats: true,
          baseSeatsLabel: "Base 2 acessos",
          features: [
            { text: "2 acessos simultâneos ao mesmo tempo", bold: true },
            { text: "Profissionais e colaboradores ilimitados para cadastrar", bold: true },
            { text: "Dono da clínica como administrador principal absoluto", bold: false },
            { text: "Permissões de acesso padrão e seguras para cada função", bold: false },
            { text: "Agendas compartilhadas por salas e macas", bold: false },
            { text: "Digitalização das suas fichas de papel de graça", bold: true },
          ],
        };
      }
      if (stepIndex === 2) {
        return {
          id: "clinica_top" as PlanType,
          name: "Top",
          tagline: "Grandes clínicas e alta rotatividade",
          badge: undefined,
          featured: false,
          pricing: clinicaTopPricing,
          allowExtraSeats: true,
          baseSeatsLabel: "Base 8 acessos",
          features: [
            { text: "8 acessos simultâneos ao mesmo tempo", bold: true },
            { text: "Histórico completo e trilha de quem acessou cada prontuário", bold: true },
            { text: "Gestão integrada de várias salas, macas e especialidades", bold: true },
            { text: "Personalização total de níveis de hierarquia da equipe", bold: true },
            { text: "Profissionais e colaboradores ilimitados para cadastrar", bold: false },
            { text: "Controle total sobre toda a estrutura clínica", bold: false },
          ],
        };
      }
      return {
        id: "clinica_medio" as PlanType,
        name: "Médio",
        tagline: "Clínicas consolidadas com equipe",
        badge: "Recomendado",
        featured: true,
        pricing: clinicaMedioPricing,
        allowExtraSeats: true,
        baseSeatsLabel: "Base 4 acessos",
        features: [
          { text: "4 acessos simultâneos ao mesmo tempo", bold: true },
          { text: "Controle automático de repasses e divisão de atendimentos", bold: true },
          { text: "Permissões 100% editáveis por função e membro da equipe", bold: true },
          { text: "Profissionais e colaboradores ilimitados para cadastrar", bold: false },
          { text: "Formulários e fichas personalizáveis para toda a clínica", bold: false },
          { text: "Dono no topo com controle total de segurança", bold: false },
        ],
      };
    }

    // Profissional
    if (stepIndex === 0) {
      return {
        id: "prof_basico" as PlanType,
        name: "Básico",
        tagline: "Profissional autônomo iniciando consultório",
        badge: undefined,
        featured: false,
        pricing: profBasicoPricing,
        allowExtraSeats: false,
        baseSeatsLabel: undefined,
        features: [
          { text: "1 acesso simultâneo individual", bold: true },
          { text: "1 formulário universal + 1 ficha complementar", bold: true },
          { text: "Pacientes e atendimentos ilimitados", bold: false },
          { text: "Prontuário eletrônico & evolução rápida", bold: false },
          { text: "Duplicação rápida: repete o atendimento anterior em 1 toque", bold: false },
          { text: "Agenda com envio de mensagens no WhatsApp", bold: false },
        ],
      };
    }
    if (stepIndex === 2) {
      return {
        id: "prof_top" as PlanType,
        name: "Top",
        tagline: "Máxima autonomia e apoio de secretária",
        badge: "Você + Apoio",
        featured: false,
        pricing: profTopPricing,
        allowExtraSeats: false,
        baseSeatsLabel: undefined,
        features: [
          { text: "2 acessos simultâneos (você + secretária ou assistente)", bold: true },
          { text: "Lembretes automáticos de agendamento por WhatsApp", bold: true },
          { text: "Recibos e relatórios de receitas automáticos", bold: true },
          { text: "Suporte e atendimento prioritário direto", bold: true },
          { text: "Pacientes e atendimentos ilimitados", bold: false },
          { text: "Todos os recursos do plano Médio inclusos", bold: false },
        ],
      };
    }
    return {
      id: "prof_medio" as PlanType,
      name: "Médio",
      tagline: "Alta demanda e fichas personalizadas",
      badge: "Mais Popular",
      featured: true,
      pricing: profMedioPricing,
      allowExtraSeats: false,
      baseSeatsLabel: undefined,
      features: [
        { text: "1 acesso simultâneo individual", bold: false },
        { text: "Formulários e fichas 100% ilimitadas e personalizáveis", bold: true },
        { text: "Seu histórico vai com você mesmo se mudar de consultório", bold: true },
        { text: "Controle financeiro de pagamentos e pacotes de sessões", bold: true },
        { text: "Pacientes e atendimentos ilimitados", bold: false },
        { text: "Todos os recursos clínicos e duplicação em 1 toque", bold: false },
      ],
    };
  }, [
    activeAudience,
    stepIndex,
    profBasicoPricing,
    profMedioPricing,
    profTopPricing,
    clinicaBasicoPricing,
    clinicaMedioPricing,
    clinicaTopPricing,
  ]);

  const isCurrentActive = React.useMemo(() => {
    if (!hasActiveSubscription || !activeSubscriptionPlan) return false;
    const activeNormalized =
      activeSubscriptionPlan === "solo" ? "prof_medio" :
      activeSubscriptionPlan === "clinic" ? "clinica_medio" :
      activeSubscriptionPlan === "enterprise" ? "clinica_top" :
      activeSubscriptionPlan;
    return currentPlan.id === activeNormalized;
  }, [hasActiveSubscription, activeSubscriptionPlan, currentPlan.id]);

  const activePlanDisplayName = React.useMemo(() => {
    if (!activeSubscriptionPlan) return "";
    switch (activeSubscriptionPlan) {
      case "prof_basico": return "Profissional Básico";
      case "prof_medio":
      case "solo": return "Profissional Médio";
      case "prof_top": return "Profissional Top";
      case "clinica_basico": return "Clínica Básico";
      case "clinica_medio":
      case "clinic": return "Clínica Médio";
      case "clinica_top":
      case "enterprise": return "Clínica Top";
      default: return "Plano Ilimitado";
    }
  }, [activeSubscriptionPlan]);

  if (!loading && !isModuleEnabled) {
    return <Navigate to="/espacopessoal" replace />;
  }

  const currentDetailsPricing = detailsPlanId
    ? pricingByPlanMap[detailsPlanId] || profMedioPricing
    : profMedioPricing;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-between px-3 sm:px-6 lg:px-8 py-3 sm:py-4 relative overflow-y-auto overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-[10%] left-[8%] w-[42vw] h-[42vh] rounded-full blur-[100px] opacity-35 bg-radial from-blue-500/20 to-transparent" />
        <div className="absolute -bottom-[12%] right-[8%] w-[38vw] h-[38vh] rounded-full blur-[100px] opacity-35 bg-radial from-sky-400/20 to-transparent" />
      </div>

      {/* Top bar de navegação e atalhos */}
      <header className="w-full max-w-6xl shrink-0 z-10 flex items-center justify-between h-9 mb-2 sm:mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/espacopessoal")}
          className="text-muted-foreground hover:text-foreground -ml-2 gap-1.5 font-medium h-8 text-xs sm:text-sm min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Espaço Pessoal</span>
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold transition-colors min-h-[32px] cursor-pointer"
          >
            <Table2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Comparar Todos os Planos</span>
            <span className="sm:hidden">Comparativo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 border border-primary/20 text-xs font-semibold transition-colors min-h-[32px] cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Dúvidas Frequentes & Garantias</span>
            <span className="sm:hidden">Dúvidas</span>
          </button>
        </div>
      </header>

      {/* Grid Bento Principal (2 Colunas) */}
      <main className="w-full max-w-6xl z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center my-auto py-2">
        {/* ================= Coluna Esquerda: Controles ================= */}
        <section className="lg:col-span-5 flex flex-col items-start gap-3 sm:gap-4 min-w-0">
          {hasActiveSubscription && activeSubscriptionPlan && (
            <div className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-emerald-500/10 border border-emerald-500/30 text-foreground flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Plano Ilimitado Ativo
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      {activePlanDisplayName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {existingClinicName ? `Espaço: ${existingClinicName}` : "Seu espaço está com plano ilimitado ativo."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-extrabold tracking-wide">
            <span aria-hidden="true">⚡</span> Planos interativos
          </span>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
              Um sistema que cresce com o seu atendimento.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              {existingClinicName
                ? `Configurando espaço: ${existingClinicName}. Escolha o perfil e período.`
                : "Escolha seu perfil, o porte da sua rotina e o período. O plano e o valor se ajustam na hora."}
            </p>
          </div>

          {/* Seletor de Perfil */}
          <PlanAudienceSelector
            audience={activeAudience}
            onSelectAudience={handleAudienceChange}
          />

          {/* Seletor de Ciclos */}
          {activeAudience !== "enterprise" && (
            <PlanBillingCycleSelector
              selectedCycle={selectedCycle === "free" ? "annual" : selectedCycle}
              onSelectCycle={setSelectedCycle}
            />
          )}

          {/* Stepper / Slider de Porte */}
          {activeAudience !== "enterprise" && (
            <PlanStepper
              stepIndex={stepIndex}
              onChangeStep={setStepIndex}
              audience={activeAudience}
            />
          )}

          {/* Cupom Promocional */}
          {activeAudience !== "enterprise" && (
            <div className="w-full">
              <PlanCouponInput
                couponInput={couponInput}
                onCouponInputChange={setCouponInput}
                validatingCoupon={validatingCoupon}
                onValidateCoupon={handleValidateCoupon}
                appliedCoupon={appliedCoupon}
                couponError={couponError}
                onRemoveCoupon={handleRemoveCoupon}
              />
            </div>
          )}

          {/* Trust signals */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium pt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✔ Ativação imediata</span>
            <span>·</span>
            <span>PIX com 5% de desconto</span>
          </div>
        </section>

        {/* ================= Coluna Direita: Palco Dinâmico ================= */}
        <section className="lg:col-span-7 flex flex-col justify-center min-w-0">
          {activeAudience === "enterprise" ? (
            <PlanStageEnterprise
              key="enterprise"
              onSelectEnterprise={handleSelectPlan}
            />
          ) : (
            <PlanStagePaid
              key={currentPlan.id + selectedCycle}
              planId={currentPlan.id}
              name={currentPlan.name}
              tagline={currentPlan.tagline}
              badge={currentPlan.badge}
              featured={currentPlan.featured}
              isCurrentActivePlan={isCurrentActive}
              features={currentPlan.features}
              pricing={currentPlan.pricing}
              cycle={selectedCycle}
              onSelectPlan={handleSelectPlan}
              onOpenDetails={handleOpenDetails}
              activatingTrial={activatingTrial}
              allowExtraSeats={currentPlan.allowExtraSeats}
              extraSeatsCount={extraConcurrent}
              onExtraSeatsChange={setExtraConcurrent}
              baseSeatsLabel={currentPlan.baseSeatsLabel}
            />
          )}
        </section>
      </main>

      {/* Rodapé Compacto */}
      <footer className="w-full max-w-6xl shrink-0 z-10 pt-3 pb-1 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 text-center sm:text-left">
          <span className="font-bold text-foreground">Pluri Fisio:</span>
          <span>Pagamento no PIX com 5% de desconto · Cancele quando quiser.</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(true)}
            className="hover:text-foreground underline font-medium cursor-pointer"
          >
            Ver Tabela Comparativa Completa
          </button>
          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="hover:text-foreground underline font-medium cursor-pointer"
          >
            Dúvidas & Perguntas Frequentes
          </button>
        </div>
      </footer>

      {/* Modais de Suporte e Detalhamento */}
      <PlanDetailsModal
        isOpen={detailsPlanId !== null}
        onClose={() => setDetailsPlanId(null)}
        planId={detailsPlanId}
        pricing={currentDetailsPricing}
        isFreeCycle={false}
        onSelectPlan={handleSelectPlan}
      />

      <PlanComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
      />

      <PlanFAQModal
        isOpen={isFAQModalOpen}
        onClose={() => setIsFAQModalOpen(false)}
      />

      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        planId={selectedPlanId}
      />
    </div>
  );
}
