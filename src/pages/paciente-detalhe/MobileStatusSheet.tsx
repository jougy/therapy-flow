import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDITABLE_PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import type { Patient, PatientStatusSelectValue } from "./pacienteDetalheTypes";

export interface MobileStatusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onStatusChange: (status: PatientStatusSelectValue) => void | Promise<void>;
}

export const MobileStatusSheet: React.FC<MobileStatusSheetProps> = ({
  open,
  onOpenChange,
  patient,
  onStatusChange,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>Status do Paciente</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Selecione o estado operacional de {patient.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 py-4">
          {EDITABLE_PATIENT_STATUS_OPTIONS.map((statusOption) => {
            const isCurrent = patient.status === statusOption.value;
            return (
              <button
                key={statusOption.value}
                type="button"
                onClick={() => {
                  void onStatusChange(statusOption.value as PatientStatusSelectValue);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-colors",
                  isCurrent
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-card hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      statusOption.value === "ativo" && "bg-success",
                      statusOption.value === "alta" && "bg-primary",
                      statusOption.value === "arquivado" && "bg-muted-foreground",
                      statusOption.value !== "ativo" &&
                        statusOption.value !== "alta" &&
                        statusOption.value !== "arquivado" &&
                        "bg-warning"
                    )}
                  />
                  <span>{statusOption.label}</span>
                </div>
                {isCurrent && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
