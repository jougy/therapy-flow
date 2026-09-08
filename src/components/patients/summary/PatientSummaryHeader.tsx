import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  FileDown,
  FileText,
  Phone,
  Printer,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";
import { formatPatientPhone } from "@/lib/patient-registration";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientSummaryHeaderProps {
  patient: Patient;
  riskFlagsCount: number;
  canPrint: boolean;
  onBack: () => void;
  onDashboard: () => void;
  onEdit: () => void;
  onShare: () => void;
  onPrint: () => void;
  onExportJson: () => void;
}

export const PatientSummaryHeader: React.FC<PatientSummaryHeaderProps> = ({
  patient,
  riskFlagsCount,
  canPrint,
  onBack,
  onDashboard,
  onEdit,
  onShare,
  onPrint,
  onExportJson,
}) => {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="-ml-3 w-fit px-3 text-xs sm:text-sm"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao paciente
        </Button>

        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight">Resumo Clínico</h1>
            {patient.patient_code ? (
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                Prontuário: {patient.patient_code}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-base font-medium text-foreground">{patient.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-0.5">
          {patient.age !== null && patient.age !== undefined ? (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {patient.age} {patient.age === 1 ? "ano" : "anos"}
            </span>
          ) : null}
          {patient.phone ? (
            <span className="flex items-center gap-1.5 font-mono">
              <Phone className="h-3.5 w-3.5" /> {formatPatientPhone(patient.phone)}
            </span>
          ) : null}
          {patient.registration_complete ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Cadastro concluído
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-500/40 gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Cadastro preliminar
            </Badge>
          )}
          <Badge variant="secondary" className="capitalize text-xs">
            {patient.status || "Ativo"}
          </Badge>
          {riskFlagsCount > 0 ? (
            <Badge variant="destructive" className="gap-1 text-xs animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {riskFlagsCount} {riskFlagsCount === 1 ? "Alerta de risco" : "Alertas de risco"}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onDashboard} className="text-xs sm:text-sm">
          <BarChart3 className="mr-2 h-4 w-4" />
          Dashboard
        </Button>

        <Button variant="outline" onClick={onEdit} className="text-xs sm:text-sm">
          <ClipboardEdit className="mr-2 h-4 w-4" />
          Editar cadastro
        </Button>

        <Button variant="outline" onClick={onShare} className="text-xs sm:text-sm">
          <Share2 className="mr-2 h-4 w-4" />
          Compartilhar cadastro
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 text-xs sm:text-sm">
              <Printer className="h-4 w-4 text-primary" />
              <span>Imprimir / Exportar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem
              onClick={onPrint}
              disabled={!canPrint}
              className="cursor-pointer"
            >
              <Printer className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="font-medium">Imprimir cadastro (PDF)</span>
                <span className="text-[11px] text-muted-foreground">Dossiê completo diagramado A4</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onExportJson}
              className="cursor-pointer"
            >
              <FileDown className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="font-medium">Exportar dados (JSON)</span>
                <span className="text-[11px] text-muted-foreground">Portabilidade LGPD (Art. 18, V)</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
