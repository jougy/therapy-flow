import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Award, ArrowLeft, Table2, User, UserCheck, Shield, Building2 } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { usePlanosState } from "./planos/hooks/usePlanosState";
import { PlanType } from "@/utils/subscriptionPricing";
import {
  PlanAudienceSelector,
  PlanBillingCycleSelector,
  PlanCouponInput,
  PlanCardTier,
  PlanEnterpriseBanner,
  PlanComparisonModal,
  PlanDetailsModal,
  PlanFAQModal,
  PlanTrialExplanationModal,
} from "./planos/components";

/**
 * Página Principal de Planos e Assinaturas (Orquestrador Declarativo).
 *
 * Arquitetura & Qualidade de Engenharia:
 * - Seletor de Perfil no Topo: [Para Profissional] vs [Para Clínica] (Fiel à Landing Page).
 * - Seletor de Ciclos: Teste gratuito (7 dias), Mensal, Trimestral (-10%), Anual (Até 33% OFF).
 * - Grid dinâmico dos 3 tiers do perfil ativo:
 *   - Profissional: Básico (R$ 39,99/mês), Médio ("Mais Popular", R$ 59,99/mês), Top ("Você + Apoio", R$ 89,99/mês).
 *   - Clínica: Básico (R$ 99/mês), Médio ("Recomendado", R$ 139/mês), Top (R$ 199/mês).
 * - Banner Enterprise inferior ("Redes de clínicas ou hospitais? Vamos conversar").
 * - Modal com a Tabela Comparativa Completa dos planos.
 * - Mobile-first rigoroso: overflow-y-auto funcional com suporte a telas 375px/390px.
 */
export default function PlanosAssinatura() {
  const navigate = useNavigate();
  const [detailsPlanId, setDetailsPlanId] = React.useState<PlanType | null>(null);
  const [isFAQModalOpen, setIsFAQModalOpen] = React.useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = React.useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = React.useState(false);

  const {
    existingClinicName,
    hasActiveSubscription,
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

  if (!loading && !isModuleEnabled) {
    return <Navigate to="/espacopessoal" replace />;
  }

  const handleOpenDetails = React.useCallback((p: PlanType) => {
    setDetailsPlanId(p);
  }, []);

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

  const currentDetailsPricing = detailsPlanId ? (pricingByPlanMap[detailsPlanId] || profMedioPricing) : profMedioPricing;

  return (
    <div className="min-h-screen lg:h-[100dvh] bg-background text-foreground flex flex-col items-center justify-start lg:justify-between px-3 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-3 relative overflow-y-auto overflow-x-hidden">
      {/* Botão de Retorno e Ações de Apoio no Topo */}
      <div className="w-full max-w-7xl shrink-0 z-10 flex items-center justify-between h-8 sm:h-9 mb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/espacopessoal")}
          className="text-muted-foreground hover:text-foreground -ml-2 gap-1.5 font-medium h-8 text-xs sm:text-sm min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Espaço Pessoal
        </Button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold transition-colors min-h-[32px]"
          >
            <Table2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Comparar Todos os Planos</span>
            <span className="sm:hidden">Comparativo</span>
          </button>

          {!hasActiveSubscription && isFreeTrialEnabled && (
            <button
              type="button"
              onClick={() => setIsTrialModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors min-h-[32px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Como funciona o teste gratuito?</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 border border-primary/20 text-xs font-semibold transition-colors min-h-[32px]"
          >
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Dúvidas Frequentes & Garantias</span>
            <span className="sm:hidden">Dúvidas</span>
          </button>
        </div>
      </div>

      {/* Ambient Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 dark:bg-blue-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header com Apresentação de Título Compacto */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="z-10 text-center shrink-0 mb-1 lg:mb-2 max-w-2xl space-y-1.5"
      >
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-widest uppercase">
          Transparência Total
        </div>

        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          Planos que cabem no momento do seu trabalho.
        </h1>
        <p className="text-xs text-muted-foreground max-w-xl mx-auto line-clamp-1">
          {existingClinicName
            ? `Configurando o espaço: ${existingClinicName}`
            : "Recursos clínicos essenciais sempre inclusos, sem limites de pacientes ou atendimentos."}
        </p>

        {/* 1. Seletor de Perfil: [Para Profissional] vs [Para Clínica] */}
        <PlanAudienceSelector
          audience={audience}
          onSelectAudience={setAudience}
        />

        {/* 2. Ciclos de Faturamento */}
        <PlanBillingCycleSelector
          selectedCycle={selectedCycle}
          onSelectCycle={setSelectedCycle}
          hasActiveSubscription={hasActiveSubscription}
          isFreeTrialEnabled={isFreeTrialEnabled}
        />
      </motion.div>

      {/* Caixa de Cupom (Planos Pagos) */}
      {!isFreeCycle && (
        <div className="z-10 shrink-0 mb-1 w-full max-w-md">
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

      {/* Grid de Planos Principais: Opção Única no Teste Gratuito (Clínica Médio) ou 3 Tiers por Perfil */}
      {isFreeCycle ? (
        <div className="z-10 w-full max-w-xl flex-1 flex flex-col justify-center items-center my-1 mx-auto">
          <div className="w-full">
            <PlanCardTier
              planId="clinica_medio"
              name="Clínica Médio"
              tagline="Clínicas consolidadas com equipe"
              badge="Degustação Completa"
              featured={true}
              icon={Building2}
              colorTheme="blue"
              features={[
                "4 acessos simultâneos ao mesmo tempo",
                "Profissionais e colaboradores ilimitados para cadastrar",
                "Dono no topo com controle total de segurança",
                "Permissões editáveis: defina exatamente o que cada pessoa vê",
                "Atendimentos e pacientes 100% ilimitados",
              ]}
              pricing={clinicaMedioPricing}
              isFreeCycle={true}
              isSelected={true}
              onSelectPlan={handleSelectPlan}
              onOpenDetails={handleOpenDetails}
              activatingTrial={activatingTrial}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            O teste gratuito concede acesso completo aos recursos do plano <strong>Clínica Médio</strong> com 4 acessos simultâneos durante 7 dias.
          </p>
        </div>
      ) : audience === "prof" ? (
        /* Grupo de Planos Profissionais (Básico, Médio e Top) */
        <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 xl:gap-5 w-full max-w-7xl flex-1 items-stretch min-h-0 my-1">
          <PlanCardTier
            planId="prof_basico"
            name="Básico"
            tagline="Profissional autônomo iniciando consultório"
            icon={User}
            colorTheme="emerald"
            features={[
              "1 acesso simultâneo individual",
              "Pacientes e atendimentos ilimitados",
              "Prontuário eletrônico & evolução rápida",
              "Duplicação rápida: repete a conduta anterior em 30s",
              "1 formulário universal + 1 ficha complementar",
              "Agenda com envio de mensagens no WhatsApp",
            ]}
            pricing={profBasicoPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "prof_basico"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
          />

          <PlanCardTier
            planId="prof_medio"
            name="Médio"
            tagline="Alta demanda e fichas personalizadas"
            badge="Mais Popular"
            featured={true}
            icon={UserCheck}
            colorTheme="blue"
            features={[
              "1 acesso simultâneo individual",
              "Pacientes e atendimentos ilimitados",
              "Todos os recursos clínicos essenciais inclusos",
              "Formulários e fichas de avaliação ilimitadas e customizáveis",
              "Seu histórico vai com você mesmo se mudar de consultório",
              "Controle de pagamentos e pacotes de sessões",
            ]}
            pricing={profMedioPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "prof_medio"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
          />

          <PlanCardTier
            planId="prof_top"
            name="Top"
            tagline="Máxima autonomia e apoio de secretária"
            badge="Você + Apoio"
            icon={Shield}
            colorTheme="purple"
            features={[
              "2 acessos simultâneos (você + secretária ou assistente)",
              "Pacientes e atendimentos ilimitados",
              "Todos os recursos do plano Médio inclusos",
              "Recibos e relatórios de receitas automáticos",
              "Lembretes automáticos de agendamento por WhatsApp",
              "Atendimento e suporte prioritário",
            ]}
            pricing={profTopPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "prof_top"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
          />
        </div>
      ) : (
        /* Grupo de Planos Clínica (Básico, Médio e Top) */
        <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 xl:gap-5 w-full max-w-7xl flex-1 items-stretch min-h-0 my-1">
          <PlanCardTier
            planId="clinica_basico"
            name="Básico"
            tagline="Consultórios e salas compartilhadas"
            icon={Building2}
            colorTheme="purple"
            features={[
              "2 acessos simultâneos ao mesmo tempo",
              "Profissionais e colaboradores ilimitados para cadastrar",
              "Dono da clínica como administrador principal absoluto",
              "Permissões de acesso padrão e seguras para cada função",
              "Agendas compartilhadas por salas e macas",
              "Passamos suas fichas de papel para o sistema de graça",
            ]}
            pricing={clinicaBasicoPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "clinica_basico"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
            allowExtraSeats={true}
            extraSeatsCount={extraConcurrent}
            onExtraSeatsChange={setExtraConcurrent}
            baseSeatsLabel="Base 2 acessos"
          />

          <PlanCardTier
            planId="clinica_medio"
            name="Médio"
            tagline="Clínicas consolidadas com equipe"
            badge="Recomendado"
            featured={true}
            icon={Building2}
            colorTheme="blue"
            features={[
              "4 acessos simultâneos ao mesmo tempo",
              "Profissionais e colaboradores ilimitados para cadastrar",
              "Dono no topo com controle total de segurança",
              "Permissões editáveis: defina o que cada membro pode ver",
              "Controle automático de repasses e divisão de atendimentos",
              "Formulários e fichas personalizáveis para toda a clínica",
            ]}
            pricing={clinicaMedioPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "clinica_medio"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
            allowExtraSeats={true}
            extraSeatsCount={extraConcurrent}
            onExtraSeatsChange={setExtraConcurrent}
            baseSeatsLabel="Base 4 acessos"
          />

          <PlanCardTier
            planId="clinica_top"
            name="Top"
            tagline="Grandes clínicas e alta rotatividade"
            icon={Sparkles}
            colorTheme="purple"
            features={[
              "8 acessos simultâneos ao mesmo tempo",
              "Profissionais e colaboradores ilimitados para cadastrar",
              "Dono com controle total sobre toda a estrutura da clínica",
              "Personalização total de cargos, níveis e regras de acesso",
              "Gestão integrada de várias salas e especialidades",
              "Histórico completo de auditoria em cada prontuário",
            ]}
            pricing={clinicaTopPricing}
            isFreeCycle={false}
            isSelected={selectedPlanId === "clinica_top"}
            onSelectPlan={handleSelectPlan}
            onOpenDetails={handleOpenDetails}
            activatingTrial={activatingTrial}
            allowExtraSeats={true}
            extraSeatsCount={extraConcurrent}
            onExtraSeatsChange={setExtraConcurrent}
            baseSeatsLabel="Base 8 acessos"
          />
        </div>
      )}

      {/* Banner Enterprise Inferior ("Redes de clínicas ou hospitais? Vamos conversar") */}
      <PlanEnterpriseBanner />

      {/* Rodapé Compacto com Gatilhos de Modal e Garantia Ética */}
      <div className="w-full max-w-7xl shrink-0 z-10 pt-2 pb-1 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 text-center sm:text-left">
          <span className="font-semibold text-foreground">Pluri Fisio:</span>
          <span>Pagamento no PIX com 5% de desconto · Cancele quando quiser · Sem fidelidade.</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(true)}
            className="hover:text-foreground underline font-medium"
          >
            Ver Tabela Comparativa Completa
          </button>
          {!hasActiveSubscription && isFreeTrialEnabled && (
            <button
              type="button"
              onClick={() => setIsTrialModalOpen(true)}
              className="hover:text-foreground underline sm:hidden font-medium"
            >
              Regras do teste gratuito
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="hover:text-foreground underline font-medium"
          >
            Dúvidas & Perguntas Frequentes
          </button>
        </div>
      </div>

      {/* Modais de Suporte e Detalhamento */}
      <PlanDetailsModal
        isOpen={detailsPlanId !== null}
        onClose={() => setDetailsPlanId(null)}
        planId={detailsPlanId}
        pricing={currentDetailsPricing}
        isFreeCycle={isFreeCycle}
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

      <PlanTrialExplanationModal
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
        onSelectPlan={handleSelectPlan}
      />

      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        planId={selectedPlanId}
      />
    </div>
  );
}
