import { useState } from "react";
import { FileText, Download, Printer, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyCents } from "@/lib/session-operations";

export interface SessionDossierItem {
  id: string;
  date: string;
  professionalName?: string;
  professionalRegistration?: string; // ex: CREFITO 123456-F
  clinicalSummary?: string;
  cidCode?: string;
}

export interface ReimbursementDossierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientCpf?: string | null;
  patientCardNumber?: string | null;
  insuranceName?: string | null;
  clinicName: string;
  clinicCnpj?: string | null;
  clinicAddress?: string | null;
  totalPaidCents: number;
  sessions: SessionDossierItem[];
}

export const ReimbursementDossierModal = ({
  open,
  onOpenChange,
  patientName,
  patientCpf,
  patientCardNumber,
  insuranceName,
  clinicName,
  clinicCnpj,
  clinicAddress,
  totalPaidCents,
  sessions,
}: ReimbursementDossierModalProps) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Dossiê de Reembolso do Paciente
          </DialogTitle>
          <DialogDescription className="text-xs">
            Documento consolidado pronto para impressão ou PDF, contendo recibo financeiro, presença autenticada e laudo clínico.
          </DialogDescription>
        </DialogHeader>

        {/* Folha do Documento (Pronta para Impressão) */}
        <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm print:border-none print:p-0 print:shadow-none">
          {/* Cabeçalho da Clínica */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">{clinicName}</h2>
              {clinicCnpj && <p className="text-xs text-muted-foreground">CNPJ: {clinicCnpj}</p>}
              {clinicAddress && <p className="text-xs text-muted-foreground">{clinicAddress}</p>}
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                DECLARAÇÃO DE TRATAMENTO & REEMBOLSO
              </span>
              <p className="text-[11px] text-muted-foreground mt-1">
                Data de emissão: {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Dados do Paciente */}
          <div className="rounded-md bg-muted/30 p-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Paciente:</span>{" "}
              <strong className="text-foreground">{patientName}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>{" "}
              <strong className="text-foreground">{patientCpf || "Não informado"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Operadora de Saúde:</span>{" "}
              <strong className="text-foreground">{insuranceName || "Livre Escolha"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Carteirinha / Matrícula:</span>{" "}
              <strong className="text-foreground">{patientCardNumber || "Não informada"}</strong>
            </div>
          </div>

          {/* Declaração de Quitação */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comprovante de Pagamento / Quitação Particular
            </h3>
            <div className="rounded-md border p-3 flex justify-between items-center text-sm">
              <span>Valor Total Pago pelo Paciente:</span>
              <strong className="text-base text-success font-bold">
                {formatMoneyCents(totalPaidCents)}
              </strong>
            </div>
          </div>

          {/* Relação de Sessões e Presenças */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sessões Realizadas e Evolução Clínica ({sessions.length})
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma sessão finalizada vinculada a este dossiê.</p>
            ) : (
              <div className="divide-y rounded-md border text-xs">
                {sessions.map((sess, idx) => (
                  <div key={sess.id || idx} className="p-3 space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Sessão #{idx + 1} - {sess.date}</span>
                      <span className="text-muted-foreground">{sess.professionalRegistration || "Profissional Responsável"}</span>
                    </div>
                    {sess.cidCode && (
                      <p className="text-[11px] text-muted-foreground">CID: {sess.cidCode}</p>
                    )}
                    {sess.clinicalSummary && (
                      <p className="text-[11px] text-foreground/80 line-clamp-2">{sess.clinicalSummary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assinatura do Profissional */}
          <div className="pt-8 border-t flex flex-col items-center justify-center text-center">
            <div className="w-64 border-b border-foreground/40 mb-2"></div>
            <p className="text-xs font-medium text-foreground">Assinatura e Carimbo do Responsável Técnico</p>
            <p className="text-[10px] text-muted-foreground">Documento emitido digitalmente pela plataforma PluriHealth</p>
          </div>
        </div>

        <DialogFooter className="print:hidden flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button className="gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir / Salvar em PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
