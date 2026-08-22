import { memo } from "react";
import { Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HomePatientGroupRecord } from "@/lib/home-patients-view";

const SESSION_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "concluído", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

interface HomeSessionsBulkActionBarProps {
  selectedSessionIds: string[];
  patientGroups: HomePatientGroupRecord[];
  bulkUpdating: boolean;
  onBulkMove: (groupId: string) => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export const HomeSessionsBulkActionBar = memo(function HomeSessionsBulkActionBar({
  selectedSessionIds,
  patientGroups,
  bulkUpdating,
  onBulkMove,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection,
}: HomeSessionsBulkActionBarProps) {
  if (selectedSessionIds.length === 0) return null;

  const uniqueGroups = Array.from(new Map(patientGroups.map((g) => [g.name, g])).values());

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-t bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:-mx-6 sm:px-6">
      <Badge variant="secondary">{selectedSessionIds.length} atendimento(s) selecionado(s)</Badge>

      <Select onValueChange={onBulkMove} disabled={bulkUpdating || selectedSessionIds.length === 0}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Mover para grupo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum grupo</SelectItem>
          {uniqueGroups.map((group) => (
            <SelectItem key={group.id} value={group.id ?? "none"}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={onBulkStatusUpdate} disabled={bulkUpdating || selectedSessionIds.length === 0}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Alterar status" />
        </SelectTrigger>
        <SelectContent>
          {SESSION_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-8 text-xs"
        onClick={onBulkDelete}
        disabled={bulkUpdating || selectedSessionIds.length === 0}
      >
        <Trash2 className="mr-1.5 h-3 w-3" />
        Excluir
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={onClearSelection}
        disabled={bulkUpdating}
      >
        <X className="mr-1.5 h-3 w-3" />
        Cancelar
      </Button>
    </div>
  );
});
