import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { CARE_LINE_PRESETS } from "@/lib/care-lines-classifier";
import { getLegacyGroupHex, getReadableTextColor, normalizeGroupName, sanitizeColorSlotId } from "@/lib/group-colors";
import { ChevronsUpDown, Lightbulb, Loader2, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import type { ClinicColorSlotRow, GroupSuggestion, PatientGroup, PatientGroupStatus } from "./types";
import { GROUP_STATUSES } from "./types";

export interface SessionCareLinesPickerProps {
  careLineIds: string[];
  clinicColorSlots: ClinicColorSlotRow[];
  groups: PatientGroup[];
  groupSuggestions: GroupSuggestion[];
  locked: boolean;
  resolvedClinicColorSlots: ClinicGroupColorSlot[];
  onCareLineIdsChange: (ids: string[]) => void;
  onGroupIdChange: (id: string | null) => void;
  onSelectCareLinePreset: (presetName: string) => Promise<void>;
  onSaveNewCareLine: (name: string, color: string, colorSlotId: string | null, status: PatientGroupStatus) => Promise<void>;
  onSaveClinicColorSlot: (slotIndex: number, colorHex: string, alpha: number) => Promise<void>;
}

export const SessionCareLinesPicker = ({
  careLineIds,
  groups,
  groupSuggestions,
  locked,
  resolvedClinicColorSlots,
  onCareLineIdsChange,
  onGroupIdChange,
  onSelectCareLinePreset,
  onSaveNewCareLine,
  onSaveClinicColorSlot,
}: SessionCareLinesPickerProps) => {
  const [careLineDialogOpen, setCareLineDialogOpen] = useState(false);
  const [newCareLineName, setNewCareLineName] = useState("");
  const [newCareLineColor, setNewCareLineColor] = useState("#C4B5FD");
  const [newCareLineColorSlotId, setNewCareLineColorSlotId] = useState<string | null>(null);
  const [newCareLineStatus, setNewCareLineStatus] = useState<PatientGroupStatus>("em_andamento");
  const [savingCareLine, setSavingCareLine] = useState(false);
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false);

  const patientGroupNameSet = useMemo(
    () => new Set(groups.map((group) => normalizeGroupName(group.name))),
    [groups]
  );

  const existingPatientGroup = useMemo(
    () => groups.find((group) => normalizeGroupName(group.name) === normalizeGroupName(newCareLineName)),
    [groups, newCareLineName]
  );

  const existingSuggestion = useMemo(
    () =>
      groupSuggestions.find(
        (suggestion) => normalizeGroupName(suggestion.name) === normalizeGroupName(newCareLineName)
      ),
    [groupSuggestions, newCareLineName]
  );

  const getSlotById = (slotId: string | null) =>
    resolvedClinicColorSlots.find((slot) => slot.id === slotId) ?? null;

  const handleSelectGroupSuggestion = (suggestion: GroupSuggestion) => {
    const slot = getSlotById(suggestion.clinic_color_slot_id);
    const chosenColor = slot?.color_hex || (suggestion.color ? getLegacyGroupHex(suggestion.color) : newCareLineColor);
    setNewCareLineName(suggestion.name);
    setNewCareLineColor(chosenColor);
    setNewCareLineColorSlotId(sanitizeColorSlotId(slot?.id ?? suggestion.clinic_color_slot_id));
    setNewCareLineStatus((suggestion.status as PatientGroupStatus) || "em_andamento");
    setGroupComboboxOpen(false);
  };

  const handleCreateTypedGroupName = () => {
    if (!newCareLineName.trim()) return;
    setGroupComboboxOpen(false);
  };

  const handleSaveModal = async () => {
    setSavingCareLine(true);
    try {
      await onSaveNewCareLine(newCareLineName, newCareLineColor, newCareLineColorSlotId, newCareLineStatus);
      setCareLineDialogOpen(false);
    } finally {
      setSavingCareLine(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            1. Sintomas & Linhas de Cuidado / Motivos do Atendimento
          </span>
          <ComponentHelpButton helpId="session-carelines" size="xs" />
          {careLineIds.length === 0 ? (
            <Badge variant="outline" className="text-xs font-medium bg-muted text-muted-foreground">
              Geral / Sintomas não definidos
            </Badge>
          ) : (
            careLineIds.map((id) => {
              const g = groups.find((group) => group.id === id);
              if (!g) return null;
              return (
                <Badge
                  key={g.id}
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5"
                  style={{
                    borderColor: getLegacyGroupHex(g.color),
                    backgroundColor: `${getLegacyGroupHex(g.color)}20`,
                    color: getReadableTextColor(getLegacyGroupHex(g.color)) === "#111827" ? "#111827" : undefined,
                  }}
                >
                  {g.name}
                </Badge>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Selecione 1 ou mais sintomas/motivos para organizar o histórico clínico deste atendimento</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant={careLineIds.length === 0 ? "default" : "outline"}
          onClick={() => {
            onCareLineIdsChange([]);
            onGroupIdChange(null);
          }}
          className="text-xs h-7 px-3 rounded-full"
          disabled={locked}
        >
          Geral / Sintomas não definidos
        </Button>
        {groups.map((g) => {
          const isSelected = careLineIds.includes(g.id);
          return (
            <Button
              key={g.id}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={() => {
                const next = isSelected ? careLineIds.filter((id) => id !== g.id) : [...careLineIds, g.id];
                onCareLineIdsChange(next);
                onGroupIdChange(next[0] ?? null);
              }}
              className={`text-xs h-7 px-3 rounded-full gap-1.5 transition-all ${
                isSelected
                  ? "shadow-sm font-semibold ring-1 ring-primary/40"
                  : "text-foreground hover:bg-accent/40"
              }`}
              style={
                isSelected
                  ? {
                      borderColor: getLegacyGroupHex(g.color),
                      backgroundColor: getLegacyGroupHex(g.color),
                      color: getReadableTextColor(getLegacyGroupHex(g.color)),
                    }
                  : undefined
              }
              disabled={locked}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: isSelected ? "currentColor" : getLegacyGroupHex(g.color) }}
              />
              {g.name}
            </Button>
          );
        })}
        {CARE_LINE_PRESETS.filter(
          (p) => !groups.some((g) => normalizeGroupName(g.name) === normalizeGroupName(p.name))
        ).map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onSelectCareLinePreset(preset.name)}
            className="text-xs h-7 px-3 rounded-full border-dashed text-muted-foreground hover:text-foreground"
            disabled={locked}
          >
            + {preset.label}
          </Button>
        ))}

        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => {
            setNewCareLineName("");
            const availableSlots = resolvedClinicColorSlots.length > 0 ? resolvedClinicColorSlots : [];
            const randomSlot =
              availableSlots.length > 0 ? availableSlots[Math.floor(Math.random() * availableSlots.length)] : null;
            setNewCareLineColor(randomSlot?.color_hex || "#C4B5FD");
            setNewCareLineColorSlotId(sanitizeColorSlotId(randomSlot?.id));
            setNewCareLineStatus("em_andamento");
            setCareLineDialogOpen(true);
          }}
          className="text-xs h-7 px-3.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-sm"
          disabled={locked}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar Linha de Cuidado Personalizada
        </Button>
      </div>

      {/* Modal Nova Linha de Cuidado */}
      <Dialog open={careLineDialogOpen} onOpenChange={setCareLineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Linha de Cuidado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Linha de Cuidado / Motivo</Label>
              <Popover open={groupComboboxOpen} onOpenChange={setGroupComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={groupComboboxOpen}
                    className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
                  >
                    <span className={newCareLineName ? "truncate" : "truncate text-muted-foreground"}>
                      {newCareLineName || "Selecione uma linha de cuidado ou digite para criar"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      value={newCareLineName}
                      onValueChange={setNewCareLineName}
                      placeholder="Buscar ou criar linha de cuidado..."
                    />
                    <CommandList>
                      {newCareLineName.trim() && !existingSuggestion && !existingPatientGroup ? (
                        <CommandGroup heading="Criar novo">
                          <CommandItem value={newCareLineName} onSelect={handleCreateTypedGroupName}>
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>Criar</span>
                            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                              {newCareLineName.trim().replace(/\s+/g, " ")}
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
                              onSelect={() => handleSelectGroupSuggestion(suggestion)}
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
              ) : existingSuggestion ? (
                <p className="text-xs text-muted-foreground">
                  Este nome já existe na clínica. Ao criar, ele será reutilizado neste paciente com a cor e status selecionados.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Digite para buscar linhas de cuidado existentes ou criar uma nova opção reutilizável.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status da linha de cuidado</Label>
              <Select value={newCareLineStatus} onValueChange={(value) => setNewCareLineStatus(value as PatientGroupStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <GroupColorPaletteField
                defaultOpen={false}
                onPaletteSave={onSaveClinicColorSlot}
                onSelectSlot={(slot) => {
                  setNewCareLineColorSlotId(sanitizeColorSlotId(slot.id));
                  setNewCareLineColor(slot.color_hex);
                }}
                previewColorHex={newCareLineColor}
                selectedSlotId={newCareLineColorSlotId}
                slots={resolvedClinicColorSlots}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void handleSaveModal()} disabled={!newCareLineName.trim() || Boolean(existingPatientGroup) || savingCareLine}>
              {savingCareLine ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
