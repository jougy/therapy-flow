import { Loader2, Plus, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { getLegacyGroupHex } from "@/lib/group-colors";
import type { PatientGroup, PatientGroupStatus, GroupSuggestion } from "./pacienteDetalheTypes";
import { GROUP_STATUSES, normalizeGroupName } from "./pacienteDetalheHelpers";

export interface CareLineGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: PatientGroup | null;
  groupName: string;
  onGroupNameChange: (name: string) => void;
  groupComboboxOpen: boolean;
  onGroupComboboxOpenChange: (open: boolean) => void;
  groupSuggestions: GroupSuggestion[];
  patientGroupNameSet: Set<string>;
  existingPatientGroup?: boolean | PatientGroup | null;
  existingSuggestion?: boolean | GroupSuggestion | null;
  onCreateTypedGroupName: () => void;
  onSelectGroupSuggestion: (suggestion: GroupSuggestion) => void;
  groupStatus: PatientGroupStatus;
  onGroupStatusChange: (status: PatientGroupStatus) => void;
  groupColor: string;
  groupColorSlotId: string | null;
  resolvedClinicColorSlots: ClinicGroupColorSlot[];
  onSaveClinicColorSlot: (slot: ClinicGroupColorSlot) => Promise<void> | void;
  onSelectSlot: (slot: ClinicGroupColorSlot) => void;
  savingGroup: boolean;
  onSaveGroup: () => void;
}

export function CareLineGroupDialog({
  open,
  onOpenChange,
  editingGroup,
  groupName,
  onGroupNameChange,
  groupComboboxOpen,
  onGroupComboboxOpenChange,
  groupSuggestions,
  patientGroupNameSet,
  existingPatientGroup,
  existingSuggestion,
  onCreateTypedGroupName,
  onSelectGroupSuggestion,
  groupStatus,
  onGroupStatusChange,
  groupColor,
  groupColorSlotId,
  resolvedClinicColorSlots,
  onSaveClinicColorSlot,
  onSelectSlot,
  savingGroup,
  onSaveGroup,
}: CareLineGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{editingGroup ? "Editar Linha de Cuidado" : "Nova Linha de Cuidado"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da Linha de Cuidado / Motivo</Label>
            <Popover open={groupComboboxOpen} onOpenChange={onGroupComboboxOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={groupComboboxOpen}
                  className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
                >
                  <span className={groupName ? "truncate" : "truncate text-muted-foreground"}>
                    {groupName || "Selecione uma linha de cuidado ou digite para criar"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    value={groupName}
                    onValueChange={onGroupNameChange}
                    placeholder="Buscar ou criar linha de cuidado..."
                  />
                  <CommandList>
                    {groupName.trim() && !existingSuggestion && !existingPatientGroup ? (
                      <CommandGroup heading="Criar novo">
                        <CommandItem value={groupName} onSelect={onCreateTypedGroupName}>
                          <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>Criar</span>
                          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                            {groupName.trim().replace(/\s+/g, " ")}
                          </span>
                        </CommandItem>
                      </CommandGroup>
                    ) : null}
                    <CommandEmpty>Nenhuma linha de cuidado encontrada.</CommandEmpty>
                    <CommandGroup heading="Linhas de cuidado frequentes">
                      {groupSuggestions.map((suggestion) => {
                        const alreadyInPatient = patientGroupNameSet.has(normalizeGroupName(suggestion.name));

                        return (
                          <CommandItem
                            key={normalizeGroupName(suggestion.name)}
                            disabled={alreadyInPatient}
                            value={suggestion.name}
                            onSelect={() => onSelectGroupSuggestion(suggestion)}
                          >
                            <span
                              className="mr-2 h-3 w-3 rounded-full"
                              style={{ backgroundColor: getLegacyGroupHex(suggestion.color) }}
                            />
                            <span className="truncate">{suggestion.name}</span>
                            <Badge variant={alreadyInPatient ? "outline" : "secondary"} className="ml-auto">
                              {alreadyInPatient ? "Já neste paciente" : "Reutilizar"}
                            </Badge>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {existingPatientGroup ? (
              <p className="text-xs text-destructive">Este paciente já possui uma linha de cuidado com esse nome.</p>
            ) : existingSuggestion && !editingGroup ? (
              <p className="text-xs text-muted-foreground">
                Este nome já existe na clínica. Ao criar, ele será reutilizado neste paciente com a cor e status selecionados.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Digite para buscar linhas de cuidado existentes ou criar uma nova opção reutilizável.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Status da linha de cuidado</Label>
            <Select value={groupStatus} onValueChange={(value) => onGroupStatusChange(value as PatientGroupStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <GroupColorPaletteField
              defaultOpen={false}
              onPaletteSave={onSaveClinicColorSlot}
              onSelectSlot={onSelectSlot}
              previewColorHex={groupColor}
              selectedSlotId={groupColorSlotId}
              slots={resolvedClinicColorSlots}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={onSaveGroup} disabled={!groupName.trim() || Boolean(existingPatientGroup) || savingGroup}>
            {savingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingGroup ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
