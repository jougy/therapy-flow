import type { FC } from "react";
import { CheckCircle2, ClipboardList, Search, Share2, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";
import { MobileFilterDrawer } from "../MobileFilterDrawer";
import { SESSION_STATUSES } from "../pacienteDetalheHelpers";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientSessionsToolbar: FC = () => {
  const ws = usePatientWorkspace();

  return (
    <div className="space-y-4">
      {/* Mobile Search & Filter Drawer */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ws.searchTerm}
            onChange={(event) => ws.setSearchTerm(event.target.value)}
            placeholder="Buscar no prontuário..."
            className="pl-9 h-10 rounded-xl bg-card border text-sm"
          />
        </div>
        <MobileFilterDrawer
          open={ws.mobileFilterDrawerOpen}
          onOpenChange={ws.setMobileFilterDrawerOpen}
          sessionStatusFilter={ws.sessionStatusFilter}
          onSessionStatusFilterChange={ws.setSessionStatusFilter}
          selectedTagFilter={ws.selectedTagFilter}
          onSelectedTagFilterChange={ws.setSelectedTagFilter}
          groups={ws.groups}
          filterableModularItems={ws.filterableModularItems}
          groupByEvolution={ws.groupByEvolution}
          onToggleGroupByEvolution={ws.handleToggleGroupByEvolution}
          groupByMode={ws.groupByMode}
          onGroupByModeChange={ws.setGroupByMode}
          groupableModularFields={ws.groupableModularFields}
        />
      </div>

      {/* Desktop Filter Bar */}
      <Card className="hidden md:block">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr),180px,200px,auto] items-end">
          <div className="space-y-2">
            <Label htmlFor="sessions-search">Buscar no prontuário</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sessions-search"
                value={ws.searchTerm}
                onChange={(event) => ws.setSearchTerm(event.target.value)}
                placeholder="Ex: lombar, conduta, 18/03/2026"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status do atendimento</Label>
            <Select value={ws.sessionStatusFilter} onValueChange={ws.setSessionStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {SESSION_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Filtrar por Sintoma / Tag</Label>
            <Select value={ws.selectedTagFilter} onValueChange={ws.setSelectedTagFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sintomas / tags</SelectItem>
                {ws.groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
                <SelectItem value="none">Sintomas não definidos</SelectItem>
                {ws.filterableModularItems.map((item) => (
                  <SelectItem key={item.filterKey} value={item.filterKey}>
                    {item.fieldLabel}: {item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground block">Agrupamento</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-background/50">
                <Switch
                  id="group-by-evolution-toggle"
                  checked={ws.groupByEvolution}
                  onCheckedChange={ws.handleToggleGroupByEvolution}
                />
                <Label htmlFor="group-by-evolution-toggle" className="text-xs font-medium cursor-pointer select-none whitespace-nowrap">
                  Visualizar grupos
                </Label>
              </div>
              {ws.groupByEvolution && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Agrupar por:</span>
                  <Select value={ws.groupByMode} onValueChange={ws.setGroupByMode}>
                    <SelectTrigger className="h-10 min-w-[170px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evolution">Evolução</SelectItem>
                      {ws.groupableModularFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Selection Bar */}
      {ws.canBulkManageSessions && ws.selectionMode && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Badge variant="secondary">{ws.selectedSessionIds.length} atendimento(s) selecionado(s)</Badge>
            <Button
              variant="default"
              size="sm"
              onClick={() => void ws.handleBulkStatusUpdate("concluído")}
              disabled={ws.bulkUpdating || ws.selectedSessionIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir Selecionados
            </Button>
            <Select onValueChange={(v) => void ws.handleBulkLinkEvolutionGroup(v)} disabled={ws.bulkUpdating || ws.selectedSessionIds.length === 0}>
              <SelectTrigger className="w-[230px] bg-background"><SelectValue placeholder="Vincular a Grupo de Evolução" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Remover de Grupo (Tornar Avulso)</SelectItem>
                <SelectItem value="__new__">+ Criar Novo Grupo de Evolução</SelectItem>
                {ws.evolutionGroupsMetadata.map((group) => {
                  const matched = ws.sessionView.evolutionGroups.find((g) => g.id === group.id);
                  const label = group.custom_name || matched?.tagGroups.map((g) => g.name).join(" · ") || `Ciclo (${group.id.slice(0, 6)})`;
                  return <SelectItem key={group.id} value={group.id}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => void ws.handleBulkMove(v)} disabled={ws.bulkUpdating || ws.selectedSessionIds.length === 0}>
              <SelectTrigger className="w-[230px] bg-background"><SelectValue placeholder="Vincular a Sintoma / Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sintomas não definidos</SelectItem>
                {Array.from(new Map(ws.groups.map((g) => [g.name, g])).values()).map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => void ws.handleBulkStatusUpdate(v)} disabled={ws.bulkUpdating || ws.selectedSessionIds.length === 0}>
              <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Alterar status" /></SelectTrigger>
              <SelectContent>
                {SESSION_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={ws.handleOpenSessionShareDialog} disabled={ws.bulkUpdating || !ws.canShareSelection}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar com colaboradores
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void ws.handleBulkDelete()} disabled={ws.bulkUpdating || !ws.canDeleteSelection}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir atendimentos
            </Button>
            <Button variant="ghost" size="sm" onClick={ws.handleExitSelectionMode} disabled={ws.bulkUpdating}>
              <X className="h-4 w-4 mr-2" />
              Cancelar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header + View Mode Toggle + Tag Pills */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Histórico de Atendimentos
                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                  {ws.sessionView.totalCount}
                </Badge>
              </h2>
              <ComponentHelpButton helpId="patient-tab-sessions" size="xs" />
            </div>
            <p className="text-xs text-muted-foreground">Linha do tempo cronológica com ciclos de evolução e filtros rápidos</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border self-start sm:self-auto">
            <Button
              type="button"
              variant={ws.sessionViewMode === "detailed" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1.5 font-medium shadow-none"
              onClick={() => ws.handleSetSessionViewMode("detailed")}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Detalhado</span>
            </Button>
            <Button
              type="button"
              variant={ws.sessionViewMode === "compact" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1.5 font-medium shadow-none"
              onClick={() => ws.handleSetSessionViewMode("compact")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Compacto</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
          <Button
            type="button"
            size="sm"
            variant={ws.selectedTagFilter === "all" ? "default" : "outline"}
            onClick={() => ws.setSelectedTagFilter("all")}
            className="text-xs h-7 px-3 rounded-full shrink-0 font-medium"
          >
            Todos ({ws.sessionView.totalCount})
          </Button>
          {ws.sessionView.tagStats.map(({ group, count }) => {
            const isSelected = ws.selectedTagFilter === group.id;
            const groupHex = getLegacyGroupHex(group.color);
            return (
              <Button
                key={group.id}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => ws.setSelectedTagFilter(isSelected ? "all" : group.id)}
                className={`text-xs h-7 px-3 rounded-full shrink-0 gap-1.5 transition-all ${isSelected ? "shadow-sm font-semibold ring-1 ring-primary/40" : "text-foreground hover:bg-accent/40"}`}
                style={isSelected ? { borderColor: groupHex, backgroundColor: groupHex, color: getReadableTextColor(groupHex) } : undefined}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupHex }} />
                {group.name}
                <span className={`text-[10px] ml-0.5 opacity-80 ${isSelected ? "" : "text-muted-foreground"}`}>({count})</span>
              </Button>
            );
          })}
          {ws.sessionView.ungroupedCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant={ws.selectedTagFilter === "none" ? "default" : "outline"}
              onClick={() => ws.setSelectedTagFilter(ws.selectedTagFilter === "none" ? "all" : "none")}
              className="text-xs h-7 px-3 rounded-full shrink-0 text-muted-foreground"
            >
              Sintomas não definidos ({ws.sessionView.ungroupedCount})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
