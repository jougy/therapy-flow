import { memo } from "react";
import { Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HomePatientGroupRecord } from "@/lib/home-patients-view";
import { EDITABLE_PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";

interface HomePatientsBulkActionBarProps {
  selectedPatientIds: string[];
  patientGroups: HomePatientGroupRecord[];
  bulkUpdating: boolean;
  canDelete?: boolean;
  onBulkMoveGroup: (groupId: string) => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export const HomePatientsBulkActionBar = memo(function HomePatientsBulkActionBar({
  selectedPatientIds,
  patientGroups,
  bulkUpdating,
  canDelete = false,
  onBulkMoveGroup,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection,
}: HomePatientsBulkActionBarProps) {
  if (selectedPatientIds.length === 0) return null;

  const uniqueGroups = Array.from(new Map(patientGroups.map((g) => [g.name, g])).values());

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-t bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:-mx-6 sm:px-6">
      <Badge variant="secondary">
        {selectedPatientIds.length} paciente{selectedPatientIds.length !== 1 ? "s" : ""} selecionado
        {selectedPatientIds.length !== 1 ? "s" : ""}
      </Badge>

      {/* Alterar Status em Lote */}
      <Select onValueChange={onBulkStatusUpdate} disabled={bulkUpdating || selectedPatientIds.length === 0}>
        <SelectTrigger className="h-8 w-[145px] text-xs">
          <SelectValue placeholder="Alterar status" />
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_PATIENT_STATUS_OPTIONS.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mover / Associar Grupo em Lote */}
      <Select onValueChange={onBulkMoveGroup} disabled={bulkUpdating || selectedPatientIds.length === 0}>
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

      {/* Excluir / Mover para lixeira em Lote */}
      {canDelete && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
          onClick={onBulkDelete}
          disabled={bulkUpdating || selectedPatientIds.length === 0}
        >
          <Trash2 className="mr-1.5 h-3 w-3" />
          Excluir
        </Button>
      )}

      {/* Cancelar Seleção */}
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
