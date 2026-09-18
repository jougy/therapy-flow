import {
  Calendar,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import {
  calculateNextSundayCountdown,
  formatTrashDate,
  getTrashRoutePath,
  navigateToClinicTrash,
  createTrashToastAction,
  type SundayCountdownResult,
  type TrashEntityType,
  type TrashItem,
} from "@/lib/trashUtils";
import { useClinicTrash } from "./trash/useClinicTrash";
import { TrashCountdownBanner } from "./trash/TrashCountdownBanner";
import { TrashEmptyState } from "./trash/TrashEmptyState";
import { TrashTable } from "./trash/TrashTable";

// Re-exporta utilitários e tipos para manter compatibilidade estrita com toda a aplicação e testes
export {
  calculateNextSundayCountdown,
  createTrashToastAction,
  formatTrashDate,
  getTrashRoutePath,
  navigateToClinicTrash,
  type SundayCountdownResult,
  type TrashEntityType,
  type TrashItem,
};

export const ClinicTrashSection = () => {
  const {
    activeTab,
    canManageTrash,
    countdown,
    currentPage,
    filteredItems,
    formCount,
    handleRestoreBulk,
    handleRestoreSingle,
    handleToggleSelectAll,
    handleToggleSelectOne,
    isAllSelected,
    isBulkRestoring,
    isSomeSelected,
    loading,
    pageSize,
    paginatedItems,
    patientCount,
    restoringIds,
    restoringSet,
    searchQuery,
    selectedIds,
    selectedSet,
    sessionCount,
    setActiveTab,
    setCurrentPage,
    setSearchQuery,
    totalPages,
  } = useClinicTrash();

  return (
    <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] pb-12">
      {/* Header Principal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Lixeira da Clínica</CardTitle>
              <CardDescription className="text-xs">
                Itens removidos recentemente com restauração em 1 clique antes do expurgo automático semanal.
              </CardDescription>
            </div>
          </div>
          <ComponentHelpButton helpId="settings-trash-block" size="sm" />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Banner Institucional de Ciclo de Vida e Contagem Regressiva */}
          <TrashCountdownBanner countdown={countdown} />

          {/* Abas e Controles */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as TrashEntityType)}
            className="w-full space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="grid grid-cols-3 w-full sm:w-[380px]">
                <TabsTrigger value="sessions" className="flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Atendimentos</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {sessionCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="patients" className="flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  <span>Pacientes</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {patientCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="forms" className="flex items-center gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Formulários</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {formCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Ações em lote e busca rápida */}
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRestoreBulk()}
                    disabled={isBulkRestoring || !canManageTrash}
                    className="flex items-center gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                  >
                    {isBulkRestoring ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span>Restaurar selecionados ({selectedIds.length})</span>
                  </Button>
                )}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar na lixeira..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
              </div>
            </div>

            {/* Conteúdo das Abas */}
            {(["sessions", "patients", "forms"] as const).map((tabKey) => {
              const isActive = activeTab === tabKey;
              const tabItems = isActive ? paginatedItems : [];

              return (
                <TabsContent key={tabKey} value={tabKey} className="m-0 space-y-2">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-xs">Consultando lixeira da clínica...</p>
                    </div>
                  ) : isActive && filteredItems.length === 0 ? (
                    <TrashEmptyState entityType={tabKey} />
                  ) : (
                    <TrashTable
                      items={tabItems}
                      selectedIds={selectedIds}
                      restoringIds={restoringIds}
                      selectedSet={selectedSet}
                      restoringSet={restoringSet}
                      canManageTrash={canManageTrash}
                      isAllSelected={isAllSelected}
                      isSomeSelected={isSomeSelected}
                      onToggleSelectAll={handleToggleSelectAll}
                      onToggleSelectOne={handleToggleSelectOne}
                      onRestoreSingle={handleRestoreSingle}
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalCount={filteredItems.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
