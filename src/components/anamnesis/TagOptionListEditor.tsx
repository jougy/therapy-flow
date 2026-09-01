import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import { ANAMNESIS_OPTION_LIMIT } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { normalizeHexColor } from "@/lib/group-colors";

interface TagOptionListEditorProps {
  maxOptions?: number;
  onChange: (options: AnamnesisFieldOption[]) => void;
  options?: AnamnesisFieldOption[];
}

const PRESET_TAG_COLORS = [
  "#C4B5FD", // Lavender
  "#FDE047", // Yellow
  "#93C5FD", // Sky
  "#86EFAC", // Emerald
  "#FDA4AF", // Rose
  "#FDBA74", // Orange
  "#A5B4FC", // Indigo
  "#67E8F9", // Cyan
  "#CBD5E1", // Slate
];

export const TagOptionListEditor: React.FC<TagOptionListEditorProps> = ({
  maxOptions = ANAMNESIS_OPTION_LIMIT,
  onChange,
  options = [],
}) => {
  const items = options.length > 0 ? options : [{ id: "tag_1", label: "Tag 1", color: "#C4B5FD", row: 0 }];
  const optionLimitReached = items.length >= maxOptions;
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const handleUpdateLabel = (id: string, label: string) => {
    const sanitized = sanitizeSingleLineInput(label, INPUT_LIMITS.formOptionLabel);
    onChange(items.map((item) => (item.id === id ? { ...item, label: sanitized } : item)));
  };

  const handleUpdateColor = (id: string, color: string, colorSlotId?: string | null) => {
    onChange(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              color,
              colorSlotId: colorSlotId ?? item.colorSlotId,
            }
          : item
      )
    );
    setOpenPopoverId(null);
  };

  const handleAddTag = () => {
    if (optionLimitReached) return;
    const nextIndex = items.length + 1;
    const color = PRESET_TAG_COLORS[(nextIndex - 1) % PRESET_TAG_COLORS.length];
    const newTag: AnamnesisFieldOption = {
      id: `tag_${Date.now()}_${nextIndex}`,
      label: `Nova Tag ${nextIndex}`,
      color,
      row: items.length,
    };
    onChange([...items, newTag]);
  };

  const handleRemoveTag = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    onChange(next.length > 0 ? next : [{ id: `tag_${Date.now()}`, label: "Tag 1", color: "#C4B5FD", row: 0 }]);
  };

  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        {items.map((option, index) => {
          const currentColor = option.color || PRESET_TAG_COLORS[index % PRESET_TAG_COLORS.length];
          const isSingle = items.length === 1;

          return (
            <div key={option.id} className="flex items-center gap-2">
              <Popover
                open={openPopoverId === option.id}
                onOpenChange={(open) => setOpenPopoverId(open ? option.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-8 w-8 shrink-0 rounded-md border shadow-xs flex items-center justify-center transition hover:scale-105 active:scale-95"
                    style={{ backgroundColor: currentColor }}
                    title="Escolher cor da tag"
                    aria-label={`Cor da tag ${option.label}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-white/70 shadow-xs" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Cor da Tag</p>
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: currentColor }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_TAG_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={`h-7 rounded-md border transition hover:scale-105 ${
                          currentColor.toUpperCase() === hex.toUpperCase()
                            ? "ring-2 ring-primary ring-offset-1"
                            : ""
                        }`}
                        style={{ backgroundColor: hex }}
                        onClick={() => handleUpdateColor(option.id, hex)}
                        aria-label={`Selecionar cor ${hex}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <span className="text-xs text-muted-foreground font-mono">#</span>
                    <Input
                      defaultValue={currentColor.replace("#", "")}
                      maxLength={6}
                      className="h-7 text-xs font-mono uppercase"
                      onBlur={(e) => {
                        const normalized = normalizeHexColor(`#${e.target.value}`);
                        if (normalized) {
                          handleUpdateColor(option.id, normalized);
                        }
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <Input
                value={option.label}
                onChange={(event) => handleUpdateLabel(option.id, event.target.value)}
                placeholder={`Tag ${index + 1}`}
                maxLength={INPUT_LIMITS.formOptionLabel}
                className="h-8 text-xs flex-1"
              />

              {!isSingle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remover tag ${option.label}`}
                  onClick={() => handleRemoveTag(option.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddTag}
        disabled={optionLimitReached}
        className="w-full text-xs h-8 gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar tag pré-definida
      </Button>
    </div>
  );
};
