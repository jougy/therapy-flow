import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Sparkles, Building2, UserRound } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { useState } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

export default function PlanosAssinatura() {
  const navigate = useNavigate();
  const { isFeatureEnabled, loading } = useFeatureFlags();
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (!loading && !isFeatureEnabled("subscriptions_module")) {
    return <Navigate to="/espacopessoal" replace />;
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setIsTermsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Fase Beta: Acesso 100% Gratuito
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
          Escolha o plano ideal para você
        </h1>
        <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
          Aproveite todos os recursos premium do Pluri-Health gratuitamente durante nossa fase beta. 
          Sem compromisso, sem cartão de crédito.
        </p>
      </motion.div>

      <div className="z-10 grid md:grid-cols-2 gap-6 w-full max-w-5xl">
        {/* Plano Solo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-neutral-800 to-neutral-900"
        >
          <div className="h-full rounded-[23px] bg-neutral-950/80 backdrop-blur-xl p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                <UserRound className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white">Profissional Solo</h3>
            </div>
            <p className="text-neutral-400 mb-6 min-h-[48px]">
              Perfeito para profissionais autônomos que desejam organizar seus atendimentos com excelência.
            </p>
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">R$ 50</span>
                <span className="text-neutral-400 text-lg font-medium">/mês</span>
              </div>
              <p className="text-emerald-400 text-sm font-medium mt-1">Fase Beta: Acesso 100% Gratuito</p>
            </div>
            
            <div className="space-y-4 mb-8 flex-1">
              {[
                "1 Profissional de saúde (titular)",
                "Sem cobrança de subcontas",
                "1 Acesso simultâneo por vez",
                "Gestão completa de pacientes",
                "Prontuário eletrônico inteligente",
                "Agendamento e calendário completo",
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-neutral-300">{feature}</span>
                </div>
              ))}
            </div>

            <Button 
              className="w-full bg-white text-neutral-950 hover:bg-neutral-200 h-12 text-base font-semibold group-hover:scale-[1.02] transition-transform"
              onClick={() => handleSelectPlan("solo")}
            >
              Começar como Profissional Solo
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </motion.div>

        {/* Plano Clínica */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative group rounded-3xl p-px bg-gradient-to-b from-blue-500 to-blue-900 shadow-2xl shadow-blue-900/20"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
          
          <div className="h-full rounded-[23px] bg-neutral-950/80 backdrop-blur-xl p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />
            
            <div className="flex items-center justify-between mb-4 relative">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Clínica com Equipe</h3>
              </div>
              <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Popular
              </span>
            </div>
            <p className="text-neutral-400 mb-6 min-h-[48px] relative">
              Para clínicas e consultórios compartilhados que precisam de colaboração e múltiplos acessos.
            </p>
            <div className="mb-8 relative">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">R$ 60</span>
                <span className="text-neutral-400 text-lg font-medium">/mês base</span>
              </div>
              <p className="text-emerald-400 text-sm font-medium mt-1">Fase Beta: Acesso 100% Gratuito</p>
            </div>
            
            <div className="space-y-4 mb-6 flex-1 relative">
              {[
                "30 vagas para cadastro de colaboradores",
                "2 acessos simultâneos inclusos na base",
                "Múltiplos profissionais e secretárias",
                "Permissões e controle de acesso (RBAC)",
                "Agendas compartilhadas e relatórios",
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-neutral-300">{feature}</span>
                </div>
              ))}
            </div>

            {/* Badges de Expansão de Cotas */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2 mb-8 relative">
              <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Expansões de Cotas Disponíveis:</div>
              <div className="text-xs text-neutral-300 flex items-center justify-between">
                <span>Acesso simultâneo adicional:</span>
                <span className="font-semibold text-white">+R$ 10/mês</span>
              </div>
              <div className="text-xs text-neutral-300 flex items-center justify-between">
                <span>Vaga extra de colaborador:</span>
                <span className="font-semibold text-emerald-400">R$ 5,00 (avulso)</span>
              </div>
            </div>

            <Button 
              className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 h-12 text-base font-semibold group-hover:scale-[1.02] transition-transform relative"
              onClick={() => handleSelectPlan("clinic")}
            >
              Começar com Equipe
              <ChevronRight className="w-5 h-5 ml-1" />
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
