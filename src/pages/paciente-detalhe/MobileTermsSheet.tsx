import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Baby, ChevronRight, FileCheck2, FileText, Printer } from "lucide-react";
import type { Patient } from "./pacienteDetalheTypes";

export interface MobileTermsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  canPrint: boolean;
  onPrintAdultConsent: () => void;
  onPrintGuardianConsent: () => void;
  onPrintRegistration: () => void;
}

export const MobileTermsSheet: React.FC<MobileTermsSheetProps> = ({
  open,
  onOpenChange,
  patient,
  canPrint,
  onPrintAdultConsent,
  onPrintGuardianConsent,
  onPrintRegistration,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <span>Termos & Documentos</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Gere ou imprima termos de consentimento e documentação de {patient.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 py-4">
          <button
            type="button"
            disabled={!canPrint}
            onClick={() => {
              onOpenChange(false);
              onPrintAdultConsent();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-xs">Termo de Consentimento Adulto (TCLE)</p>
                <p className="text-[11px] text-muted-foreground">TCLE A4 diagramado para assinatura física</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            disabled={!canPrint}
            onClick={() => {
              onOpenChange(false);
              onPrintGuardianConsent();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-3">
              <Baby className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-xs">Termo do Responsável (Menor)</p>
                <p className="text-[11px] text-muted-foreground">LGPD Art. 14 / Pais e Tutores legais</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            disabled={!canPrint}
            onClick={() => {
              onOpenChange(false);
              onPrintRegistration();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-3">
              <Printer className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-xs">Imprimir Dossiê do Cadastro (PDF)</p>
                <p className="text-[11px] text-muted-foreground">Ficha completa e histórico de saúde</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
