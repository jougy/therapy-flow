import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BellRing,
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle2,
  ExternalLink,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSupabaseErrorMessage,
  notifyAgendaEventsUpdated,
} from "@/lib/agenda-events";
import {
  type NotificationSoundKey,
  startAlarmLoop,
  stopAlarmLoop,
} from "@/lib/notification-sounds";
import { cn } from "@/lib/utils";

export interface AgendaAlarmEvent {
  id: string;
  title: string;
  scheduledFor: string | Date;
  eventType: string;
  patientId?: string | null;
  patientName?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  status?: string;
  durationMinutes?: number;
  time?: string;
}

export interface AgendaAlarmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  event: AgendaAlarmEvent | null;
  soundKey?: NotificationSoundKey;
  onDismiss?: () => void;
  onConfirmAttendance?: (event: AgendaAlarmEvent) => Promise<void> | void;
  onCancelAppointment?: (event: AgendaAlarmEvent) => Promise<void> | void;
  onViewPatient?: (event: AgendaAlarmEvent) => void;
}

export const AgendaAlarmDialog: React.FC<AgendaAlarmDialogProps> = ({
  open,
  onOpenChange,
  event,
  soundKey = "urgent_alarm",
  onDismiss,
  onConfirmAttendance,
  onCancelAppointment,
  onViewPatient,
}) => {
  const navigate = useNavigate();
  const { can, clinic } = useAuth();
  const { toast } = useToast();

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicia e gerencia o ciclo do alarme sonoro
  useEffect(() => {
    if (!open || !event) {
      stopAlarmLoop();
      return;
    }

    startAlarmLoop({
      soundKey,
      maxLoops: 4,
    });

    return () => {
      stopAlarmLoop();
    };
  }, [open, event, soundKey]);

  if (!event) return null;

  const handleClose = () => {
    stopAlarmLoop();
    setConfirmCancelOpen(false);
    onOpenChange?.(false);
    onDismiss?.();
  };

  const isAttendance = event.eventType === "atendimento";
  const hasWritePermission = can ? can("schedule.write") : true;

  // Formatação segura de data e horário
  let formattedTime = event.time || "";
  let formattedDate = "";
  try {
    const dateObj =
      event.scheduledFor instanceof Date
        ? event.scheduledFor
        : parseISO(String(event.scheduledFor));
    if (!Number.isNaN(dateObj.getTime())) {
      if (!formattedTime) {
        formattedTime = format(dateObj, "HH:mm");
      }
      formattedDate = format(dateObj, "dd 'de' MMMM", { locale: ptBR });
    }
  } catch {
    formattedTime = event.time || "--:--";
  }

  const effectiveClinicName =
    event.clinicName ||
    clinic?.brand_name ||
    clinic?.name ||
    "Clínica Principal";

  const effectivePatientName =
    event.patientName || (event.patientId ? "Paciente Vinculado" : "Não informado");

  // Ação 1: Confirmar presença e iniciar atendimento
  const handleConfirmAttendance = async () => {
    stopAlarmLoop();

    if (!hasWritePermission) {
      toast({
        title: "Permissão insuficiente",
        description: "Você não tem permissão para alterar agendamentos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onConfirmAttendance) {
        await onConfirmAttendance(event);
      } else {
        if (event.id) {
          const { error } = await supabase
            .from("agenda_events")
            .update({ status: "confirmado" })
            .eq("id", event.id);

          if (error) throw error;
          notifyAgendaEventsUpdated();
        }

        const patientParam = event.patientId ? `?pacienteId=${event.patientId}` : "";
        navigate(`/sessao/nova${patientParam}`);
      }

      handleClose();
    } catch (err) {
      toast({
        title: "Erro ao confirmar presença",
        description: formatSupabaseErrorMessage(err, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação 2: Ver perfil do paciente
  const handleViewPatient = () => {
    stopAlarmLoop();
    handleClose();

    if (onViewPatient) {
      onViewPatient(event);
    } else {
      const target = event.patientId ? `/paciente/${event.patientId}` : "/pacientes";
      navigate(target);
    }
  };

  // Ação 3: Confirmar cancelamento no diálogo interno
  const handleConfirmCancelAppointment = async () => {
    stopAlarmLoop();

    if (!hasWritePermission) {
      toast({
        title: "Permissão insuficiente",
        description: "Você não tem permissão para cancelar agendamentos.",
        variant: "destructive",
      });
      setConfirmCancelOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      if (onCancelAppointment) {
        await onCancelAppointment(event);
      } else {
        if (event.id) {
          const { error } = await supabase
            .from("agenda_events")
            .update({ status: "cancelado" })
            .eq("id", event.id);

          if (error) throw error;
          notifyAgendaEventsUpdated();
        }

        toast({
          title: "Atendimento cancelado",
          description: "O status do agendamento foi alterado para cancelado.",
        });
      }

      setConfirmCancelOpen(false);
      handleClose();
    } catch (err) {
      toast({
        title: "Erro ao cancelar atendimento",
        description: formatSupabaseErrorMessage(err, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : undefined)}>
        <DialogContent
          className={cn(
            "z-50 w-[calc(100%-2rem)] max-w-md sm:max-w-lg p-5 sm:p-6",
            "rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl",
            "overflow-hidden break-words",
          )}
        >
          {/* Cabeçalho do Alarme com indicador visual pulsante */}
          <DialogHeader className="space-y-2 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="h-5 w-5 animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                  Lembrete de Agendamento
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  Notificação do horário programado na agenda
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Cartão de Detalhes do Compromisso */}
          <div className="my-2 space-y-3 rounded-xl border border-border/50 bg-muted/40 p-3.5 sm:p-4">
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Título
              </span>
              <p
                data-testid="alarm-title"
                className="text-sm font-semibold text-foreground break-words"
              >
                {event.title}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">Horário:</span>
                <span data-testid="alarm-time" className="font-medium">
                  {formattedTime} {formattedDate ? `(${formattedDate})` : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 text-foreground">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Clínica:</span>
                <span data-testid="alarm-clinic" className="font-medium truncate">
                  {effectiveClinicName}
                </span>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Paciente:</span>
                <span data-testid="alarm-patient" className="font-medium truncate">
                  {effectivePatientName}
                </span>
              </div>
            </div>
          </div>

          {/* Bloco de Ações do Atendimento */}
          <div className="space-y-2 pt-2">
            {isAttendance && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleConfirmAttendance}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full justify-center gap-2 py-2.5 text-xs sm:text-sm font-medium",
                    "rounded-xl shadow-sm transition-all",
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Confirmar presença e iniciar atendimento</span>
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleViewPatient}
                    disabled={isSubmitting}
                    className="w-full justify-center gap-1.5 py-2 text-xs sm:text-sm rounded-xl"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Ver paciente</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmCancelOpen(true)}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full justify-center gap-1.5 py-2 text-xs sm:text-sm rounded-xl",
                      "text-destructive hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancelar atendimento</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Botão de Fechamento Centralizado */}
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-xs text-muted-foreground hover:text-foreground rounded-lg px-4"
              >
                Fechar Alerta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo Interno de Confirmação para Cancelar Atendimento */}
      <AlertDialog
        open={confirmCancelOpen}
        onOpenChange={(next) => (!next ? setConfirmCancelOpen(false) : undefined)}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Cancelar atendimento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar o atendimento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={() => setConfirmCancelOpen(false)}
              className="w-full sm:w-auto rounded-xl text-xs sm:text-sm"
            >
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={handleConfirmCancelAppointment}
              className="w-full sm:w-auto rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgendaAlarmDialog;
