import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Award } from "lucide-react";
import { PersonalClinicalPortfolioTab } from "@/components/personal/PersonalClinicalPortfolioTab";
import type { ClinicalPortfolioItem } from "@/types/clinicalPortfolio";

interface PersonalClinicalPortfolioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  initialItems?: ClinicalPortfolioItem[];
}

export const PersonalClinicalPortfolioModal: React.FC<PersonalClinicalPortfolioModalProps> = ({
  open,
  onOpenChange,
  userId,
  initialItems,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90dvh] w-[96vw] sm:w-full flex flex-col p-0 overflow-hidden"
        data-testid="personal-clinical-portfolio-modal"
      >
        {/* Modal Header */}
        <div className="border-b px-4 py-3.5 sm:px-5 sm:py-4 bg-muted/20">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 pr-6">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">
                Meu Portfólio Clínico
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Histórico de Atendimentos & Acervo Profissional permanente sob sua responsabilidade técnica.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6">
          <PersonalClinicalPortfolioTab userId={userId} initialItems={initialItems} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
