import React from "react";
import { Users, FlaskConical, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SimulationAudienceMode } from "@/contexts/FeatureFlagsContext";

interface SimulationMobileAudienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audienceMode: SimulationAudienceMode;
  onAudienceModeChange: (mode: SimulationAudienceMode) => void;
}

export const SimulationMobileAudienceDialog: React.FC<SimulationMobileAudienceDialogProps> = ({
  open,
  onOpenChange,
  audienceMode,
  onAudienceModeChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] max-w-sm rounded-2xl p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-amber-600" />
            Selecionar Visão de Público
          </DialogTitle>
          <DialogDescription className="text-xs">
            Alterne entre visualizar recursos liberados para testadores ou a experiência padrão de clientes comuns.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <button
            type="button"
            onClick={() => {
              onAudienceModeChange("tester");
              onOpenChange(false);
            }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
              audienceMode === "tester"
                ? "border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold"
                : "border-border hover:bg-muted/60 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <div>
                <div className="font-semibold">Visão Tester</div>
                <div className="text-xs text-muted-foreground font-normal">Acessa novidades e flags restritas a testes</div>
              </div>
            </div>
            {audienceMode === "tester" && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => {
              onAudienceModeChange("common");
              onOpenChange(false);
            }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
              audienceMode === "common"
                ? "border-amber-500 bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold"
                : "border-border hover:bg-muted/60 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div>
                <div className="font-semibold">Visão Comum</div>
                <div className="text-xs text-muted-foreground font-normal">Visão estrita de produção do cliente final</div>
              </div>
            </div>
            {audienceMode === "common" && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
