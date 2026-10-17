import React, { useCallback } from "react";
import { Search, SlidersHorizontal, X, Clock, Sun, Sunset, Moon, CloudMoon, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  type AgendaFilterStatus,
  type AgendaFilterType,
  type AgendaShift,
  SHIFT_FILTER_OPTIONS,
} from "./types";

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export const EVENT_TYPE_FILTER_OPTIONS: readonly FilterOption<AgendaFilterType>[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "atendimento", label: "Atendimento" },
  { value: "reuniao", label: "Reunião" },
  { value: "evento", label: "Evento" },
] as const;

export const EVENT_STATUS_FILTER_OPTIONS: readonly FilterOption<AgendaFilterStatus>[] = [
  { value: "all", label: "Todos os status" },
  { value: "confirmado", label: "Confirmado" },
  { value: "aguardando_confirmacao", label: "Aguardando confirmação" },
  { value: "cancelado", label: "Cancelado" },
  { value: "lembrete", label: "Lembrete" },
] as const;

const SHIFT_ICONS: Record<AgendaShift, React.ComponentType<{ className?: string }>> = {
  dawn: CloudMoon,
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

export interface AgendaFiltersToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: AgendaFilterType | string;
  setFilterType: (val: string) => void;
  filterStatus: AgendaFilterStatus | string;
  setFilterStatus: (val: string) => void;
  filterShifts?: AgendaShift[];
  setFilterShifts?: (val: AgendaShift[] | ((prev: AgendaShift[]) => AgendaShift[])) => void;
}

export const AgendaFiltersToolbar = React.memo(function AgendaFiltersToolbar({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterShifts = [],
  setFilterShifts,
}: AgendaFiltersToolbarProps) {
  const hasShiftFilter = filterShifts.length > 0 && filterShifts.length < 4;
  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    searchQuery.trim().length > 0 ||
    hasShiftFilter;

  const handleClearFilters = useCallback(() => {
    setFilterType("all");
    setFilterStatus("all");
    setSearchQuery("");
    if (setFilterShifts) {
      setFilterShifts([]);
    }
  }, [setFilterType, setFilterStatus, setSearchQuery, setFilterShifts]);

  const handleToggleShift = useCallback(
    (shift: AgendaShift) => {
      if (!setFilterShifts) return;
      setFilterShifts((prev) => {
        if (prev.includes(shift)) {
          return prev.filter((s) => s !== shift);
        }
        return [...prev, shift];
      });
    },
    [setFilterShifts]
  );

  const getShiftTriggerText = () => {
    if (filterShifts.length === 0 || filterShifts.length === 4) {
      return "Todos os períodos";
    }
    if (filterShifts.length === 1) {
      const found = SHIFT_FILTER_OPTIONS.find((s) => s.key === filterShifts[0]);
      return found ? found.label : "1 período";
    }
    return `${filterShifts.length} períodos`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente ou título..."
          aria-label="Buscar na agenda"
          value={searchQuery}
          onChange={(e) =>
            setSearchQuery(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.name))
          }
          maxLength={INPUT_LIMITS.name}
          className="h-9 pl-9 rounded-xl text-xs"
        />
      </div>

      {/* Mobile Filters Sheet Trigger */}
      <div className="sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`h-9 w-9 rounded-xl shrink-0 ${
                filterType !== "all" || filterStatus !== "all" || hasShiftFilter
                  ? "border-primary text-primary bg-primary/5"
                  : ""
              }`}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[85dvh] overflow-y-auto">
            <SheetHeader className="text-left pb-3">
              <SheetTitle className="text-base font-bold">Filtrar Agendamentos</SheetTitle>
              <SheetDescription className="text-xs">
                Selecione o tipo de evento, status e períodos desejados.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tipo de Evento</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-10 w-full rounded-xl text-xs">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Status do Evento</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 w-full rounded-xl text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Períodos do Dia na Sheet Mobile */}
              {setFilterShifts && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Períodos do Dia</label>
                    {hasShiftFilter && (
                      <button
                        type="button"
                        onClick={() => setFilterShifts([])}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Selecionar todos
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIFT_FILTER_OPTIONS.map((opt) => {
                      const Icon = SHIFT_ICONS[opt.key];
                      const isChecked = filterShifts.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleToggleShift(opt.key)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-colors ${
                            isChecked
                              ? "border-primary bg-primary/10 text-primary font-semibold"
                              : "border-border/60 hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleShift(opt.key)}
                            className="pointer-events-none"
                          />
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0">
                            <span className="block truncate">{opt.label}</span>
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {opt.range}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 text-xs text-muted-foreground"
                  onClick={handleClearFilters}
                >
                  Limpar todos os filtros
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Filter Selects & Drop Checklist */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Drop Checklist de Período */}
        {setFilterShifts && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-9 px-3 rounded-xl text-xs gap-1.5 font-normal justify-between min-w-[150px] ${
                  hasShiftFilter ? "border-primary text-primary bg-primary/5 font-semibold" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{getShiftTriggerText()}</span>
                </div>
                {hasShiftFilter ? (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[10px] rounded-full bg-primary/20 text-primary font-bold ml-1"
                  >
                    {filterShifts.length}
                  </Badge>
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-1 rounded-xl shadow-lg">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0 text-xs font-bold text-foreground">
                  Períodos do Dia
                </DropdownMenuLabel>
                {hasShiftFilter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFilterShifts([]);
                    }}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Resetar
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {SHIFT_FILTER_OPTIONS.map((opt) => {
                const Icon = SHIFT_ICONS[opt.key];
                const checked = filterShifts.includes(opt.key);
                return (
                  <DropdownMenuCheckboxItem
                    key={opt.key}
                    checked={checked}
                    onCheckedChange={() => handleToggleShift(opt.key)}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs cursor-pointer py-1.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{opt.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{opt.range}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[135px] rounded-xl text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[155px] rounded-xl text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleClearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
});

