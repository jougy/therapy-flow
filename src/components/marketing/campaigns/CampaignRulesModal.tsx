import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, CheckCircle2 } from "lucide-react";

export interface CampaignRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  rulesList: string[];
}

export const CampaignRulesModal: React.FC<CampaignRulesModalProps> = ({
  open,
  onOpenChange,
  title,
  rulesList,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] max-w-full overflow-hidden p-5 sm:p-6">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Regras do {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confira as diretrizes para validação e liquidação do bônus.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 py-2 text-xs sm:text-sm text-foreground/90 max-h-[60vh] overflow-y-auto">
          {rulesList.map((rule, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border">
              <div className="p-1 rounded bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed text-foreground/90">{rule}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            className="w-full sm:w-auto h-10 min-h-[44px] text-xs font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Entendi as Regras
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
