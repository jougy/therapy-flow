import { memo } from "react";
import { ArrowUpDown, BarChart3, CalendarDays, FileText, ListFilter, Plus, Search, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import {
  HOME_PATIENT_SORT_OPTIONS,
  HOME_SESSION_SORT_OPTIONS,
  type HomePatientSortKey,
  type HomeSessionSortKey,
} from "@/lib/home-patients-view";
import { getDesignLabButtonClass, designLabIconClass, designLabLabelClass } from "@/lib/design-animations";

export type HomeListMode = "patients" | "sessions";

interface PatientSearchToolbarProps {
  searchInputRef?: React.RefObject<HTMLInputElement>;
  listMode: HomeListMode;
  onListModeChange: (mode: HomeListMode) => void;
  hasClinicSessionsList: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  activeFilterCount: number;
  sortKey: HomePatientSortKey;
  onSortKeyChange: (key: HomePatientSortKey) => void;
  sessionSortKey: HomeSessionSortKey;
  onSessionSortKeyChange: (key: HomeSessionSortKey) => void;
  onOpenNewPatient: () => void;
  onOpenAgenda: () => void;
  onOpenDashboard: () => void;
  canViewFinancialData: boolean;
  showGeneralDashboard: boolean;
  mobileSearchFocused: boolean;
  onMobileSearchFocusChange: (focused: boolean) => void;
}

const designLabActionButtonClass =
  "group/design-action w-10 justify-center gap-0 overflow-hidden px-0 transition-[width,gap,padding,box-shadow,border-color,background-color,transform] duration-700 ease-in-out hover:justify-start hover:gap-2 hover:px-3.5 focus-visible:justify-start focus-visible:gap-2 focus-visible:px-3.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_10px_22px_hsl(var(--primary)/0.10)]";

const designLabPrimaryActionButtonClass =
  "group/design-action w-10 justify-center gap-0 overflow-hidden px-0 transition-[width,gap,padding,box-shadow,transform,background-color] duration-700 ease-in-out hover:w-[168px] hover:justify-start hover:gap-2 hover:px-3.5 hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.16),0_10px_22px_hsl(var(--primary)/0.16)] focus-visible:w-[168px] focus-visible:justify-start focus-visible:gap-2 focus-visible:px-3.5";

export const PatientSearchToolbar = memo(function PatientSearchToolbar({
  searchInputRef,
  listMode,
  onListModeChange,
  hasClinicSessionsList,
  search,
  onSearchChange,
  activeFilterCount,
  sortKey,
  onSortKeyChange,
  sessionSortKey,
  onSessionSortKeyChange,
  onOpenNewPatient,
  onOpenAgenda,
  onOpenDashboard,
  canViewFinancialData,
  showGeneralDashboard,
  mobileSearchFocused,
  onMobileSearchFocusChange,
}: PatientSearchToolbarProps) {
  const designLabTriggerClass =
    "group/design-action w-10 flex-none justify-center overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,transform] duration-700 ease-in-out hover:w-[116px] hover:justify-start hover:px-3.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_10px_22px_hsl(var(--primary)/0.10)] focus-visible:w-[116px] focus-visible:justify-start focus-visible:px-3.5 [&>svg:last-child]:hidden [&>svg:last-child]:w-0";

  const renderListModeSwitch = (compact = false) => (
    <LiquidTabs
      tabs={[
        {
          id: "patients",
          label: compact ? "" : "Pacientes",
          icon: UsersRound,
          buttonClass: compact ? "" : getDesignLabButtonClass("hover:w-[126px]"),
          labelClass: compact ? "" : designLabLabelClass,
          iconClass: compact ? "" : designLabIconClass,
        },
        ...(hasClinicSessionsList
          ? [
              {
                id: "sessions",
                label: compact ? "" : "Atendimentos",
                icon: FileText,
                buttonClass: compact ? "" : getDesignLabButtonClass("hover:w-[154px]"),
                labelClass: compact ? "" : designLabLabelClass,
                iconClass: compact ? "" : designLabIconClass,
              },
            ]
          : []),
      ]}
      activeTab={listMode}
      onChange={(val) => onListModeChange(val as HomeListMode)}
      className={compact ? "w-24" : ""}
      tabClassName={compact ? "px-2 flex-1" : ""}
    />
  );

  return (
    <>
      {/* Mobile Toolbar */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 transition-[flex-basis,width] duration-200 ease-out">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={listMode === "patients" ? "Buscar paciente..." : "Buscar atendimento..."}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => onMobileSearchFocusChange(true)}
              onBlur={() => onMobileSearchFocusChange(false)}
              className="h-10 rounded-xl border-muted-foreground/20 bg-muted/20 pl-10 text-[16px] shadow-none"
              aria-label={listMode === "patients" ? "Busca mobile de pacientes" : "Busca mobile de atendimentos"}
            />
          </div>
          {!mobileSearchFocused && (
            <div className="flex shrink-0 items-center gap-2">
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="relative h-10 w-10 rounded-xl px-0"
                  aria-label={activeFilterCount > 0 ? `Ajustes da lista, ${activeFilterCount} filtros ativos` : "Ajustes da lista"}
                >
                  <ListFilter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <Select
                value={listMode === "patients" ? sortKey : sessionSortKey}
                onValueChange={(value) => {
                  if (listMode === "patients") {
                    onSortKeyChange(value as HomePatientSortKey);
                  } else {
                    onSessionSortKeyChange(value as HomeSessionSortKey);
                  }
                }}
              >
                <SelectTrigger
                  className="h-10 w-10 justify-center rounded-xl px-0 [&>svg:last-child]:hidden [&>svg:last-child]:w-0"
                  aria-label={listMode === "patients" ? "Ordem dos pacientes" : "Ordem dos atendimentos"}
                >
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent>
                  {(listMode === "patients" ? HOME_PATIENT_SORT_OPTIONS : HOME_SESSION_SORT_OPTIONS).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ComponentHelpButton helpId="patient-search-toolbar" size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Desktop Toolbar */}
      <div data-tutorial="patient-search-toolbar" className="hidden items-center gap-3 md:flex md:flex-wrap">
        <div data-tutorial="patient-search-input" className="relative min-w-[200px] max-w-lg flex-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={listMode === "patients" ? "Buscar paciente, CPF ou telefone..." : "Buscar atendimento, paciente, status ou data..."}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-12"
              aria-label={listMode === "patients" ? "Buscar paciente por nome, CPF ou telefone" : "Buscar atendimento por paciente, status ou data"}
            />
            {!search && (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70 md:inline-flex">
                ⌘K
              </kbd>
            )}
          </div>
          <ComponentHelpButton helpId="patient-search-toolbar" size="sm" />
        </div>

        <DialogTrigger asChild>
          <Button
            data-tutorial="patient-filter-tags"
            variant="outline"
            className={`${designLabActionButtonClass} hover:w-[108px] focus-visible:w-[108px]`}
            aria-label={activeFilterCount > 0 ? `Filtro, ${activeFilterCount} ativos` : "Filtro"}
          >
            <ListFilter className={designLabIconClass} />
            <span className={designLabLabelClass}>Filtro</span>
            {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
          </Button>
        </DialogTrigger>

        {/* Sort Select */}
        <div className="flex items-center">
          <Select
            value={listMode === "patients" ? sortKey : sessionSortKey}
            onValueChange={(value) => {
              if (listMode === "patients") {
                onSortKeyChange(value as HomePatientSortKey);
              } else {
                onSessionSortKeyChange(value as HomeSessionSortKey);
              }
            }}
          >
            <SelectTrigger className={designLabTriggerClass} aria-label={listMode === "patients" ? "Ordem dos pacientes" : "Ordem dos atendimentos"}>
              <div className="flex min-w-0 items-center gap-0 transition-[gap] duration-700 ease-in-out group-hover/design-action:gap-2 group-focus-visible/design-action:gap-2">
                <ArrowUpDown className={`h-4 w-4 shrink-0 text-muted-foreground group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]`} />
                <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[7rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[7rem] group-focus-visible/design-action:opacity-100">
                  Ordem
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {(listMode === "patients" ? HOME_PATIENT_SORT_OPTIONS : HOME_SESSION_SORT_OPTIONS).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List Mode Switch */}
        <div className="shrink-0">{renderListModeSwitch()}</div>

        {/* New Patient Action */}
        <Button
          data-tutorial="patient-add-btn"
          className={designLabPrimaryActionButtonClass}
          onClick={onOpenNewPatient}
          aria-label="Novo Paciente"
        >
          <Plus className={designLabIconClass} />
          <span className={designLabLabelClass}>Novo Paciente</span>
        </Button>

        {/* Far Right Actions */}
        <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="default"
            className={`${designLabActionButtonClass} hover:w-[116px] focus-visible:w-[116px]`}
            onClick={onOpenAgenda}
            aria-label="Abrir agenda"
          >
            <CalendarDays className={designLabIconClass} />
            <span className={designLabLabelClass}>Agenda</span>
          </Button>

          {canViewFinancialData && showGeneralDashboard ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              className={`${designLabActionButtonClass} hover:w-[144px] focus-visible:w-[144px]`}
              onClick={onOpenDashboard}
              aria-label="Abrir estatísticas"
            >
              <BarChart3 className={designLabIconClass} />
              <span className={designLabLabelClass}>Estatísticas</span>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
});
