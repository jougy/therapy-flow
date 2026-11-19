import React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Phone,
  PhoneOff,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AUTO_LEAD_STAGE_META,
  type AutoLeadAffiliateSummary,
  type AutoLeadFilterState,
  type AutoLeadPhoneFilter,
  type AutoLeadSortField,
  type AutoLeadSortState,
  type AutoLeadStage,
} from "./types";

interface AutoLeadsTableHeaderProps {
  allSelected: boolean;
  onToggleSelectAll: () => void;
  sortState: AutoLeadSortState;
  onSort: (field: AutoLeadSortField) => void;
  affiliates: AutoLeadAffiliateSummary[];
  filters?: AutoLeadFilterState;
  onFilterChange?: (updater: (prev: AutoLeadFilterState) => AutoLeadFilterState) => void;
}

export const AutoLeadsTableHeader: React.FC<AutoLeadsTableHeaderProps> = ({
  allSelected,
  onToggleSelectAll,
  sortState,
  onSort,
  affiliates,
  filters,
  onFilterChange,
}) => {
  const renderSortIndicator = (field: AutoLeadSortField) => {
    if (sortState.field !== field) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50 opacity-60 hover:opacity-100 shrink-0" />
      );
    }
    return sortState.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0 font-bold" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0 font-bold" />
    );
  };

  const isStageAffiliateFiltered = Boolean(
    filters && (filters.stage !== "all" || filters.affiliateId !== "all")
  );

  const isPhoneFiltered = Boolean(
    filters &&
      (filters.phoneFilter === "with_whatsapp" ||
        filters.phoneFilter === "without_whatsapp" ||
        filters.onlyWithPhone)
  );

  return (
    <thead>
      <tr className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground select-none">
        {/* Coluna Checkbox com ordenação */}
        <th className="p-3 w-12">
          <div className="flex items-center gap-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleSelectAll}
              aria-label="Selecionar todos os leads"
            />
            <button
              type="button"
              onClick={() => onSort("selected")}
              title="Ordenar por selecionados"
              aria-label="Ordenar por selecionados"
              className="p-1 rounded-sm hover:bg-muted focus:outline-hidden"
            >
              {renderSortIndicator("selected")}
            </button>
          </div>
        </th>

        {/* Coluna Contato & Canais */}
        <th className="p-3 min-w-[220px]">
          <button
            type="button"
            onClick={() => onSort("name")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors group w-full text-left"
          >
            <span>Contato & Canais</span>
            {renderSortIndicator("name")}
          </button>
        </th>

        {/* Coluna Origem (Grupo FB & Post) */}
        <th className="p-3 min-w-[210px]">
          <button
            type="button"
            onClick={() => onSort("origin")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors group w-full text-left"
          >
            <span>Origem (Grupo FB & Post)</span>
            {renderSortIndicator("origin")}
          </button>
        </th>

        {/* Coluna Score Lindy AI */}
        <th className="p-3 min-w-[120px]">
          <button
            type="button"
            onClick={() => onSort("score")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors group w-full text-left"
          >
            <span>Score Lindy AI</span>
            {renderSortIndicator("score")}
          </button>
        </th>

        {/* Coluna Agenda & Tentativas WhatsApp */}
        <th className="p-3 min-w-[220px]">
          <button
            type="button"
            onClick={() => onSort("agenda")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors group w-full text-left"
          >
            <span>Agenda & Tentativas WhatsApp</span>
            {renderSortIndicator("agenda")}
          </button>
        </th>

        {/* Coluna Estágio & Afiliado com Ordenador + Submenus de Filtro */}
        <th className="p-3 min-w-[180px]">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => onSort("stage_affiliate")}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors group text-left"
            >
              <span>Estágio & Afiliado</span>
              {renderSortIndicator("stage_affiliate")}
            </button>

            {onFilterChange && filters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Filtrar por Estágio e Afiliado"
                    data-testid="stage-affiliate-filter-menu-btn"
                    className={cn(
                      "h-7 w-7 p-0 rounded-md shrink-0",
                      isStageAffiliateFiltered
                        ? "bg-primary/10 text-primary font-bold hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title="Filtrar por Estágio e Afiliado"
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Filtros da Coluna
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Submenu 1: Status / Estágio do Funil */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs flex items-center justify-between py-2 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>Status do Funil</span>
                      </span>
                      {filters.stage !== "all" && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-2">
                          {AUTO_LEAD_STAGE_META[filters.stage]?.label || filters.stage}
                        </Badge>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 text-xs max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup
                        value={filters.stage}
                        onValueChange={(val) =>
                          onFilterChange((prev) => ({
                            ...prev,
                            stage: val as AutoLeadStage | "all",
                          }))
                        }
                      >
                        <DropdownMenuRadioItem value="all" className="text-xs cursor-pointer">
                          Todos os Estágios
                        </DropdownMenuRadioItem>
                        {Object.entries(AUTO_LEAD_STAGE_META).map(([key, meta]) => (
                          <DropdownMenuRadioItem
                            key={key}
                            value={key}
                            className="text-xs cursor-pointer flex items-center justify-between"
                          >
                            <span>{meta.label}</span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Submenu 2: Afiliados / Parceiros */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs flex items-center justify-between py-2 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>Afiliados / Parceiros</span>
                      </span>
                      {filters.affiliateId !== "all" && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-2">
                          {filters.affiliateId === "unassigned"
                            ? "Sem afiliado"
                            : affiliates.find((a) => a.id === filters.affiliateId)?.full_name || "1"}
                        </Badge>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-60 text-xs max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup
                        value={filters.affiliateId}
                        onValueChange={(val) =>
                          onFilterChange((prev) => ({
                            ...prev,
                            affiliateId: val,
                          }))
                        }
                      >
                        <DropdownMenuRadioItem value="all" className="text-xs cursor-pointer">
                          Todos os Afiliados
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="unassigned" className="text-xs cursor-pointer">
                          Sem afiliado (Backoffice)
                        </DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        {affiliates.map((aff) => (
                          <DropdownMenuRadioItem
                            key={aff.id}
                            value={aff.id}
                            className="text-xs cursor-pointer truncate"
                          >
                            {aff.full_name} {aff.coupon_code ? `(${aff.coupon_code})` : ""}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {isStageAffiliateFiltered && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          onFilterChange((prev) => ({
                            ...prev,
                            stage: "all",
                            affiliateId: "all",
                          }))
                        }
                        className="text-xs text-rose-600 focus:text-rose-700 cursor-pointer"
                      >
                        Limpar Filtros da Coluna
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </th>

        {/* Coluna Ações 1-Click com Ordenador + Filtro Hide/Show WhatsApp */}
        <th className="p-3 text-right min-w-[160px]">
          <div className="flex items-center justify-end gap-1.5">
            {onFilterChange && filters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Filtrar por Presença de WhatsApp"
                    data-testid="whatsapp-filter-menu-btn"
                    className={cn(
                      "h-7 px-2 text-[11px] gap-1 rounded-md shrink-0",
                      isPhoneFiltered
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title="Filtrar por Presença de WhatsApp"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>
                      {filters.phoneFilter === "with_whatsapp"
                        ? "Com WhatsApp"
                        : filters.phoneFilter === "without_whatsapp"
                          ? "Sem WhatsApp"
                          : "Filtro"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 text-xs">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Exibição de Contatos
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={filters.phoneFilter || (filters.onlyWithPhone ? "with_whatsapp" : "all")}
                    onValueChange={(val) =>
                      onFilterChange((prev) => ({
                        ...prev,
                        phoneFilter: val as AutoLeadPhoneFilter,
                        onlyWithPhone: val === "with_whatsapp",
                      }))
                    }
                  >
                    <DropdownMenuRadioItem value="all" className="text-xs cursor-pointer">
                      Todos os Contatos
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="with_whatsapp"
                      className="text-xs cursor-pointer flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Phone className="h-3.5 w-3.5" />
                        <span>Somente com WhatsApp</span>
                      </span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="without_whatsapp"
                      className="text-xs cursor-pointer flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <PhoneOff className="h-3.5 w-3.5" />
                        <span>Somente sem WhatsApp</span>
                      </span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              type="button"
              onClick={() => onSort("has_whatsapp")}
              className="flex items-center gap-1 hover:text-foreground transition-colors group"
              title="Ordenar por presença de WhatsApp"
            >
              <span>Ações 1-Click</span>
              {renderSortIndicator("has_whatsapp")}
            </button>
          </div>
        </th>
      </tr>
    </thead>
  );
};
