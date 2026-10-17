import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { SESSION_STATUSES } from "./pacienteDetalheHelpers";
import type { PatientGroup } from "./pacienteDetalheTypes";
import type { ModularFilterItem } from "@/lib/patient-sessions-view";

export interface MobileFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionStatusFilter: string;
  onSessionStatusFilterChange: (value: string) => void;
  selectedTagFilter: string;
  onSelectedTagFilterChange: (value: string) => void;
  groups: PatientGroup[];
  filterableModularItems: ModularFilterItem[];
  groupByEvolution: boolean;
  onToggleGroupByEvolution: (checked: boolean) => void;
  groupByMode: string;
  onGroupByModeChange: (value: string) => void;
  groupableModularFields: Array<{ id: string; label: string }>;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  open,
  onOpenChange,
  sessionStatusFilter,
  onSessionStatusFilterChange,
  selectedTagFilter,
  onSelectedTagFilterChange,
  groups,
  filterableModularItems,
  groupByEvolution,
  onToggleGroupByEvolution,
  groupByMode,
  onGroupByModeChange,
  groupableModularFields,
}) => {
  const hasActiveFilters = sessionStatusFilter !== "all" || selectedTagFilter !== "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl relative"
          aria-label="Abrir filtros de atendimentos"
          title="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-5 py-6">
        <SheetHeader className="text-left pb-4 border-b">
          <SheetTitle className="text-lg font-bold">Filtros de Atendimento</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Refine o histórico de sessões do paciente
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status do atendimento</Label>
            <Select value={sessionStatusFilter} onValueChange={onSessionStatusFilterChange}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {SESSION_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Sintoma / Tag</Label>
            <Select value={selectedTagFilter} onValueChange={onSelectedTagFilterChange}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sintomas / tags</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">Sintomas não definidos</SelectItem>
                {filterableModularItems.length > 0 && (
                  <>
                    {filterableModularItems.map((item) => (
                      <SelectItem key={item.filterKey} value={item.filterKey}>
                        {item.fieldLabel}: {item.value}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Agrupamento
            </Label>
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
              <Label htmlFor="mobile-group-by-toggle" className="text-sm font-medium cursor-pointer">
                Visualizar grupos
              </Label>
              <Switch
                id="mobile-group-by-toggle"
                checked={groupByEvolution}
                onCheckedChange={onToggleGroupByEvolution}
              />
            </div>
            {groupByEvolution && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Modo de agrupamento:</Label>
                <Select value={groupByMode} onValueChange={onGroupByModeChange}>
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution">Evolução</SelectItem>
                    {groupableModularFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-11"
            onClick={() => {
              onSessionStatusFilterChange("all");
              onSelectedTagFilterChange("all");
            }}
          >
            Limpar
          </Button>
          <Button className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
