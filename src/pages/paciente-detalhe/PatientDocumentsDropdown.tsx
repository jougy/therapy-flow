import { Baby, FileSignature, FileText, Printer } from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { DocumentTemplateItem } from "@/components/patients/generate-document";

interface PatientDocumentsDropdownProps {
  canPrint: boolean;
  customTemplates: DocumentTemplateItem[];
  onGenerateDocument: (templateId?: string) => void;
  onPrintRegistration: () => void;
  onPrintAdultConsent: () => void;
  onPrintGuardianConsent: () => void;
}

export function PatientDocumentsDropdown({
  canPrint,
  customTemplates,
  onGenerateDocument,
  onPrintRegistration,
  onPrintAdultConsent,
  onPrintGuardianConsent,
}: PatientDocumentsDropdownProps) {
  return (
    <DropdownMenuContent align="end" className="w-64 max-h-[70dvh] overflow-y-auto">
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Termos & Documentos
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onGenerateDocument(undefined);
        }}
        onClick={() => onGenerateDocument(undefined)}
        disabled={!canPrint}
        className="cursor-pointer"
      >
        <FileSignature className="mr-2 h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <span className="font-semibold text-primary">Gerar Documento</span>
          <span className="text-[11px] text-muted-foreground">Modelos com variáveis automáticas</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onPrintRegistration();
        }}
        onClick={onPrintRegistration}
        disabled={!canPrint}
        className="cursor-pointer"
      >
        <Printer className="mr-2 h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <span>Imprimir cadastro (PDF)</span>
          <span className="text-[11px] text-muted-foreground">Dossiê cadastral diagramado A4</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onPrintAdultConsent();
        }}
        onClick={onPrintAdultConsent}
        disabled={!canPrint}
        className="cursor-pointer"
      >
        <FileText className="mr-2 h-4 w-4 text-emerald-600" />
        <div className="flex flex-col">
          <span>Imprimir Termo de Consentimento (Adulto)</span>
          <span className="text-[11px] text-muted-foreground">TCLE A4 para assinatura física</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onPrintGuardianConsent();
        }}
        onClick={onPrintGuardianConsent}
        disabled={!canPrint}
        className="cursor-pointer"
      >
        <Baby className="mr-2 h-4 w-4 text-amber-600" />
        <div className="flex flex-col">
          <span>Imprimir Termo do Responsável (Menor)</span>
          <span className="text-[11px] text-muted-foreground">LGPD Art. 14 / Pais e Tutores</span>
        </div>
      </DropdownMenuItem>
      {customTemplates.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Modelos da Clínica
          </DropdownMenuLabel>
          {customTemplates.map((tpl) => (
            <DropdownMenuItem
              key={tpl.id}
              onSelect={(e) => {
                e.preventDefault();
                onGenerateDocument(tpl.id);
              }}
              onClick={() => onGenerateDocument(tpl.id)}
              disabled={!canPrint}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="truncate">{tpl.title}</span>
                {tpl.description && (
                  <span className="text-[11px] text-muted-foreground truncate">{tpl.description}</span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </>
      )}
    </DropdownMenuContent>
  );
}
