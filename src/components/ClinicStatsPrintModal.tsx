import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer, CheckSquare, Square, Sparkles } from "lucide-react";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";

export type StatsBlockId =
  | "payment_chart"
  | "agenda_chart"
  | "payment_status_chart"
  | "patient_status_chart"
  | "payment_method_chart"
  | "packages_summary"
  | "packages_list"
  | "metrics_cards"
  | "revenue_area_chart"
  | "last30days_chart"
  | "weekday_chart"
  | "groups_list"
  | "collaborators_chart"
  | "executive_summary";

export interface StatsBlockDefinition {
  id: StatsBlockId;
  title: string;
  category: "finance" | "overview" | "agenda" | "patients" | "team" | "packages";
  description: string;
}

export const STATS_BLOCKS: StatsBlockDefinition[] = [
  { id: "payment_chart", title: "Receita Registrada", category: "finance", description: "Valores pagos, créditos e valores em aberto." },
  { id: "agenda_chart", title: "Agenda de Atendimentos", category: "agenda", description: "Resumo de agendamentos ativos, confirmados e pendentes." },
  { id: "payment_status_chart", title: "Status de Pagamento", category: "finance", description: "Distribuição dos atendimentos por situação financeira." },
  { id: "patient_status_chart", title: "Pacientes por Status", category: "patients", description: "Proporção de pacientes ativos, pausados e inativos." },
  { id: "payment_method_chart", title: "Método de Pagamento", category: "finance", description: "Formas de pagamento utilizadas pelos pacientes." },
  { id: "packages_summary", title: "Resumo de Pacotes de Sessões", category: "packages", description: "Total de pacotes fechados, em andamento, concluídos e saldo financeiro." },
  { id: "packages_list", title: "Listagem Detalhada de Pacotes", category: "packages", description: "Andamento individual e sessões restantes de cada pacote." },
  { id: "metrics_cards", title: "Cards de Métricas Gerais", category: "overview", description: "Volume total, quitados, taxa de cancelamento e quantidades por período." },
  { id: "revenue_area_chart", title: "Receita e Atendimentos no Ano", category: "finance", description: "Gráfico de área com evolução mensal da receita e volume." },
  { id: "last30days_chart", title: "Atendimentos nos Últimos 30 Dias", category: "overview", description: "Oscilação do volume diário de atendimentos prestados." },
  { id: "weekday_chart", title: "Distribuição por Dia da Semana", category: "agenda", description: "Concentração da demanda ao longo dos dias da semana." },
  { id: "groups_list", title: "Sintomas Mais Recorrentes", category: "patients", description: "Top sintomas e linhas de cuidado mais frequentes nos atendimentos." },
  { id: "collaborators_chart", title: "Produtividade por Colaborador", category: "team", description: "Volume de atendimentos e receita por profissional." },
  { id: "executive_summary", title: "Leitura Executiva", category: "overview", description: "Ticket médio, média diária e indicadores chave." },
];

const categoryLabels: Record<StatsBlockDefinition["category"], string> = {
  finance: "Financeiro",
  packages: "Pacotes",
  overview: "Visão Geral",
  agenda: "Agenda",
  patients: "Pacientes",
  team: "Equipe",
};

interface ClinicStatsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: (selectedBlockIds: StatsBlockId[]) => void;
}

export function ClinicStatsPrintModal({
  isOpen,
  onClose,
  onConfirmPrint,
}: ClinicStatsPrintModalProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<Record<StatsBlockId, boolean>>(() =>
    Object.fromEntries(STATS_BLOCKS.map((b) => [b.id, true])) as Record<StatsBlockId, boolean>
  );
  const [showResponsibilityModal, setShowResponsibilityModal] = useState(false);

  const selectedCount = Object.values(selectedBlocks).filter(Boolean).length;
  const isAllSelected = selectedCount === STATS_BLOCKS.length;

  const handleToggleAll = () => {
    const nextState = !isAllSelected;
    setSelectedBlocks(
      Object.fromEntries(STATS_BLOCKS.map((b) => [b.id, nextState])) as Record<StatsBlockId, boolean>
    );
  };

  const handleToggleBlock = (id: StatsBlockId) => {
    setSelectedBlocks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProceedToTerms = () => {
    if (selectedCount === 0) return;
    setShowResponsibilityModal(true);
  };

  const handleAcceptTermsAndPrint = () => {
    const chosenIds = STATS_BLOCKS.filter((b) => selectedBlocks[b.id]).map((b) => b.id);
    setShowResponsibilityModal(false);
    onConfirmPrint(chosenIds);
  };

  return (
    <>
      <Dialog open={isOpen && !showResponsibilityModal} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              Opções de Impressão das Estatísticas
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecione quais blocos e gráficos farão parte do documento gerado para impressão ou exportação PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {selectedCount} de {STATS_BLOCKS.length} blocos selecionados
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleAll}
              className="h-8 text-xs gap-1.5 text-primary hover:text-primary"
            >
              {isAllSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
              {isAllSelected ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </div>

          <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STATS_BLOCKS.map((block) => {
              const isChecked = !!selectedBlocks[block.id];

              return (
                <div
                  key={block.id}
                  onClick={() => handleToggleBlock(block.id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/30 opacity-70"
                  }`}
                >
                  <Checkbox
                    id={`block-${block.id}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggleBlock(block.id)}
                    className="mt-0.5 pointer-events-none"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`block-${block.id}`} className="font-semibold text-xs text-foreground cursor-pointer truncate">
                        {block.title}
                      </Label>
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                        {categoryLabels[block.category]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                      {block.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-muted/10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleProceedToTerms}
              disabled={selectedCount === 0}
              className="bg-primary text-primary-foreground font-medium px-5 gap-2 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" />
              Continuar para Impressão ({selectedCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintResponsibilityModal
        isOpen={showResponsibilityModal}
        documentTitle="Estatísticas Completas da Clínica"
        onConfirm={handleAcceptTermsAndPrint}
        onCancel={() => {
          setShowResponsibilityModal(false);
        }}
      />
    </>
  );
}

export default ClinicStatsPrintModal;
