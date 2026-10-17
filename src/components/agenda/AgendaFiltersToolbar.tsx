import React, { useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import type { AgendaFilterStatus, AgendaFilterType } from "./types";

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

export interface AgendaFiltersToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: AgendaFilterType | string;
  setFilterType: (val: string) => void;
  filterStatus: AgendaFilterStatus | string;
  setFilterStatus: (val: string) => void;
}

export const AgendaFiltersToolbar = React.memo(function AgendaFiltersToolbar({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
}: AgendaFiltersToolbarProps) {
  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || searchQuery.trim().length > 0;

  const handleClearFilters = useCallback(() => {
    setFilterType("all");
    setFilterStatus("all");
    setSearchQuery("");
  }, [setFilterType, setFilterStatus, setSearchQuery]);

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
                filterType !== "all" || filterStatus !== "all"
                  ? "border-primary text-primary bg-primary/5"
                  : ""
              }`}
              aria-label="Abrir filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="text-left pb-3">
              <SheetTitle className="text-base font-bold">Filtrar Agendamentos</SheetTitle>
              <SheetDescription className="text-xs">
                Selecione o tipo de evento e o status desejado.
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

      {/* Desktop Filter Selects */}
      <div className="hidden sm:flex items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
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
          <SelectTrigger className="h-9 w-[160px] rounded-xl text-xs">
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
