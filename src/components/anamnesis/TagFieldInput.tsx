import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Tag as TagIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import type { AnamnesisField, AnamnesisTagItem } from "@/lib/anamnesis-forms";
import {
  DEFAULT_GROUP_COLOR_SLOT_SEEDS,
  getReadableTextColor,
  normalizeGroupName,
  sanitizeColorSlotId,
  toRgbaString,
} from "@/lib/group-colors";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";

export interface TagFieldInputProps {
  field: AnamnesisField;
  value?: unknown;
  onChange: (value: AnamnesisTagItem[]) => void;
  disabled?: boolean;
  onFocus?: () => void;
  clinicColorSlots?: ClinicGroupColorSlot[];
  groupSuggestions?: Array<{ name: string; color?: string; clinic_color_slot_id?: string | null }>;
  onSaveNewClinicTag?: (name: string, color: string, colorSlotId?: string | null) => Promise<void> | void;
}

const DEFAULT_SLOTS: ClinicGroupColorSlot[] = DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((slot) => ({
  alpha: slot.alpha,
  color_hex: slot.colorHex,
  id: `default-slot-${slot.slotIndex}`,
  slot_index: slot.slotIndex,
}));

export const TagFieldInput: React.FC<TagFieldInputProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  onFocus,
  clinicColorSlots = DEFAULT_SLOTS,
  groupSuggestions = [],
  onSaveNewClinicTag,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#C4B5FD");
  const [newTagColorSlotId, setNewTagColorSlotId] = useState<string | null>(null);
  const [savingTag, setSavingTag] = useState(false);

  const slots = clinicColorSlots.length > 0 ? clinicColorSlots : DEFAULT_SLOTS;

  // Normalize current selected tags from value prop
  const selectedTags: AnamnesisTagItem[] = useMemo(() => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((item, index): AnamnesisTagItem | null => {
          if (typeof item === "string") {
            const trimmed = item.trim();
            if (!trimmed) return null;
            const matchingOption = (field.options ?? []).find(
              (opt) => normalizeGroupName(opt.label) === normalizeGroupName(trimmed)
            );
            return {
              id: matchingOption?.id ?? `tag_${index}_${normalizeGroupName(trimmed)}`,
              label: matchingOption?.label ?? trimmed,
              color: matchingOption?.color ?? "#C4B5FD",
              colorSlotId: matchingOption?.colorSlotId ?? null,
            };
          }

          if (item && typeof item === "object" && !Array.isArray(item)) {
            const rec = item as Record<string, unknown>;
            const rawLabel = typeof rec.label === "string" ? rec.label : typeof rec.name === "string" ? rec.name : "";
            const rawId = typeof rec.id === "string" ? rec.id : `tag_${index}`;
            const rawColor = typeof rec.color === "string" ? rec.color : "#C4B5FD";
            const rawSlotId = typeof rec.colorSlotId === "string" ? rec.colorSlotId : null;

            if (!rawLabel.trim()) return null;

            return {
              id: rawId,
              label: rawLabel.trim(),
              color: rawColor,
              colorSlotId: rawSlotId,
            };
          }

          return null;
        })
        .filter((item): item is AnamnesisTagItem => item !== null);
    }

    if (typeof value === "string" && value.trim()) {
      return [
        {
          id: `tag_0`,
          label: value.trim(),
          color: "#C4B5FD",
          colorSlotId: null,
        },
      ];
    }

    return [];
  }, [value, field.options]);

  const selectedNameSet = useMemo(
    () => new Set(selectedTags.map((tag) => normalizeGroupName(tag.label))),
    [selectedTags]
  );

  const predefinedOptions = useMemo(() => field.options ?? [], [field.options]);

  const isMultiple = field.tagMode !== "single";
  const allowCustom = field.allowCustomTags !== false;

  const handleToggleTag = (tag: AnamnesisTagItem) => {
    if (disabled) return;
    onFocus?.();

    const isSelected = selectedNameSet.has(normalizeGroupName(tag.label));

    if (isSelected) {
      onChange(selectedTags.filter((t) => normalizeGroupName(t.label) !== normalizeGroupName(tag.label)));
    } else {
      if (isMultiple) {
        onChange([...selectedTags, tag]);
      } else {
        onChange([tag]);
      }
    }
  };

  const handleRemoveTag = (tagId: string, event?: React.MouseEvent) => {
    if (disabled) return;
    event?.stopPropagation();
    onFocus?.();
    onChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleOpenCreateDialog = (initialName = "") => {
    if (disabled) return;
    onFocus?.();
    setNewTagName(initialName);
    const randomSlot = slots[Math.floor(Math.random() * slots.length)] ?? slots[0];
    setNewTagColor(randomSlot?.color_hex ?? "#C4B5FD");
    setNewTagColorSlotId(sanitizeColorSlotId(randomSlot?.id));
    setDialogOpen(true);
  };

  const handleSaveModal = async () => {
    const trimmed = sanitizeSingleLineInput(newTagName, INPUT_LIMITS.formOptionLabel).trim();
    if (!trimmed) return;

    setSavingTag(true);
    try {
      if (onSaveNewClinicTag) {
        await onSaveNewClinicTag(trimmed, newTagColor, newTagColorSlotId);
      }

      const newTag: AnamnesisTagItem = {
        id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: trimmed,
        color: newTagColor,
        colorSlotId: newTagColorSlotId,
      };

      if (isMultiple) {
        if (!selectedNameSet.has(normalizeGroupName(trimmed))) {
          onChange([...selectedTags, newTag]);
        }
      } else {
        onChange([newTag]);
      }

      setDialogOpen(false);
      setNewTagName("");
    } finally {
      setSavingTag(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2.5">
      <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />

      {/* Selected Tags Row */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {selectedTags.length === 0 ? (
          <span className="text-xs text-muted-foreground italic py-0.5">
            {field.placeholder || "Nenhuma tag selecionada"}
          </span>
        ) : (
          selectedTags.map((tag) => {
            const hex = tag.color || "#C4B5FD";
            const textColor = getReadableTextColor(hex);

            return (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs transition-all animate-in fade-in zoom-in-95"
                style={{
                  backgroundColor: `${hex}25`,
                  borderColor: hex,
                  color: textColor === "#111827" ? "#111827" : undefined,
                }}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                <span className="truncate max-w-[200px]">{tag.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTag(tag.id, e)}
                    className="ml-0.5 h-3.5 w-3.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label={`Remover tag ${tag.label}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </Badge>
            );
          })
        )}
      </div>

      {/* Available / Predefined Tags & Trigger Controls */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
          {/* Predefined Options List */}
          {predefinedOptions
            .filter((opt) => !selectedNameSet.has(normalizeGroupName(opt.label)))
            .map((opt) => {
              const hex = opt.color || "#C4B5FD";
              return (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleToggleTag({
                      id: opt.id,
                      label: opt.label,
                      color: opt.color,
                      colorSlotId: opt.colorSlotId,
                    })
                  }
                  className="text-xs h-7 px-3 rounded-full border-dashed text-muted-foreground hover:text-foreground gap-1.5 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  + {opt.label}
                </Button>
              );
            })}

          {/* Combobox Search & Add Trigger */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5 rounded-full gap-1 text-muted-foreground hover:text-foreground"
              >
                <TagIcon className="h-3 w-3 opacity-60" />
                <span>Buscar tags</span>
                <ChevronsUpDown className="h-3 w-3 opacity-40" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Buscar ou digitar tag..." />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      <p>Nenhuma tag encontrada.</p>
                      {allowCustom && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 text-xs h-7 gap-1"
                          onClick={() => {
                            setComboboxOpen(false);
                            handleOpenCreateDialog();
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Criar nova tag
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>

                  {/* Predefined Options in Combobox */}
                  {predefinedOptions.length > 0 && (
                    <CommandGroup heading="Tags do Formulário">
                      {predefinedOptions.map((opt) => {
                        const isSelected = selectedNameSet.has(normalizeGroupName(opt.label));
                        return (
                          <CommandItem
                            key={opt.id}
                            value={opt.label}
                            onSelect={() => {
                              handleToggleTag({
                                id: opt.id,
                                label: opt.label,
                                color: opt.color,
                                colorSlotId: opt.colorSlotId,
                              });
                              if (!isMultiple) setComboboxOpen(false);
                            }}
                          >
                            <span
                              className="mr-2 h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color || "#C4B5FD" }}
                            />
                            <span className="truncate flex-1">{opt.label}</span>
                            {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  {/* Clinic Suggestions */}
                  {groupSuggestions.length > 0 && (
                    <CommandGroup heading="Tags Frequentes da Clínica">
                      {groupSuggestions.map((suggestion) => {
                        const isSelected = selectedNameSet.has(normalizeGroupName(suggestion.name));
                        return (
                          <CommandItem
                            key={normalizeGroupName(suggestion.name)}
                            value={suggestion.name}
                            onSelect={() => {
                              handleToggleTag({
                                id: `sug_${normalizeGroupName(suggestion.name)}`,
                                label: suggestion.name,
                                color: suggestion.color || "#C4B5FD",
                                colorSlotId: suggestion.clinic_color_slot_id ?? null,
                              });
                              if (!isMultiple) setComboboxOpen(false);
                            }}
                          >
                            <span
                              className="mr-2 h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: suggestion.color || "#C4B5FD" }}
                            />
                            <span className="truncate flex-1">{suggestion.name}</span>
                            {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Quick Create Button */}
          {allowCustom && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => handleOpenCreateDialog()}
              className="text-xs h-7 px-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 shadow-xs"
            >
              <Plus className="h-3 w-3" />
              Criar Tag
            </Button>
          )}
        </div>
      )}

      {/* Modal Criar Tag Personalizada */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Tag Personalizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name-input">Nome da Tag</Label>
              <Input
                id="tag-name-input"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: Coluna Lombar, Pós-Operatório, etc."
                maxLength={INPUT_LIMITS.formOptionLabel}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Digite um nome descritivo para identificar facilmente esta categoria.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cor da Tag</Label>
              <GroupColorPaletteField
                defaultOpen={false}
                onPaletteSave={(slotIndex, colorHex, alpha) => {
                  setNewTagColor(colorHex);
                }}
                onSelectSlot={(slot) => {
                  setNewTagColorSlotId(sanitizeColorSlotId(slot.id));
                  setNewTagColor(slot.color_hex);
                }}
                previewColorHex={newTagColor}
                selectedSlotId={newTagColorSlotId}
                slots={slots}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => void handleSaveModal()}
              disabled={!newTagName.trim() || savingTag}
            >
              {savingTag ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
