import React, { useState } from "react";
import {
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronRight,
  PlayCircle,
  User,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EDITABLE_PATIENT_STATUS_VALUES,
  getPatientStatusMeta,
  type EditablePatientStatus,
} from "@/lib/patient-statuses";
import type { PatientCardData } from "@/components/PatientCard";
import { cn } from "@/lib/utils";

export interface PatientQuickActionsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientCardData | null;
  onSelect: (patientId: string) => void;
  onNewAppointment: (patient: PatientCardData) => void;
  onAttendNow: (patient: PatientCardData) => void;
  onUpdateStatus: (patientId: string, nextStatus: EditablePatientStatus) => Promise<void> | void;
  onViewProfile: (patient: PatientCardData) => void;
}

const statusDotColors: Record<string, string> = {
  ativo: "bg-emerald-500",
  pausado: "bg-amber-500",
  pagamento_pendente: "bg-amber-500",
  inativo: "bg-slate-400",
  alta: "bg-sky-500",
};

export const PatientQuickActionsMenu: React.FC<PatientQuickActionsMenuProps> = ({
  open,
  onOpenChange,
  patient,
  onSelect,
  onNewAppointment,
  onAttendNow,
  onUpdateStatus,
  onViewProfile,
}) => {
  const isMobile = useIsMobile();
  const [statusPopupOpen, setStatusPopupOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!patient) return null;

  const currentStatusMeta = getPatientStatusMeta(patient.status);
  const currentDotColor = statusDotColors[patient.status] || "bg-slate-400";

  const handleSelect = () => {
    onOpenChange(false);
    onSelect(patient.id);
  };

  const handleNewAppointment = () => {
    onOpenChange(false);
    onNewAppointment(patient);
  };

  const handleAttendNow = () => {
    onOpenChange(false);
    onAttendNow(patient);
  };

  const handleViewProfile = () => {
    onOpenChange(false);
    onViewProfile(patient);
  };

  const handleStatusSelect = async (nextStatus: EditablePatientStatus) => {
    if (nextStatus === patient.status) {
      setStatusPopupOpen(false);
      return;
    }
    setUpdatingStatus(true);
    try {
      await onUpdateStatus(patient.id, nextStatus);
    } finally {
      setUpdatingStatus(false);
      setStatusPopupOpen(false);
      onOpenChange(false);
    }
  };

  const menuItems = (
    <div className="flex flex-col gap-1 p-2">
      {/* 1. Selecionar */}
      <button
        type="button"
        onClick={handleSelect}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Selecionar</p>
            <p className="text-xs text-muted-foreground">Ativar modo de seleção de pacientes</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* 2. Novo agendamento */}
      <button
        type="button"
        onClick={handleNewAppointment}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Novo agendamento</p>
            <p className="text-xs text-muted-foreground">Marcar horário na agenda para este paciente</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* 3. Atender agora */}
      <button
        type="button"
        onClick={handleAttendNow}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Atender agora</p>
            <p className="text-xs text-muted-foreground">Iniciar uma nova sessão de atendimento</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* 4. Status de atividade */}
      <button
        type="button"
        onClick={() => setStatusPopupOpen(true)}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <span
              className={cn("h-3.5 w-3.5 rounded-full ring-2 ring-background", currentDotColor)}
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Status de atividade</p>
              <Badge variant="outline" className={cn("text-[11px] font-medium py-0 px-1.5", currentStatusMeta.badgeClassName)}>
                {currentStatusMeta.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Clique para alterar o status do paciente</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* 5. Ver cadastro completo */}
      <button
        type="button"
        onClick={handleViewProfile}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-accent focus:bg-accent focus:outline-none min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Ver cadastro completo</p>
            <p className="text-xs text-muted-foreground">Acessar prontuário, histórico e detalhes</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );

  const statusDialog = (
    <Dialog open={statusPopupOpen} onOpenChange={setStatusPopupOpen}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>Alterar status do paciente</DialogTitle>
          <DialogDescription>
            Selecione o novo status para <strong>{patient.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {EDITABLE_PATIENT_STATUS_VALUES.map((statusKey) => {
            const meta = getPatientStatusMeta(statusKey);
            const isCurrent = patient.status === statusKey;
            const dot = statusDotColors[statusKey] || "bg-slate-400";

            return (
              <Button
                key={statusKey}
                type="button"
                variant={isCurrent ? "secondary" : "outline"}
                className={cn(
                  "justify-between h-12 px-4 text-left font-normal",
                  isCurrent && "border-primary/40 bg-primary/5 font-semibold",
                )}
                disabled={updatingStatus}
                onClick={() => void handleStatusSelect(statusKey)}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-3 w-3 rounded-full shrink-0", dot)} />
                  <span>{meta.label}</span>
                </div>
                {isCurrent && <Check className="h-4 w-4 text-primary" />}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="pb-safe focus:outline-none">
            <DrawerHeader className="text-left pb-2 border-b">
              <DrawerTitle className="text-base font-semibold truncate">
                {patient.name}
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground flex items-center gap-2">
                {patient.patient_code ? <span>{patient.patient_code}</span> : null}
                <span>•</span>
                <span>Ações rápidas</span>
              </DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[75dvh] overflow-y-auto overscroll-contain">
              {menuItems}
            </div>
          </DrawerContent>
        </Drawer>
        {statusDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="text-base font-semibold truncate">
              {patient.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
              {patient.patient_code ? <span>{patient.patient_code}</span> : null}
              <span>•</span>
              <span>Ações rápidas do paciente</span>
            </DialogDescription>
          </DialogHeader>
          <div className="p-2">{menuItems}</div>
        </DialogContent>
      </Dialog>
      {statusDialog}
    </>
  );
};
