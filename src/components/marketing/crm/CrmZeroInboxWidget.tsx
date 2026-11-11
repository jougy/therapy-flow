import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, Clock, Sparkles, MessageCircle, AlertTriangle,
  Flame, UserCheck, Stethoscope, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { CrmContact } from '@/modules/marketing/types';

export type RecommendationUrgency = 'critical' | 'high' | 'medium' | 'clinical';

export interface CrmRecommendation {
  id: string;
  contact: CrmContact;
  urgency: RecommendationUrgency;
  urgencyLabel: string;
  weight: number;
  badgeClass: string;
  cardBorderClass: string;
  actionTitle: string;
  actionDescription: string;
  playbookMessage: string;
  whatsAppUrl: string;
}

export interface CrmZeroInboxWidgetProps {
  contacts: CrmContact[];
  onContactSelect?: (contact: CrmContact) => void;
  className?: string;
  onActionComplete?: (rec: CrmRecommendation) => void;
}

const URGENCY_CONFIG = {
  critical: { label: 'Crítico (Carência)', weight: 400, badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', border: 'border-rose-500/30 hover:border-rose-500/60 bg-rose-500/[0.02]' },
  high: { label: 'Trial Expirando', weight: 300, badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', border: 'border-orange-500/30 hover:border-orange-500/60 bg-orange-500/[0.02]' },
  medium: { label: 'Novo Contato 24h', weight: 200, badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', border: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.02]' },
  clinical: { label: 'Follow-up Clínico', weight: 100, badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', border: 'border-sky-500/30 hover:border-sky-500/60 bg-sky-500/[0.02]' },
} as const;

function sanitizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits;
}

function buildWhatsAppLink(phone: string, text: string): string {
  const digits = sanitizePhoneForWhatsApp(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : '#';
}

function isWithin24Hours(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    const t = new Date(dateStr).getTime();
    return !isNaN(t) && (Date.now() - t) <= 24 * 60 * 60 * 1000 && (Date.now() - t) >= 0;
  } catch { return false; }
}

function isDateMoreThan30DaysAgo(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    let t: number;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      t = parts.length === 3 ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`).getTime() : NaN;
    } else {
      t = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).getTime();
    }
    return !isNaN(t) && Date.now() - t > 30 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function makeRec(contact: CrmContact, urgency: RecommendationUrgency, actionTitle: string, actionDescription: string, playbookMessage: string): CrmRecommendation {
  const cfg = URGENCY_CONFIG[urgency];
  return {
    id: `${urgency}-${contact.id}`, contact, urgency, urgencyLabel: cfg.label, weight: cfg.weight,
    badgeClass: cfg.badge, cardBorderClass: cfg.border, actionTitle, actionDescription, playbookMessage,
    whatsAppUrl: buildWhatsAppLink(contact.phone, playbookMessage),
  };
}

export function evaluateContactRecommendation(contact: CrmContact): CrmRecommendation | null {
  const firstName =
    contact.templateVariables?.first_name ||
    contact.templateVariables?.primeiro_nome ||
    contact.fullName.replace(/^(Dr\.|Dra\.|Dr|Dra|Prof\.|Prof)\s+/i, '').trim().split(' ')[0] ||
    'Contato';
  const rawStatus = (contact.templateVariables?.status || '').toLowerCase();
  const badgeLower = (contact.badgeLabel || '').toLowerCase();

  // 1. Urgência Crítica (Vermelho): Carência ou < 7 dias para perder comissão
  const isGrace =
    contact.stage === 'grace_period' ||
    rawStatus === 'past_due' ||
    contact.metadata?.isGracePeriod === true ||
    (contact.metadata?.daysUntilCommissionLoss !== undefined && contact.metadata.daysUntilCommissionLoss <= 7);
  if (isGrace) {
    return makeRec(
      contact, 'critical',
      `Resgatar ${firstName} antes do cancelamento da comissão`,
      'Lead em carência (40 dias). Agir para evitar perda de assinatura e comissão.',
      `Olá ${firstName}, tudo bem? Notei uma pendência na renovação do seu plano Pluri. Posso ajudar a regularizar para manter seus benefícios e comissões ativas?`
    );
  }

  // 2. Urgência Alta (Laranja): Leads em trial perto de expirar
  const isTrial =
    rawStatus === 'trial' ||
    badgeLower.includes('trial') ||
    contact.metadata?.isTrialExpiring === true ||
    (contact.metadata?.daysUntilTrialExpires !== undefined && contact.metadata.daysUntilTrialExpires <= 3);
  if (isTrial) {
    return makeRec(
      contact, 'high',
      `Trial de ${firstName} perto de expirar: oferecer condição especial`,
      'Período de avaliação vencendo. Oferecer incentivo para conversão imediata.',
      `Olá ${firstName}, seu período de testes do Pluri está finalizando! Gostaria de uma condição especial de 30% OFF na assinatura anual para você continuar?`
    );
  }

  // 3. Urgência Média (Amarelo): Novos contatos nas últimas 24h sem contato
  const isNew = contact.stage === 'new' || contact.metadata?.isNewLead24h === true || isWithin24Hours(contact.createdAt);
  const noContact = !contact.lastInteractionAt || contact.metadata?.hasInitiatedContact === false || contact.stage === 'new';
  if (isNew && noContact) {
    return makeRec(
      contact, 'medium',
      `Boas-vindas para ${firstName}: orientar 1º paciente e tutorial`,
      'Novo indicado nas últimas 24h sem contato iniciado. Enviar dicas de ativação.',
      `Olá ${firstName}, muito bem-vindo(a) ao Pluri-Health! Passando para te apoiar: quer ajuda rápida para cadastrar seu 1º paciente?`
    );
  }

  // 4. Acompanhamento Clínico (Azul): Pacientes sem sessão > 30 dias
  const isStalled = contact.targetType === 'patient' && (
    contact.stage === 'stalled' ||
    (contact.metadata?.daysSinceLastSession !== undefined && contact.metadata.daysSinceLastSession > 30) ||
    isDateMoreThan30DaysAgo(contact.clinicalOrBusinessMetric?.primaryValue)
  );
  if (isStalled) {
    return makeRec(
      contact, 'clinical',
      `Follow-up clínico: ${firstName} sem sessão há mais de 30 dias`,
      'Paciente sem retorno há mais de 30 dias. Checar quadro de dor e reagendar.',
      `Olá ${firstName}, como você está? Faz mais de 30 dias desde seu último atendimento na clínica. Gostaria de saber como está sua evolução e agendar um retorno?`
    );
  }

  return null;
}

export const CrmZeroInboxWidget: React.FC<CrmZeroInboxWidgetProps> = ({
  contacts, onContactSelect, className, onActionComplete,
}) => {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const allRecommendations = useMemo(() => {
    const recs: CrmRecommendation[] = [];
    contacts.forEach((c) => {
      const rec = evaluateContactRecommendation(c);
      if (rec) recs.push(rec);
    });
    return recs.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }, [contacts]);

  const activeRecs = allRecommendations.filter((r) => !completedIds.includes(r.id));
  const isZeroInbox = allRecommendations.length > 0 && activeRecs.length === 0;

  const handleToggle = (rec: CrmRecommendation) => {
    const isDone = completedIds.includes(rec.id);
    if (isDone) {
      setCompletedIds((prev) => prev.filter((id) => id !== rec.id));
    } else {
      setCompletedIds((prev) => [...prev, rec.id]);
      onActionComplete?.(rec);
    }
  };

  const getUrgencyIcon = (urgency: RecommendationUrgency) => {
    switch (urgency) {
      case 'critical': return <Flame className="h-3.5 w-3.5 text-rose-500" />;
      case 'high': return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
      case 'medium': return <UserCheck className="h-3.5 w-3.5 text-amber-500" />;
      case 'clinical': return <Stethoscope className="h-3.5 w-3.5 text-sky-500" />;
    }
  };

  return (
    <div
      data-testid="crm-zero-inbox-widget"
      className={cn('w-full max-w-full min-w-0 overflow-x-hidden rounded-xl border bg-card p-3 sm:p-4 shadow-sm space-y-3', className)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Ações Recomendadas do Dia (Zero-Inbox)
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono">
            {activeRecs.length} pendente{activeRecs.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        {completedIds.length > 0 && (
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-[11px] h-7 px-2 text-muted-foreground self-start sm:self-auto"
          >
            <Undo2 className="h-3 w-3 mr-1" />
            {showCompleted ? 'Ocultar' : `Ver ${completedIds.length} concluída(s)`}
          </Button>
        )}
      </div>

      {isZeroInbox && (
        <div
          data-testid="zero-inbox-celebration"
          className="p-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-center space-y-2 animate-in fade-in duration-300"
        >
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 mb-1">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
            Você está em dia com todas as suas ações prioritárias de hoje! 🎉
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Todas as ações recomendadas foram concluídas ou agendadas. Seu funil de relacionamento está 100% em dia.
          </p>
        </div>
      )}

      {allRecommendations.length === 0 && (
        <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Funil Saudável ✨</p>
          <p>Nenhum contato necessita de ação crítica imediata no momento.</p>
        </div>
      )}

      {!isZeroInbox && (
        <div className="space-y-2">
          {activeRecs.map((rec) => (
            <div
              key={rec.id}
              data-testid={`rec-card-${rec.urgency}`}
              className={cn(
                'group p-3 rounded-lg border transition-all text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
                rec.cardBorderClass
              )}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Checkbox
                  id={`chk-${rec.id}`}
                  checked={false}
                  onCheckedChange={() => handleToggle(rec)}
                  className="mt-1 h-5 w-5 min-w-[20px] rounded cursor-pointer"
                  aria-label="Concluir tarefa"
                />
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => onContactSelect?.(rec.contact)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onContactSelect?.(rec.contact)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 gap-1 font-medium', rec.badgeClass)}>
                      {getUrgencyIcon(rec.urgency)}
                      {rec.urgencyLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">{rec.contact.fullName}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 group-hover:text-primary transition-colors line-clamp-1">
                    {rec.actionTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{rec.actionDescription}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                <Button
                  type="button" variant="outline" size="sm" onClick={() => handleToggle(rec)}
                  className="h-11 min-h-[44px] px-3 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Lembrar amanhã</span>
                </Button>

                <a
                  href={rec.whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 min-h-[44px] px-3.5 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCompleted && completedIds.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">Concluídas hoje:</p>
          {allRecommendations
            .filter((r) => completedIds.includes(r.id))
            .map((rec) => (
              <div
                key={`done-${rec.id}`}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/40 line-through text-muted-foreground"
              >
                <span className="truncate">{rec.actionTitle}</span>
                <Button
                  type="button" variant="ghost" size="sm" onClick={() => handleToggle(rec)}
                  className="h-7 text-[10px] px-2 text-primary"
                >
                  Restaurar
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
