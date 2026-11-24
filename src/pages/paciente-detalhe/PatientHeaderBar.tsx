import type { FC } from "react";
import { AlertTriangle, Calendar, CheckCircle2, FileDown, FileText, MoreHorizontal, Phone, Printer, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientAvatar } from "@/components/patients/PatientAvatar";
import { ExclusivePatientBadge } from "@/components/patients/ExclusivePatientBadge";
import { getClinicPatientPath } from "@/lib/patient-routing";
import { EDITABLE_PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { cn } from "@/lib/utils";
import { PatientDocumentsDropdown } from "./PatientDocumentsDropdown";
import { PatientHeaderAlert, WhatsAppLogo } from "./pacienteDetalheHelpers";
import type { PatientStatusSelectValue } from "./pacienteDetalheTypes";
import { usePatientWorkspace } from "./context/PatientWorkspaceContext";

const statusDotClass = (status: string) =>
  status === "ativo" ? "bg-success animate-pulse ring-2 ring-success/20"
    : status === "alta" ? "bg-primary"
    : status === "arquivado" ? "bg-muted-foreground"
    : "bg-warning";

export const PatientHeaderBar: FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const ws = usePatientWorkspace();
  const patient = ws.patient;
  if (!patient) return null;

  return (
    <>
      <h1 className="sr-only">{patient.name}</h1>

      {/* Barra Mobile Compacta ocultada no fluxo normal pois o AppLayout já exibe o header do paciente */}
      <div className="hidden items-center justify-between gap-2 rounded-2xl border bg-card/90 px-3 py-2 shadow-2xs min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PatientAvatar
            patientId={patient.id}
            patientCode={patient.patient_code}
            patientName={patient.name}
            avatarUrl={patient.avatar_url}
            gender={patient.gender}
            size="sm"
            showViewPatientAction={false}
          />
          <span className="text-sm font-bold text-foreground truncate">{patient.name}</span>
          <ExclusivePatientBadge patient={patient} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ws.canViewPatientContact && ws.patientWhatsAppHref && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => ws.patientWhatsAppHref && window.open(ws.patientWhatsAppHref, "_blank", "noopener,noreferrer")}
              aria-label="Abrir WhatsApp do paciente"
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl border-success/30 bg-success/10 text-success hover:bg-success/15 shrink-0"
            >
              <WhatsAppLogo className="h-4 w-4" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => ws.setMobileStatusSheetOpen(true)}
            aria-label={`Status: ${patient.status}. Tocar para alterar.`}
            className="flex min-h-[44px] items-center gap-1.5 shrink-0 rounded-full border bg-background px-3 py-1 text-xs font-semibold capitalize text-foreground shadow-2xs"
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", statusDotClass(patient.status))} />
            <span>{patient.status}</span>
          </button>
        </div>
      </div>

      {/* Header Unificado Desktop */}
      <div data-tutorial="patient-profile-header" className="hidden md:block overflow-hidden rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-2.5 sm:px-4 sm:py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <ExclusivePatientBadge patient={patient} />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {patient.age ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {patient.age} anos
                </span>
              ) : null}
              {ws.canViewPatientContact && patient.phone ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                  <Phone className="h-3.5 w-3.5" />
                  {patient.phone}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(getClinicPatientPath(ws.targetClinicKey, patient, "cadastro"))}
                title="Editar cadastro completo"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  patient.registration_complete ? "bg-success/10 text-success hover:bg-success/15" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                )}
              >
                {patient.registration_complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {ws.patientRegistrationStatus}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:flex-1 xl:justify-center">
            <PatientHeaderAlert icon={<AlertTriangle className="h-4 w-4" />} items={ws.allAllergyAlertItems} title="Alergias" tone="rose" />
            <PatientHeaderAlert icon={<AlertTriangle className="h-4 w-4" />} items={ws.fallRiskAlertItems} title="Risco de queda" tone="amber" />
            <PatientHeaderAlert icon={<AlertTriangle className="h-4 w-4" />} items={ws.structuredRiskAlertItems} title="Riscos" tone="amber" />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border bg-background/70 p-2 shadow-sm backdrop-blur xl:shrink-0">
            {ws.canViewPatientContact && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => ws.patientWhatsAppHref && window.open(ws.patientWhatsAppHref, "_blank", "noopener,noreferrer")}
                disabled={!ws.patientWhatsAppHref}
                aria-label="Abrir WhatsApp do paciente"
                title="Abrir WhatsApp"
                className="h-9 w-9 rounded-xl border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success shrink-0"
              >
                <WhatsAppLogo className="h-4.5 w-4.5" />
              </Button>
            )}

            <DropdownMenu onOpenChange={ws.setTermsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Termos e impressões"
                  title="Termos e impressões do paciente"
                  className="h-9 rounded-xl border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground gap-1.5 px-2.5 shrink-0"
                >
                  <Printer className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">Termos</span>
                </Button>
              </DropdownMenuTrigger>
              <PatientDocumentsDropdown
                canPrint={ws.canPrint}
                customTemplates={ws.customTemplates}
                onGenerateDocument={(templateId) => { ws.setInitialGenerateTemplateId(templateId); ws.setShowGenerateDocumentModal(true); }}
                onPrintRegistration={() => ws.setShowPrintRegistrationModal(true)}
                onPrintAdultConsent={() => ws.setShowPrintAdultConsentModal(true)}
                onPrintGuardianConsent={() => ws.setShowPrintGuardianConsentModal(true)}
              />
            </DropdownMenu>

            <Select
              value={patient.status}
              onValueChange={(val) => void ws.handlePatientStatusChange(val as PatientStatusSelectValue)}
              disabled={ws.updatingPatientStatus || ws.deletingPatient}
            >
              <SelectTrigger className="h-9 w-[125px] rounded-xl text-xs bg-background shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EDITABLE_PATIENT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value} className="text-xs">{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Mais opções"
                  title="Mais opções do paciente"
                  className="h-9 rounded-xl border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground gap-1.5 px-2.5 shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Opções</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Opções do paciente</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-tutorial="patient-btn-share-form" onClick={() => ws.handleOpenShareDialog()} className="cursor-pointer">
                  <Share2 className="mr-2 h-4 w-4 text-primary" />
                  <span>Compartilhar cadastro para o paciente preencher</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(getClinicPatientPath(ws.targetClinicKey, patient, "resumo"))} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Ver cadastro completo</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => ws.handleExportPatientJson()} disabled={!ws.canExport} className="cursor-pointer">
                  <FileDown className="mr-2 h-4 w-4" />
                  <span>Exportar dados (JSON)</span>
                </DropdownMenuItem>
                {ws.canDeletePatient && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => ws.setDeletePatientDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Excluir paciente</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
};
