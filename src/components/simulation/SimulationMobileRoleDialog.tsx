import React from "react";
import { UserCog, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const platformRoleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Administrador",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário",
};

interface SimulationMobileRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulatedRole: string;
  onRoleChange: (role: string) => void;
}

export const SimulationMobileRoleDialog: React.FC<SimulationMobileRoleDialogProps> = ({
  open,
  onOpenChange,
  simulatedRole,
  onRoleChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] max-w-sm rounded-2xl p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-5 w-5 text-amber-600" />
            Selecionar Papel Simulado
          </DialogTitle>
          <DialogDescription className="text-xs">
            Alterne instantaneamente a visualização de permissões para o papel selecionado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {Object.entries(platformRoleLabels).map(([key, label]) => {
            const isSelected = simulatedRole === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onRoleChange(key);
                  onOpenChange(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold"
                    : "border-border hover:bg-muted/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{label}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-amber-600" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
