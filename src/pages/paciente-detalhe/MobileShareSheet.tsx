import { ChevronRight, FileDown, FileText, Share2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  canExport: boolean;
  onShareRegistration: () => void;
  onViewFullRegistration: () => void;
  onExportJson: () => void;
}

export const MobileShareSheet = ({
  open,
  onOpenChange,
  patientName,
  canExport,
  onShareRegistration,
  onViewFullRegistration,
  onExportJson,
}: MobileShareSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            Cadastro & Opções
          </SheetTitle>
          <SheetDescription className="text-xs">
            Opções de compartilhamento e cadastro de {patientName}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 py-4 max-h-[65dvh] overflow-y-auto overscroll-contain">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onShareRegistration();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground text-sm font-medium transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Share2 className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-xs text-primary truncate">
                  Compartilhar cadastro para o paciente preencher
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Enviar link de preenchimento
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-primary shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onViewFullRegistration();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-xs truncate">Ver cadastro completo</p>
                <p className="text-[11px] text-muted-foreground">
                  Visualizar todos os dados do paciente
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            disabled={!canExport}
            onClick={() => {
              onOpenChange(false);
              onExportJson();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileDown className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-xs truncate">Exportar dados (JSON)</p>
                <p className="text-[11px] text-muted-foreground">
                  Baixar cópia estruturada dos dados
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
