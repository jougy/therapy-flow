import React from "react";
import { UserRound, Building2, Sparkles, CheckCircle2, ChevronRight, Users, ShieldCheck, Database, FileSpreadsheet, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanPriceCalculation } from "@/utils/subscriptionPricing";

export interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: "solo" | "clinic" | "enterprise" | null;
  pricing: PlanPriceCalculation;
  isFreeCycle: boolean;
  onSelectPlan: (planId: "solo" | "clinic" | "enterprise") => void;
}

const PLAN_INFO = {
  solo: {
    name: "Profissional Solo",
    subtitle: "1 Profissional de Saúde Titular",
    icon: UserRound,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    badge: "Consultório Individual",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    description: "Ideal para psicólogos, terapeutas, fisioterapeutas e médicos que atendem individualmente e necessitam de prontuário ágil, seguro e em conformidade ética.",
    sections: [
      {
        title: "Capacidade & Acessos",
        icon: Users,
        items: [
          "1 Profissional de Saúde (Titular)",
          "1 Acesso simultâneo individual",
          "Atendimentos e consultas 100% ilimitados (no plano pago)",
          "Pacientes e prontuários ilimitados (no plano pago)",
        ],
      },
      {
        title: "Prontuário & Formulários",
        icon: FileSpreadsheet,
        items: [
          "Prontuário eletrônico completo com evolução clínica estruturada",
          "Anamnese personalizada e geração de atestados/laudos em PDF",
          "1 Formulário universal personalizável",
          "Histórico cronológico de sessões",
        ],
      },
      {
        title: "Segurança & Conformidade",
        icon: ShieldCheck,
        items: [
          "Garantia Ética: Acesso vitalício em Modo Leitura aos prontuários",
          "Criptografia ponta a ponta e conformidade com LGPD e CFP/CFM",
          "Backups diários automatizados",
        ],
      },
    ],
  },
  clinic: {
    name: "Clínica Pro",
    subtitle: "Equipes e Consultórios Compartilhados (Base 4 Assentos)",
    icon: Building2,
    colorClass: "text-primary dark:text-blue-400",
    bgClass: "bg-primary/10 border-primary/20",
    badge: "Recomendado para Equipes",
    badgeColor: "bg-primary text-primary-foreground",
    description: "A solução completa para clínicas de psicologia, terapia ocupacional, fonoaudiologia e centros multidisciplinares compartilharem infraestrutura com controle total de permissões.",
    sections: [
      {
        title: "Capacidade & Colaboração",
        icon: Users,
        items: [
          "Até 30 colaboradores cadastrados na base (profissionais e secretárias)",
          "4 Acessos simultâneos na base inclusos",
          "Expansão flexível de assentos: R$ 25,00/mês por acesso extra",
          "Atendimentos e pacientes ilimitados (no plano pago)",
        ],
      },
      {
        title: "Gestão & Permissões",
        icon: Lock,
        items: [
          "Controle avançado de permissões por perfil (RBAC: Secretária, Terapeuta, Administrador)",
          "Agendas compartilhadas em tempo real com visão integrada",
          "Módulo financeiro completo da clínica e pacotes de sessões",
          "Formulários clínicos e fichas complementares compartilháveis",
        ],
      },
      {
        title: "Segurança & Governança",
        icon: ShieldCheck,
        items: [
          "Prontuários protegidos com sigilo profissional estrito entre terapeutas",
          "Auditoria básica de movimentações",
          "Garantia de retenção documental médica por 20 anos conforme resoluções",
        ],
      },
    ],
  },
  enterprise: {
    name: "Enterprise",
    subtitle: "Grandes Clínicas, Redes e Franquias (Base 10 Assentos)",
    icon: Sparkles,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-500/10 border-purple-500/20",
    badge: "Alta Escala",
    badgeColor: "bg-purple-600 text-white",
    description: "Projetado para policlínicas, redes consolidadas e instituições de saúde com alta demanda de acessos simultâneos e necessidade de governança rigorosa.",
    sections: [
      {
        title: "Capacidade Máxima",
        icon: Users,
        items: [
          "Até 100 colaboradores e profissionais cadastrados",
          "10 Acessos simultâneos inclusos na base",
          "Melhor taxa marginal de expansão: apenas R$ 15,00/mês por vaga extra (-40% OFF)",
          "Atendimentos, pacientes e prontuários ilimitados",
        ],
      },
      {
        title: "Governança & Telemetria",
        icon: Database,
        items: [
          "Telemetria master e relatórios consolidados entre unidades",
          "Auditoria avançada de logs e acessos a dados sensíveis",
          "Formulários e templates clínicos ilimitados",
          "Suporte prioritário via WhatsApp e onboarding assistido",
        ],
      },
      {
        title: "Segurança de Nível Corporativo",
        icon: ShieldCheck,
        items: [
          "Garantia de SLA 99.9%",
          "Acordo de processamento de dados (DPA) corporativo",
          "Backups sob demanda e suporte a migração em lote",
        ],
      },
    ],
  },
};

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  isOpen,
  onClose,
  planId,
  pricing,
  isFreeCycle,
  onSelectPlan,
}) => {
  if (!planId) return null;
  const plan = PLAN_INFO[planId];
  const IconComponent = plan.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-2 text-left pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border shrink-0 ${plan.bgClass} ${plan.colorClass}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {plan.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground">
                  {plan.subtitle}
                </DialogDescription>
              </div>
            </div>
            <Badge className={`${plan.badgeColor} text-[10px] uppercase tracking-wider font-bold`}>
              {plan.badge}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            {plan.description}
          </p>
        </DialogHeader>

        {/* Resumo de Preço no Modal */}
        <div className="my-3 p-3.5 rounded-xl bg-muted/40 dark:bg-neutral-900/60 border border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs text-muted-foreground block">
              {isFreeCycle ? "Modalidade de Teste" : `Investimento (${pricing.periodLabel})`}
            </span>
            <span className="text-xl sm:text-2xl font-black text-foreground">
              {isFreeCycle ? "Degustação Grátis (7 dias)" : `R$ ${pricing.monthlyEquivalent.toFixed(2)}/mês`}
            </span>
          </div>
          {!isFreeCycle && (
            <div className="text-right text-xs text-muted-foreground">
              <span>Total: <strong>R$ {pricing.periodTotal.toFixed(2)}</strong></span>
              <span className="block text-emerald-600 dark:text-emerald-400 font-semibold">
                PIX à vista: R$ {pricing.pixDiscountTotal.toFixed(2)} (-5%)
              </span>
            </div>
          )}
        </div>

        {/* Especificações Detalhadas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {plan.sections.map((section, idx) => {
            const SectionIcon = section.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-card/70 border border-border/80 dark:border-neutral-800 space-y-2"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <SectionIcon className="w-3.5 h-3.5 text-primary" />
                  <span>{section.title}</span>
                </div>
                <ul className="space-y-1.5">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Rodapé de Ação */}
        <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs h-9">
            Fechar
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onClose();
              onSelectPlan(planId);
            }}
            className="rounded-xl text-xs h-9 font-bold bg-primary text-primary-foreground flex items-center gap-1 px-4"
          >
            <span>{isFreeCycle ? "Ativar Este Plano na Degustação" : "Contratar Este Plano"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
