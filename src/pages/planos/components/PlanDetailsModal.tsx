import React from "react";
import { UserRound, Building2, Sparkles, CheckCircle2, ChevronRight, Users, ShieldCheck, Database, FileSpreadsheet, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanPriceCalculation, PlanType } from "@/utils/subscriptionPricing";

export interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: PlanType | null;
  pricing: PlanPriceCalculation;
  isFreeCycle: boolean;
  onSelectPlan: (planId: PlanType) => void;
}

const PLAN_INFO: Record<PlanType, {
  name: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  badge: string;
  badgeColor: string;
  description: string;
  sections: Array<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: string[];
  }>;
}> = {
  prof_basico: {
    name: "Profissional Básico",
    subtitle: "Profissional autônomo iniciando consultório",
    icon: UserRound,
    colorClass: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-500/10 border-sky-500/20",
    badge: "1 Acesso Individual",
    badgeColor: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
    description: "Ideal para profissionais autônomos que estão começando e precisam de prontuário ágil, seguro e em conformidade ética com o melhor custo-benefício.",
    sections: [
      {
        title: "Capacidade & Acessos",
        icon: Users,
        items: [
          "1 Acesso simultâneo individual",
          "1 Profissional titular",
          "Atendimentos e pacientes 100% ilimitados",
          "Posse perpétua dos prontuários",
        ],
      },
      {
        title: "Recursos Clínicos",
        icon: FileSpreadsheet,
        items: [
          "Prontuário eletrônico completo e evolução rápida",
          "Duplicação rápida: repete o atendimento anterior em até 30s",
          "1 Formulário padrão universal + 1 ficha complementar",
          "Agenda com envio de mensagens no WhatsApp",
        ],
      },
      {
        title: "Segurança & Conformidade",
        icon: ShieldCheck,
        items: [
          "Garantia Ética: Acesso vitalício em Modo Leitura aos prontuários",
          "Criptografia ponta a ponta e conformidade com LGPD e CFM/CREFITO",
          "Backups diários automatizados",
        ],
      },
    ],
  },
  prof_medio: {
    name: "Profissional Médio",
    subtitle: "Alta demanda e fichas personalizadas",
    icon: UserRound,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10 border-blue-500/20",
    badge: "Mais Popular",
    badgeColor: "bg-blue-600 text-white",
    description: "Para o profissional consolidado que necessita de formulários de avaliação personalizados e controle financeiro completo de sessões e pacotes.",
    sections: [
      {
        title: "Capacidade & Acessos",
        icon: Users,
        items: [
          "1 Acesso simultâneo individual",
          "1 Profissional titular",
          "Atendimentos e pacientes 100% ilimitados",
          "Seu histórico vai com você mesmo se mudar de clínica",
        ],
      },
      {
        title: "Fichas & Financeiro",
        icon: FileSpreadsheet,
        items: [
          "Formulários e fichas de avaliação ilimitadas e customizáveis",
          "Duplicação rápida de evolução em até 30 segundos",
          "Controle completo de pagamentos e pacotes de sessões",
          "Prontuário completo com anamnese e condutas",
        ],
      },
      {
        title: "Segurança & Conformidade",
        icon: ShieldCheck,
        items: [
          "Garantia Ética CFM/CFP e conformidade total LGPD",
          "Backups diários automatizados",
          "Atalhos de comunicação no WhatsApp",
        ],
      },
    ],
  },
  prof_top: {
    name: "Profissional Top",
    subtitle: "Máxima autonomia e apoio de secretária",
    icon: UserRound,
    colorClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-500/10 border-indigo-500/20",
    badge: "Você + Apoio",
    badgeColor: "bg-indigo-600 text-white",
    description: "Para profissionais que trabalham com secretária ou assistente: 2 acessos simultâneos, lembretes automáticos por WhatsApp e recibos.",
    sections: [
      {
        title: "Capacidade & Equipe",
        icon: Users,
        items: [
          "2 Acessos simultâneos (Você + sua secretária ou assistente)",
          "2 Usuários cadastrados (Titular + Colaborador de Apoio)",
          "Atendimentos e pacientes 100% ilimitados",
          "Papel de apoio 100% editável e customizável",
        ],
      },
      {
        title: "Automação & Financeiro",
        icon: FileSpreadsheet,
        items: [
          "Lembretes automáticos de agendamento por WhatsApp",
          "Recibos e relatórios de receitas automáticos",
          "Todos os recursos do plano Médio inclusos",
          "Formulários e fichas ilimitadas",
        ],
      },
      {
        title: "Segurança & Suporte",
        icon: ShieldCheck,
        items: [
          "Suporte prioritário via WhatsApp",
          "Garantia Ética de acesso perpétuo aos prontuários",
          "Controle estrito de permissões da secretária",
        ],
      },
    ],
  },
  clinica_basico: {
    name: "Clínica Básico",
    subtitle: "Consultórios e salas compartilhadas",
    icon: Building2,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-500/10 border-purple-500/20",
    badge: "2 Acessos Base",
    badgeColor: "bg-purple-600 text-white",
    description: "Ideal para salas compartilhadas e consultórios com 2 profissionais ou 1 profissional e 1 recepcionista conectados simultaneamente.",
    sections: [
      {
        title: "Capacidade & Equipe",
        icon: Users,
        items: [
          "2 Acessos simultâneos inclusos na base",
          "Profissionais e colaboradores ilimitados para cadastrar",
          "Expansão flexível: apenas R$ 25,00/mês por acesso extra",
          "Atendimentos e pacientes ilimitados",
        ],
      },
      {
        title: "Gestão da Clínica",
        icon: Lock,
        items: [
          "Dono da clínica como administrador principal absoluto",
          "Permissões de acesso padrão e seguras para cada função",
          "Agendas compartilhadas por salas e macas",
          "Migração grátis de fichas de papel para o sistema",
        ],
      },
      {
        title: "Segurança & Conformidade",
        icon: ShieldCheck,
        items: [
          "Prontuários centralizados na clínica",
          "Guarda legal de 20 anos CFM/CFP e conformidade LGPD",
          "Backups diários automatizados",
        ],
      },
    ],
  },
  clinica_medio: {
    name: "Clínica Médio",
    subtitle: "Clínicas consolidadas com equipe",
    icon: Building2,
    colorClass: "text-primary dark:text-blue-400",
    bgClass: "bg-primary/10 border-primary/20",
    badge: "Recomendado",
    badgeColor: "bg-primary text-primary-foreground",
    description: "A solução ideal para clínicas em crescimento: 4 acessos simultâneos base, equipe ilimitada, permissões totalmente editáveis e repasses.",
    sections: [
      {
        title: "Capacidade & Equipe",
        icon: Users,
        items: [
          "4 Acessos simultâneos inclusos na base",
          "Profissionais e colaboradores ilimitados para cadastrar",
          "Expansão flexível: R$ 25,00/mês por vaga extra",
          "Atendimentos e pacientes ilimitados",
        ],
      },
      {
        title: "Permissões & Repasses",
        icon: Lock,
        items: [
          "Permissões editáveis: defina exatamente o que cada membro pode ver e fazer",
          "Controle automático de repasses e divisão de atendimentos",
          "Formulários e fichas personalizáveis para toda a clínica",
          "Agendas compartilhadas por salas e profissionais",
        ],
      },
      {
        title: "Segurança & Governança",
        icon: ShieldCheck,
        items: [
          "Dono no topo com controle inalienável de segurança",
          "Prontuários protegidos com sigilo profissional estrito",
          "Auditoria básica de movimentações",
        ],
      },
    ],
  },
  clinica_top: {
    name: "Clínica Top",
    subtitle: "Grandes clínicas e alta rotatividade",
    icon: Sparkles,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-500/10 border-purple-500/20",
    badge: "8 Acessos Base",
    badgeColor: "bg-purple-600 text-white",
    description: "Para grandes clínicas: 8 acessos simultâneos na base, criação de novos cargos, auditoria completa de prontuários e lembretes WhatsApp.",
    sections: [
      {
        title: "Capacidade Máxima",
        icon: Users,
        items: [
          "8 Acessos simultâneos inclusos na base",
          "Profissionais e colaboradores ilimitados para cadastrar",
          "Expansão flexível: R$ 25,00/mês por vaga extra",
          "Atendimentos, pacientes e formulários ilimitados",
        ],
      },
      {
        title: "Controle Total & Auditoria",
        icon: Database,
        items: [
          "Personalização total de cargos, hierarquias e regras de acesso",
          "Histórico completo de auditoria: quem visualizou e alterou cada prontuário",
          "Gestão integrada de várias salas e especialidades",
          "Lembretes automáticos de agendamento por WhatsApp",
        ],
      },
      {
        title: "Segurança Avançada",
        icon: ShieldCheck,
        items: [
          "Centralização irrestrita sob o Dono da clínica",
          "Conformidade total LGPD e resoluções profissionais",
          "Suporte prioritário e onboarding dedicado",
        ],
      },
    ],
  },
  // Retrocompatibilidade
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
          "Atendimentos e consultas 100% ilimitados",
          "Pacientes e prontuários ilimitados",
        ],
      },
      {
        title: "Prontuário & Formulários",
        icon: FileSpreadsheet,
        items: [
          "Prontuário eletrônico completo com evolução clínica",
          "Anamnese personalizada e laudos em PDF",
          "Formulários universais personalizáveis",
        ],
      },
      {
        title: "Segurança & Conformidade",
        icon: ShieldCheck,
        items: [
          "Garantia Ética: Acesso vitalício aos prontuários",
          "Criptografia ponta a ponta e conformidade com LGPD e CFM",
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
    description: "A solução completa para clínicas compartilharem infraestrutura com controle total de permissões.",
    sections: [
      {
        title: "Capacidade & Colaboração",
        icon: Users,
        items: [
          "Colaboradores ilimitados",
          "4 Acessos simultâneos na base inclusos",
          "Expansão flexível de assentos: R$ 25,00/mês",
          "Atendimentos e pacientes ilimitados",
        ],
      },
      {
        title: "Gestão & Permissões",
        icon: Lock,
        items: [
          "Controle avançado de permissões por perfil (RBAC)",
          "Agendas compartilhadas em tempo real",
          "Módulo financeiro completo da clínica e divisão de repasses",
        ],
      },
      {
        title: "Segurança & Governança",
        icon: ShieldCheck,
        items: [
          "Prontuários protegidos com sigilo profissional estrito",
          "Auditoria básica de movimentações",
          "Garantia de retenção documental médica por 20 anos",
        ],
      },
    ],
  },
  enterprise: {
    name: "Enterprise",
    subtitle: "Grandes Clínicas, Redes e Franquias",
    icon: Sparkles,
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-500/10 border-purple-500/20",
    badge: "Alta Escala",
    badgeColor: "bg-purple-600 text-white",
    description: "Projetado para policlínicas e redes consolidadas com alta demanda de acessos simultâneos.",
    sections: [
      {
        title: "Capacidade Máxima",
        icon: Users,
        items: [
          "Colaboradores ilimitados",
          "10 Acessos simultâneos inclusos na base",
          "Tarifa reduzida por vaga extra: R$ 15,00/mês",
          "Atendimentos, pacientes e prontuários ilimitados",
        ],
      },
      {
        title: "Governança & Telemetria",
        icon: Database,
        items: [
          "Telemetria master e relatórios consolidados",
          "Auditoria avançada de logs e acessos",
          "Suporte prioritário via WhatsApp",
        ],
      },
      {
        title: "Segurança Corporativa",
        icon: ShieldCheck,
        items: [
          "Garantia de SLA 99.9%",
          "Acordo de processamento de dados corporativo",
          "Backups sob demanda",
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
  const plan = PLAN_INFO[planId] || PLAN_INFO["prof_medio"] || PLAN_INFO["solo"];
  if (!plan) return null;
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
              {isFreeCycle ? "Teste Gratuito (7 dias)" : `R$ ${pricing.monthlyEquivalent.toFixed(2).replace(".", ",")}/mês`}
            </span>
          </div>
          {!isFreeCycle && (
            <div className="text-right text-xs text-muted-foreground">
              <span>Total: <strong>R$ {pricing.periodTotal.toFixed(2).replace(".", ",")}</strong></span>
              <span className="block text-emerald-600 dark:text-emerald-400 font-semibold">
                PIX à vista: R$ {pricing.pixDiscountTotal.toFixed(2).replace(".", ",")} (-5%)
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
            <span>{isFreeCycle ? "Iniciar Teste Gratuito (7 dias)" : "Contratar Este Plano"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
