import { memo, useMemo, useState } from "react";
import { ArrowDown, Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HOME_PATIENT_AGENDA_STATUS_OPTIONS,
  HOME_PATIENT_PAYMENT_STATUS_OPTIONS,
  HOME_PATIENT_RECURRENCE_STATUS_OPTIONS,
  HOME_PATIENT_WEEKDAY_OPTIONS,
  type HomeAgendaEventRecord,
  type HomeCollaboratorFilterRecord,
  type HomePatientAgendaFilterStatus,
  type HomePatientGroupRecord,
  type HomePatientPaymentFilterStatus,
  type HomePatientRecurrenceFilterStatus,
} from "@/lib/home-patients-view";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { PATIENT_ORIGIN_OPTIONS, type PatientOriginType } from "@/lib/patient-origin";

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export type FilterSectionKey =
  | "agenda"
  | "collaborator"
  | "dates"
  | "groups"
  | "origins"
  | "payments"
  | "recurrence"
  | "statuses"
  | "weekdays";

interface PatientFilterDialogProps {
  canViewFinancialData: boolean;
  patientGroups: HomePatientGroupRecord[];
  collaborators: HomeCollaboratorFilterRecord[];
  selectedStatuses: string[];
  onSelectedStatusesChange: (statuses: string[]) => void;
  selectedOriginTypes: PatientOriginType[];
  onSelectedOriginTypesChange: (origins: PatientOriginType[]) => void;
  selectedPaymentStatuses: HomePatientPaymentFilterStatus[];
  onSelectedPaymentStatusesChange: (payments: HomePatientPaymentFilterStatus[]) => void;
  selectedAgendaStatuses: HomePatientAgendaFilterStatus[];
  onSelectedAgendaStatusesChange: (agenda: HomePatientAgendaFilterStatus[]) => void;
  selectedRecurrenceStatuses: HomePatientRecurrenceFilterStatus[];
  onSelectedRecurrenceStatusesChange: (recurrence: HomePatientRecurrenceFilterStatus[]) => void;
  selectedRecurringWeekdays: number[];
  onSelectedRecurringWeekdaysChange: (weekdays: number[]) => void;
  selectedGroupNames: string[];
  onSelectedGroupNamesChange: (groups: string[]) => void;
  selectedColors: string[];
  onSelectedColorsChange: (colors: string[]) => void;
  selectedCollaboratorIds: string[];
  onSelectedCollaboratorIdsChange: (ids: string[]) => void;
  sessionDateFrom: string;
  onSessionDateFromChange: (date: string) => void;
  sessionDateTo: string;
  onSessionDateToChange: (date: string) => void;
  selectedWeekdays: number[];
  onSelectedWeekdaysChange: (weekdays: number[]) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
}

export const PatientFilterDialog = memo(function PatientFilterDialog({
  canViewFinancialData,
  patientGroups,
  collaborators,
  selectedStatuses,
  onSelectedStatusesChange,
  selectedOriginTypes,
  onSelectedOriginTypesChange,
  selectedPaymentStatuses,
  onSelectedPaymentStatusesChange,
  selectedAgendaStatuses,
  onSelectedAgendaStatusesChange,
  selectedRecurrenceStatuses,
  onSelectedRecurrenceStatusesChange,
  selectedRecurringWeekdays,
  onSelectedRecurringWeekdaysChange,
  selectedGroupNames,
  onSelectedGroupNamesChange,
  selectedColors,
  onSelectedColorsChange,
  selectedCollaboratorIds,
  onSelectedCollaboratorIdsChange,
  sessionDateFrom,
  onSessionDateFromChange,
  sessionDateTo,
  onSessionDateToChange,
  selectedWeekdays,
  onSelectedWeekdaysChange,
  onClearFilters,
  onApplyFilters,
}: PatientFilterDialogProps) {
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    agenda: false,
    collaborator: true,
    dates: false,
    groups: true,
    origins: false,
    payments: false,
    recurrence: false,
    statuses: true,
    weekdays: false,
  });

  const toggleSection = (section: FilterSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const availableGroups = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.name))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [patientGroups]
  );

  const availableColors = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.color))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [patientGroups]
  );

  const visibleGroups = useMemo(
    () =>
      availableGroups.filter((groupName) => {
        if (selectedColors.length === 0) return true;
        return patientGroups.some((group) => group.name === groupName && selectedColors.includes(group.color));
      }),
    [availableGroups, patientGroups, selectedColors]
  );

  const groupListHeightClass = visibleGroups.length <= 2 ? "max-h-[112px]" : "max-h-[240px]";

  const visibleCollaborators = useMemo(() => {
    const normalizedQuery = normalize(collaboratorQuery);
    return collaborators.filter((collaborator) => {
      if (!normalizedQuery) return true;
      return normalize(
        [collaborator.full_name, collaborator.email, collaborator.job_title, collaborator.operational_role]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedQuery);
    });
  }, [collaboratorQuery, collaborators]);

  const collaboratorListHeightClass = visibleCollaborators.length <= 2 ? "max-h-[128px]" : "max-h-[240px]";

  const toggleString = <T extends string>(item: T, list: T[], onChange: (next: T[]) => void) => {
    onChange(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const toggleNumber = (item: number, list: number[], onChange: (next: number[]) => void) => {
    onChange(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  return (
    <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
      <DialogHeader className="text-left">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription className="text-sm">
              Refine a lista por status, origem, pagamentos, agendamentos, recorrência, grupos, colaborador e período.
            </DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" className="mr-8 shrink-0" onClick={onClearFilters}>
            Sem filtros
          </Button>
        </div>
      </DialogHeader>

      <ScrollArea className="max-h-[70vh] pr-4">
        <div className="space-y-4">
          {/* Status Section */}
          <Collapsible open={openSections.statuses} onOpenChange={() => toggleSection("statuses")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Status de atividade</span>
              {openSections.statuses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {PATIENT_STATUS_OPTIONS.map((statusOption) => (
                  <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedStatuses.includes(statusOption.value)}
                      onCheckedChange={() => toggleString(statusOption.value, selectedStatuses, onSelectedStatusesChange)}
                      aria-label={statusOption.label}
                    />
                    <span>{statusOption.label}</span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Origins Section */}
          <Collapsible open={openSections.origins} onOpenChange={() => toggleSection("origins")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Origem do paciente</span>
              {openSections.origins ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {PATIENT_ORIGIN_OPTIONS.map((originOption) => (
                  <label key={originOption.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedOriginTypes.includes(originOption.value)}
                      onCheckedChange={() => toggleString(originOption.value, selectedOriginTypes, onSelectedOriginTypesChange)}
                      aria-label={originOption.label}
                    />
                    <span>{originOption.label}</span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Payments Section */}
          {canViewFinancialData && (
            <Collapsible open={openSections.payments} onOpenChange={() => toggleSection("payments")}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                <span className="font-medium">Status de pagamento</span>
                {openSections.payments ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {HOME_PATIENT_PAYMENT_STATUS_OPTIONS.map((statusOption) => (
                    <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedPaymentStatuses.includes(statusOption.value)}
                        onCheckedChange={() => toggleString(statusOption.value, selectedPaymentStatuses, onSelectedPaymentStatusesChange)}
                        aria-label={statusOption.label}
                      />
                      <span>{statusOption.label}</span>
                    </label>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Agenda Section */}
          <Collapsible open={openSections.agenda} onOpenChange={() => toggleSection("agenda")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Status de agendamento</span>
              {openSections.agenda ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-2 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {HOME_PATIENT_AGENDA_STATUS_OPTIONS.map((statusOption) => (
                  <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedAgendaStatuses.includes(statusOption.value)}
                      onCheckedChange={() => toggleString(statusOption.value, selectedAgendaStatuses, onSelectedAgendaStatusesChange)}
                      aria-label={statusOption.label}
                    />
                    <span>{statusOption.label}</span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Recurrence Section */}
          <Collapsible open={openSections.recurrence} onOpenChange={() => toggleSection("recurrence")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Recorrência programada</span>
              {openSections.recurrence ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-2 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {HOME_PATIENT_RECURRENCE_STATUS_OPTIONS.map((statusOption) => (
                  <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedRecurrenceStatuses.includes(statusOption.value)}
                      onCheckedChange={() => toggleString(statusOption.value, selectedRecurrenceStatuses, onSelectedRecurrenceStatusesChange)}
                      aria-label={statusOption.label}
                    />
                    <span>{statusOption.label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dias programados</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {HOME_PATIENT_WEEKDAY_OPTIONS.map((weekday) => (
                    <label key={weekday.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedRecurringWeekdays.includes(weekday.value)}
                        onCheckedChange={() => toggleNumber(weekday.value, selectedRecurringWeekdays, onSelectedRecurringWeekdaysChange)}
                        aria-label={`Recorrência em ${weekday.label}`}
                      />
                      <span>{weekday.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Groups Section */}
          <Collapsible open={openSections.groups} onOpenChange={() => toggleSection("groups")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Grupos</span>
              {openSections.groups ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-2">
                  {availableColors.map((color) => {
                    const selected = selectedColors.includes(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`relative h-5 w-5 shrink-0 rounded-full transition hover:scale-105 ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        onClick={() => toggleString(color, selectedColors, onSelectedColorsChange)}
                        aria-pressed={selected}
                        aria-label={`Cor ${color}`}
                        title={color}
                        style={{ backgroundColor: color }}
                      >
                        <span className="sr-only">{color}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              <ScrollArea className={`${groupListHeightClass} rounded-lg border`}>
                <div className="divide-y">
                  {visibleGroups.map((groupName) => {
                    const selected = selectedGroupNames.includes(groupName);
                    const groupColor = patientGroups.find((group) => group.name === groupName)?.color ?? "#CBD5E1";
                    return (
                      <button
                        key={groupName}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        style={{ boxShadow: `inset 4px 0 0 ${groupColor}` }}
                        onClick={() => toggleString(groupName, selectedGroupNames, onSelectedGroupNamesChange)}
                      >
                        <Checkbox checked={selected} aria-label={groupName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{groupName}</p>
                        </div>
                        {selected && (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" />
                            Selecionado
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                  {visibleGroups.length === 0 && (
                    <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum grupo encontrado para as cores selecionadas.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>

          {/* Collaborator Section */}
          <Collapsible open={openSections.collaborator} onOpenChange={() => toggleSection("collaborator")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Colaborador</span>
              {openSections.collaborator ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={collaboratorQuery}
                  onChange={(event) => setCollaboratorQuery(event.target.value)}
                  placeholder="Buscar por nome, email, função ou cargo"
                  className="pl-9"
                />
              </div>
              <ScrollArea className={`${collaboratorListHeightClass} rounded-lg border`}>
                <div className="divide-y">
                  {visibleCollaborators.map((collaborator) => {
                    const selected = selectedCollaboratorIds.includes(collaborator.id);
                    const label = collaborator.full_name ?? collaborator.email ?? collaborator.id;
                    return (
                      <button
                        key={collaborator.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => toggleString(collaborator.id, selectedCollaboratorIds, onSelectedCollaboratorIdsChange)}
                      >
                        <Checkbox checked={selected} aria-label={`Selecionar ${label}`} />
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {label.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{label}</p>
                          <p className="truncate text-xs text-muted-foreground">{collaborator.email || "Sem email"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {collaborator.job_title && (
                            <Badge variant="outline" className="hidden sm:inline-flex">
                              {collaborator.job_title}
                            </Badge>
                          )}
                          {selected && (
                            <Badge variant="secondary" className="gap-1">
                              <Check className="h-3 w-3" />
                              Selecionado
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {visibleCollaborators.length === 0 && (
                    <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum colaborador encontrado.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>

          {/* Dates Section */}
          <Collapsible open={openSections.dates} onOpenChange={() => toggleSection("dates")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Período dos atendimentos</span>
              {openSections.dates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="home-session-date-from">
                    Data inicial
                  </label>
                  <Input
                    id="home-session-date-from"
                    type="date"
                    value={sessionDateFrom}
                    onChange={(event) => onSessionDateFromChange(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="home-session-date-to">
                    Data final
                  </label>
                  <Input
                    id="home-session-date-to"
                    type="date"
                    value={sessionDateTo}
                    onChange={(event) => onSessionDateToChange(event.target.value)}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Weekdays Section */}
          <Collapsible open={openSections.weekdays} onOpenChange={() => toggleSection("weekdays")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
              <span className="font-medium">Dias dos atendimentos</span>
              {openSections.weekdays ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {HOME_PATIENT_WEEKDAY_OPTIONS.map((weekday) => (
                  <label key={weekday.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedWeekdays.includes(weekday.value)}
                      onCheckedChange={() => toggleNumber(weekday.value, selectedWeekdays, onSelectedWeekdaysChange)}
                      aria-label={weekday.label}
                    />
                    <span>{weekday.label}</span>
                  </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" onClick={onClearFilters}>
          Limpar
        </Button>
        <Button onClick={onApplyFilters}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Aplicar filtros
        </Button>
      </DialogFooter>
    </DialogContent>
  );
});
