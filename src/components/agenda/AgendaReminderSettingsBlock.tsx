import React, { useId, useState } from "react";
import {
  Bell,
  Clock,
  Lock,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface AgendaReminderSettingsValues {
  remindAtEvent: boolean;
  additionalReminders: number[];
  notifyTeam: boolean;
  notifyPatient: boolean;
  notifiedColleagueIds: string[];
}

export const DEFAULT_REMINDER_SETTINGS: AgendaReminderSettingsValues = {
  remindAtEvent: true,
  additionalReminders: [],
  notifyTeam: false,
  notifyPatient: false,
  notifiedColleagueIds: [],
};

export const REMINDER_TIME_OPTIONS = [
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1h antes" },
  { value: 1440, label: "1 dia antes" },
] as const;

export interface CollaboratorOption {
  id: string;
  name?: string;
  full_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  operational_role?: string | null;
}

export interface AgendaReminderSettingsBlockProps {
  values?: AgendaReminderSettingsValues;
  onChange?: (values: AgendaReminderSettingsValues) => void;
  collaborators?: CollaboratorOption[];
  isSolo?: boolean;
  canWriteOthers?: boolean;
  className?: string;
  patientName?: string;
}

/**
 * Bloco modular de configuração de lembretes e notificações para agendamentos.
 * Mobile-First, sem overflow horizontal, touch targets >= 44px e respeito ao RBAC schedule.write_others.
 */
export const AgendaReminderSettingsBlock: React.FC<AgendaReminderSettingsBlockProps> = ({
  values,
  onChange,
  collaborators: collaboratorsProp,
  isSolo: isSoloProp,
  canWriteOthers: canWriteOthersProp,
  className,
  patientName,
}) => {
  const baseId = useId();
  const [internalValues, setInternalValues] = useState<AgendaReminderSettingsValues>(DEFAULT_REMINDER_SETTINGS);
  const currentValues = values ?? internalValues;

  const { can, subscriptionPlan, clinic, clinicId } = useAuth();

  const resolvedIsSolo =
    isSoloProp !== undefined
      ? isSoloProp
      : subscriptionPlan === "solo" || clinic?.subscription_plan === "solo";

  const resolvedCanWriteOthers =
    canWriteOthersProp !== undefined
      ? canWriteOthersProp
      : typeof can === "function"
      ? can("schedule.write_others")
      : false;

  const [fetchedCollaborators, setFetchedCollaborators] = useState<CollaboratorOption[]>([]);

  React.useEffect(() => {
    if (collaboratorsProp || resolvedIsSolo || !clinicId) return;

    let isMounted = true;
    const loadCollaborators = async () => {
      try {
        const { data: memberships } = await supabase
          .from("clinic_memberships")
          .select("user_id, operational_role, is_active, membership_status")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        if (!memberships || !isMounted) return;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, job_title")
          .eq("clinic_id", clinicId);

        if (!isMounted) return;

        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        const mapped: CollaboratorOption[] = memberships
          .filter((m) => m.membership_status === "active")
          .map((m) => {
            const prof = profileMap.get(m.user_id);
            return {
              id: m.user_id,
              name: prof?.full_name ?? undefined,
              full_name: prof?.full_name ?? null,
              email: prof?.email ?? null,
              job_title: prof?.job_title ?? null,
              operational_role: m.operational_role,
            };
          });

        setFetchedCollaborators(mapped);
      } catch {
        // Fallback defensivo
      }
    };

    loadCollaborators();
    return () => {
      isMounted = false;
    };
  }, [clinicId, collaboratorsProp, resolvedIsSolo]);

  const resolvedCollaborators = (collaboratorsProp ?? fetchedCollaborators) as CollaboratorOption[];

  const updateValues = (next: Partial<AgendaReminderSettingsValues>) => {
    const updated = { ...currentValues, ...next };
    if (!values) {
      setInternalValues(updated);
    }
    onChange?.(updated);
  };

  const handleToggleRemindAtEvent = (checked: boolean) => {
    updateValues({ remindAtEvent: checked });
  };

  const handleToggleReminderOption = (minutes: number) => {
    const current = currentValues.additionalReminders;
    const exists = current.includes(minutes);
    const next = exists
      ? current.filter((m) => m !== minutes)
      : [...current, minutes].sort((a, b) => a - b);
    updateValues({ additionalReminders: next });
  };

  const handleRemoveReminder = (minutes: number) => {
    updateValues({
      additionalReminders: currentValues.additionalReminders.filter((m) => m !== minutes),
    });
  };

  const handleToggleNotifyTeam = (checked: boolean) => {
    updateValues({ notifyTeam: checked });
  };

  const handleToggleNotifyPatient = (checked: boolean) => {
    updateValues({ notifyPatient: checked });
  };

  const handleToggleCollaborator = (colleagueId: string) => {
    const current = currentValues.notifiedColleagueIds;
    const exists = current.includes(colleagueId);
    const next = exists
      ? current.filter((id) => id !== colleagueId)
      : [...current, colleagueId];
    updateValues({ notifiedColleagueIds: next });
  };

  const remindAtEventId = `${baseId}-remind-at-event`;
  const notifyTeamId = `${baseId}-notify-team`;
  const notifyPatientId = `${baseId}-notify-patient`;

  return (
    <div
      data-testid="agenda-reminder-settings-block"
      className={cn(
        "w-full max-w-full rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-4 space-y-3.5 text-xs text-foreground",
        className
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-xs leading-tight">Lembretes e Notificações</p>
          <p className="text-[11px] text-muted-foreground truncate">
            Configure alertas no horário e notificações automáticas
          </p>
        </div>
      </div>

      {/* 1. Checkbox "Lembrar no horário agendado" (marcado por default) */}
      <div className="space-y-1">
        <label
          htmlFor={remindAtEventId}
          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40 active:scale-[0.99]"
        >
          <Checkbox
            id={remindAtEventId}
            checked={currentValues.remindAtEvent}
            onCheckedChange={(checked) => handleToggleRemindAtEvent(Boolean(checked))}
            className="h-4 w-4 rounded"
          />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">Lembrar no horário agendado</span>
            <p className="text-[10px] text-muted-foreground">
              Alerta sonoro e notificação push no horário exato do início.
            </p>
          </div>
        </label>
      </div>

      {/* 2. Lembretes adicionais antes do evento (chips rápidos) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Lembretes adicionais antes do evento
        </Label>
        <div className="flex flex-wrap gap-2">
          {REMINDER_TIME_OPTIONS.map((opt) => {
            const isSelected = currentValues.additionalReminders.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleToggleReminderOption(opt.value)}
                aria-pressed={isSelected}
                className={cn(
                  "min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-all flex items-center gap-1.5 touch-manipulation select-none active:scale-95",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <X className="h-3.5 w-3.5 ml-0.5 opacity-80 hover:opacity-100" />
                )}
              </button>
            );
          })}
        </div>

        {/* Chips de Lembretes Ativos com Remoção Rápida */}
        {currentValues.additionalReminders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">Ativos:</span>
            {currentValues.additionalReminders.map((mins) => {
              const opt = REMINDER_TIME_OPTIONS.find((o) => o.value === mins);
              const label = opt ? opt.label : `${mins} min antes`;
              return (
                <span
                  key={mins}
                  className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReminder(mins)}
                    aria-label={`Remover lembrete ${label}`}
                    className="p-1 rounded hover:bg-primary/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Checkboxes de WhatsApp (Equipe / Solo e Paciente) */}
      <div className="space-y-2 pt-1 border-t border-border/50">
        {/* Checkbox 1: Notificar equipe ou Meu WhatsApp */}
        <label
          htmlFor={notifyTeamId}
          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40 active:scale-[0.99]"
        >
          <Checkbox
            id={notifyTeamId}
            checked={currentValues.notifyTeam}
            onCheckedChange={(checked) => handleToggleNotifyTeam(Boolean(checked))}
            className="h-4 w-4 rounded"
          />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">
              {resolvedIsSolo ? "No meu WhatsApp" : "Notificar equipe por WhatsApp"}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {resolvedIsSolo
                ? "Receba um aviso direto no seu número de WhatsApp."
                : "Envia lembrete no WhatsApp dos profissionais responsáveis."}
            </p>
          </div>
        </label>

        {/* Checkbox 2: Notificar o paciente por WhatsApp e E-mail */}
        <label
          htmlFor={notifyPatientId}
          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40 active:scale-[0.99]"
        >
          <Checkbox
            id={notifyPatientId}
            checked={currentValues.notifyPatient}
            onCheckedChange={(checked) => handleToggleNotifyPatient(Boolean(checked))}
            className="h-4 w-4 rounded"
          />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">
              Notificar o paciente por WhatsApp e E-mail
            </span>
            <p className="text-[10px] text-muted-foreground">
              {patientName
                ? `Lembrete automático para ${patientName} com detalhes do agendamento.`
                : "Lembrete automático com link de confirmação para o paciente."}
            </p>
          </div>
        </label>
      </div>

      {/* 4. Seletor de colaboradores para notificar */}
      {!resolvedIsSolo && (
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Colaboradores a notificar</span>
          </div>

          {!resolvedCanWriteOthers ? (
            /* Sem permissão RBAC schedule.write_others */
            <div
              data-testid="collaborators-permission-notice"
              className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-start gap-2"
            >
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-foreground/80">Permissão restrita</p>
                <p className="text-[11px] leading-snug">
                  Apenas usuários com a permissão <code className="bg-muted px-1 py-0.5 rounded text-[10px]">schedule.write_others</code> podem selecionar outros colaboradores.
                </p>
              </div>
            </div>
          ) : (
            /* Com permissão schedule.write_others: Lista de colaboradores */
            <div
              data-testid="collaborators-selector"
              className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5"
            >
              {resolvedCollaborators.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic p-2 rounded-xl bg-muted/20">
                  Nenhum colaborador adicional cadastrado na clínica.
                </p>
              ) : (
                resolvedCollaborators.map((c) => {
                  const isSelected = currentValues.notifiedColleagueIds.includes(c.id);
                  const colleagueName = c.full_name || c.name || c.email || "Colaborador";
                  const colleagueRole = c.job_title || c.operational_role || null;
                  const colleagueCheckId = `${baseId}-colleague-${c.id}`;

                  return (
                    <label
                      key={c.id}
                      htmlFor={colleagueCheckId}
                      className={cn(
                        "flex min-h-[44px] cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3 py-2 transition-all active:scale-[0.99]",
                        isSelected
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-border/40 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Checkbox
                          id={colleagueCheckId}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleCollaborator(c.id)}
                          className="h-4 w-4 rounded"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-foreground">{colleagueName}</p>
                          {colleagueRole && (
                            <p className="text-[10px] text-muted-foreground truncate">{colleagueRole}</p>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AgendaReminderSettingsBlock.displayName = "AgendaReminderSettingsBlock";
