import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AddressBlockInput } from "@/components/anamnesis/AddressBlockInput";
import { DateFieldInput } from "@/components/anamnesis/DateFieldInput";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { TagFieldInput } from "@/components/anamnesis/TagFieldInput";
import type { ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import type { GroupSuggestion } from "./types";
import { Badge } from "@/components/ui/badge";
import {
  addTableRow,
  getTableRows,
  getOptionMatrixRows,
  removeTableRow,
  updateTableCellValue,
  type AddressBlockValue,
  type AnamnesisField,
  type AnamnesisFormResponse,
  type AnamnesisFormValue,
  type TemplateLayoutItem,
} from "@/lib/anamnesis-forms";
import { cn } from "@/lib/utils";
import type { SuggestedCareLine } from "@/lib/care-lines-classifier";
import { CheckCircle2, Layers, Plus, Sparkles, ToggleLeft, Trash2 } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { HorizontalScrollNavigator } from "./SessionHorizontalScrollNavigator";

const estimateLayoutWeight = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const optionCount = field.options?.length ?? 0;

  let weight = 1;
  weight += Math.min(labelLength / 24, 1.25);
  weight += Math.min(helpLength / 80, 0.75);
  weight += Math.min(longestOption / 20, 1.5);
  weight += Math.min(optionCount / 6, 1);

  if (field.type === "checklist" || field.type === "multiple_choice") {
    weight += 0.5;
  }

  return Math.max(weight, 1);
};

const estimateChildWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const optionCount = field.options?.length ?? 0;

  const width =
    260 +
    Math.min(labelLength * 8, 220) +
    Math.min(helpLength * 2, 120) +
    Math.min(longestOption * 7, 220) +
    Math.min(optionCount * 18, 140);

  return Math.max(220, Math.min(width, 720));
};

const estimateFieldPreferredWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const readableTextWidth = Math.max(labelLength, longestOption) * 8;

  if (field.type === "select") {
    return Math.max(260, Math.min(520, 180 + readableTextWidth + Math.min(helpLength * 2, 100)));
  }

  if (field.type === "date" || field.type === "number") {
    return Math.max(220, Math.min(360, 170 + labelLength * 7));
  }

  if (field.type === "short_text") {
    return Math.max(280, Math.min(560, 190 + labelLength * 7 + Math.min(helpLength * 2, 100)));
  }

  if (field.type === "slider") {
    return Math.max(320, Math.min(520, 220 + labelLength * 7));
  }

  return estimateChildWidth(field);
};

const getFieldMaxWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  if (field.type === "select") {
    return Math.max(320, Math.min(560, estimateFieldPreferredWidth(field) + 80));
  }

  if (field.type === "date" || field.type === "number") {
    return 380;
  }

  if (field.type === "short_text" || field.type === "slider") {
    return Math.max(420, Math.min(640, estimateFieldPreferredWidth(field) + 80));
  }

  return null;
};

const getStandaloneFieldSizingStyle = (
  field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">
): CSSProperties | undefined => {
  const maxWidth = getFieldMaxWidth(field);

  if (!maxWidth) {
    return undefined;
  }

  return {
    maxWidth,
    width: "100%",
  };
};

const estimateHorizontalSectionRowHeight = (items: TemplateLayoutItem[]) => {
  const tallestField = items.reduce((maxHeight, item) => {
    const optionLengths = (item.field.options ?? []).map((option) => (option.label ?? "").trim().length);
    const longestOption = optionLengths.length > 0 ? Math.max(...optionLengths) : 0;
    const baseHeight =
      92 +
      Math.min(((item.field.label ?? "").trim().length / 14) * 8, 32) +
      Math.min(((item.field.helpText ?? "").trim().length / 40) * 6, 24) +
      Math.min((item.field.options?.length ?? 0) * 10, 42) +
      Math.min(longestOption / 2, 28);

    return Math.max(maxHeight, baseHeight);
  }, 120);

  return `${Math.ceil(tallestField)}px`;
};

const hasMeaningfulFormValue = (value: AnamnesisFormValue | undefined) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulFormValue(item as AnamnesisFormValue));
  }

  return false;
};

export const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, index) => (
          <div key={index} className={`h-4 w-2 rounded-sm ${index < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
};

export interface SessionAnamnesisRuntimeProps {
  anamnesisFormResponse: AnamnesisFormResponse;
  complexityScore: number[];
  horizontalScrollRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  horizontalScrollState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>;
  layout: TemplateLayoutItem[];
  locked: boolean;
  painScore: number[];
  queixa: string;
  sintomas: string;
  observacoes: string;
  suggestedCareLine: SuggestedCareLine | null;
  clinicColorSlots?: ClinicGroupColorSlot[];
  groupSuggestions?: GroupSuggestion[];
  onAnamnesisFormResponseChange: React.Dispatch<React.SetStateAction<AnamnesisFormResponse>>;
  onComplexityScoreChange: (val: number[]) => void;
  onObservacoesChange: (val: string) => void;
  onPainScoreChange: (val: number[]) => void;
  onQueixaChange: (val: string) => void;
  onSintomasChange: (val: string) => void;
  onSelectCareLinePreset: (presetName: string) => Promise<void>;
  onSaveNewClinicTag?: (name: string, color: string, colorSlotId?: string | null) => Promise<void> | void;
  scrollHorizontalSectionToRatio: (key: string, ratio: number, behavior?: ScrollBehavior) => void;
  scrollHorizontalSectionToSibling: (key: string, direction: "left" | "right") => void;
  beginHorizontalDrag: (key: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  updateHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  endHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  scheduleHorizontalScrollSync: () => void;
}

export const SessionAnamnesisRuntime = ({
  anamnesisFormResponse,
  complexityScore,
  horizontalScrollRefs,
  horizontalScrollState,
  layout,
  locked,
  painScore,
  queixa,
  sintomas,
  observacoes,
  suggestedCareLine,
  clinicColorSlots,
  groupSuggestions,
  onAnamnesisFormResponseChange,
  onComplexityScoreChange,
  onObservacoesChange,
  onPainScoreChange,
  onQueixaChange,
  onSintomasChange,
  onSelectCareLinePreset,
  onSaveNewClinicTag,
  scrollHorizontalSectionToRatio,
  scrollHorizontalSectionToSibling,
  beginHorizontalDrag,
  updateHorizontalDrag,
  endHorizontalDrag,
  scheduleHorizontalScrollSync,
}: SessionAnamnesisRuntimeProps) => {
  const painColor =
    painScore[0] <= 3 ? "text-success" : painScore[0] <= 6 ? "text-warning" : "text-destructive";

  const updateFormResponse = (fieldId: string, value: AnamnesisFormValue) => {
    onAnamnesisFormResponseChange((current) => ({
      ...current,
      [fieldId]: value,
    }));
  };

  const renderDynamicField = (field: AnamnesisField) => {
    if (field.systemKey === "queixa") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={queixa}
            onChange={(event) => onQueixaChange(event.target.value)}
            placeholder={field.placeholder || "Descreva a queixa principal do paciente..."}
            className="mt-1.5"
            rows={3}
            disabled={locked}
          />
          {suggestedCareLine && !locked && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3.5 py-2 text-xs text-foreground shadow-sm animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
                <span className="truncate">
                  Sugestão inteligente: termo <strong>"{suggestedCareLine.matchedKeyword}"</strong> detectado. Deseja
                  classificar como <strong>"{suggestedCareLine.preset.name}"</strong>?
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-6 px-3 text-[11px] font-semibold shrink-0 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                onClick={() => void onSelectCareLinePreset(suggestedCareLine.preset.name)}
              >
                <CheckCircle2 className="h-3 w-3" />
                Aplicar
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (field.systemKey === "sintomas") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={sintomas}
            onChange={(event) => onSintomasChange(event.target.value)}
            placeholder={field.placeholder || "Liste os sintomas relatados..."}
            className="mt-1.5"
            rows={2}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "pain_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className={`text-sm font-bold ${painColor}`}>{painScore[0]}/10</span>
          </div>
          <Slider
            value={painScore}
            onValueChange={onPainScoreChange}
            max={10}
            step={1}
            className="mt-3"
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "complexity_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-bold">{complexityScore[0]}/10</span>
          </div>
          <Slider
            value={complexityScore}
            onValueChange={onComplexityScoreChange}
            max={10}
            step={1}
            className="mt-3"
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "observacoes") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={observacoes}
            onChange={(event) => onObservacoesChange(event.target.value)}
            placeholder={field.placeholder || "Observações adicionais sobre a anamnese..."}
            className="mt-1.5"
            rows={4}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "section") {
      return (
        <div key={field.id} className="rounded-lg border bg-muted/30 p-4">
          <p className="font-medium">{field.label}</p>
          {field.helpText && <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    }

    const value = anamnesisFormResponse[field.id];

    if (field.type === "short_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "long_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
            rows={4}
          />
        </div>
      );
    }

    if (field.type === "number") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            type="number"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            onChange={(event) =>
              updateFormResponse(field.id, event.target.value === "" ? null : Number(event.target.value))
            }
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "date") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <DateFieldInput
            id={field.id}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateFormResponse(field.id, next)}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "slider") {
      const sliderValue = typeof value === "number" ? value : field.min ?? 0;
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-semibold">{sliderValue}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={([next]) => updateFormResponse(field.id, next)}
            min={field.min ?? 0}
            max={field.max ?? 10}
            step={1}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "address_block") {
      const addressVal = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as AddressBlockValue;
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <AddressBlockInput
            label={field.label}
            helpText={field.helpText}
            required={field.required}
            value={addressVal}
            onChange={(next) => updateFormResponse(field.id, next)}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(next) => updateFormResponse(field.id, next)}
            disabled={locked}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "table") {
      const rows = getTableRows(field, value);
      const columns = field.options ?? [];

      return (
        <div key={field.id} className="min-w-0 space-y-3">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <ScrollArea className="w-full min-w-0 whitespace-nowrap rounded-md border">
            <div className="min-w-max space-y-3 p-3">
              <div
                className="grid gap-3 border-b pb-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr)) 48px` }}
              >
                {columns.map((option) => (
                  <div key={option.id} className="text-sm font-medium text-muted-foreground">
                    {option.label}
                  </div>
                ))}
                <div />
              </div>

              {rows.map((row, rowIndex) => (
                <div
                  key={`${field.id}_row_${rowIndex}`}
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr)) 48px` }}
                >
                  {columns.map((option) => (
                    <Input
                      key={option.id}
                      value={row[option.id] ?? ""}
                      onChange={(event) =>
                        updateFormResponse(
                          field.id,
                          updateTableCellValue(rows, rowIndex, option.id, event.target.value)
                        )
                      }
                      placeholder={option.label}
                      disabled={locked}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={locked || rows.length === 1}
                    aria-label={`Remover linha ${rowIndex + 1}`}
                    onClick={() => updateFormResponse(field.id, removeTableRow(rows, rowIndex, field))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={() => updateFormResponse(field.id, addTableRow(rows, field))}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar linha
          </Button>
        </div>
      );
    }

    if (field.type === "multiple_choice") {
      const optionRows = getOptionMatrixRows(field.options ?? []);
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <RadioGroup
            value={typeof value === "string" ? value : ""}
            onValueChange={(next) => updateFormResponse(field.id, next)}
          >
            <div className="space-y-4">
              {optionRows.map(({ rowIndex, items }) => (
                <div key={rowIndex} className="space-y-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {items.map((option) => (
                      <div
                        key={option.id}
                        className="inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2"
                      >
                        <RadioGroupItem
                          value={option.id}
                          id={`${field.id}_${option.id}`}
                          disabled={locked}
                          className="mt-0.5 shrink-0"
                        />
                        <Label htmlFor={`${field.id}_${option.id}`} className="max-w-[48ch] min-w-0 break-words leading-snug">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {rowIndex < optionRows.length - 1 && (
                    <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                      <span className="h-px flex-1 bg-border/80" />
                      <span>---</span>
                      <span className="h-px flex-1 bg-border/80" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      );
    }

    if (field.type === "checklist") {
      const selectedValues = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      const optionRows = getOptionMatrixRows(field.options ?? []);
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="space-y-3">
            {optionRows.map(({ rowIndex, items }) => (
              <div key={rowIndex} className="space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  {items.map((option) => (
                    <div
                      key={option.id}
                      className="inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        id={`${field.id}_${option.id}`}
                        checked={selectedValues.includes(option.id)}
                        disabled={locked}
                        className="mt-0.5 shrink-0"
                        onCheckedChange={(checked) => {
                          const next =
                            checked === true
                              ? [...selectedValues, option.id]
                              : selectedValues.filter((item) => item !== option.id);
                          updateFormResponse(field.id, next);
                        }}
                      />
                      <Label htmlFor={`${field.id}_${option.id}`} className="max-w-[48ch] min-w-0 break-words leading-snug">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {rowIndex < optionRows.length - 1 && (
                  <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                    <span className="h-px flex-1 bg-border/80" />
                    <span>---</span>
                    <span className="h-px flex-1 bg-border/80" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "section_selector") {
      const selectedValues = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      return (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="flex flex-wrap items-start gap-3">
            {(field.options ?? []).map((option) => (
              <div
                key={option.id}
                className="inline-flex w-fit max-w-full items-center gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{option.label}</p>
                  {option.description && <p className="text-xs text-muted-foreground mt-1">{option.description}</p>}
                </div>
                <Switch
                  checked={selectedValues.includes(option.id)}
                  disabled={locked}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((item) => item !== option.id);
                    updateFormResponse(field.id, next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "tags") {
      return (
        <div key={field.id} className="min-w-0">
          <TagFieldInput
            field={field}
            value={value}
            onChange={(next) => updateFormResponse(field.id, next)}
            disabled={locked}
            clinicColorSlots={clinicColorSlots}
            groupSuggestions={groupSuggestions}
            onSaveNewClinicTag={onSaveNewClinicTag}
          />
        </div>
      );
    }

    return null;
  };

  const renderLayoutItems = (items: TemplateLayoutItem[]): React.ReactNode => (
    <div className="space-y-4">
      {items.map((item) => {
        if (item.type === "field") {
          return (
            <div key={item.field.id} className="min-w-0" style={getStandaloneFieldSizingStyle(item.field)}>
              {renderDynamicField(item.field)}
            </div>
          );
        }

        if (item.type === "horizontal_section") {
          const scrollContainerId = item.field.id;
          const horizontalRowMinHeight = estimateHorizontalSectionRowHeight(item.items);
          const horizontalScrollSnapshot = horizontalScrollState[scrollContainerId];
          const totalWidth = item.items.reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0);
          const horizontalMarkerStyles = item.items.map((child, index, array) => {
            const left = array.slice(0, index).reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0);
            const width = estimateFieldPreferredWidth(child.field);
            const hasContent = hasMeaningfulFormValue(anamnesisFormResponse[child.field.id]);
            const isVisible =
              horizontalScrollSnapshot &&
              left + width > horizontalScrollSnapshot.scrollLeft &&
              left < horizontalScrollSnapshot.scrollLeft + horizontalScrollSnapshot.clientWidth;

            return {
              backgroundColor: hasContent ? "rgb(96 165 250)" : "rgb(209 213 219)",
              left: `${(left / totalWidth) * 100}%`,
              opacity: isVisible ? 1 : 0.6,
              width: `${(width / totalWidth) * 100}%`,
            } satisfies CSSProperties;
          });

          return (
            <Card key={item.field.id} className="min-w-0">
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="mt-1 text-sm text-muted-foreground">{item.field.helpText}</p>}
                </div>
                {/* Desktop & Tablet Landscape View: Smooth Horizontal Scroll with Navigator */}
                <div className="hidden sm:block">
                  <div
                    ref={(node) => {
                      horizontalScrollRefs.current[scrollContainerId] = node;
                    }}
                    className="w-full min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    onScroll={scheduleHorizontalScrollSync}
                  >
                    <div className="flex items-stretch gap-4 pb-4">
                      {item.items.map((child) => {
                        const preferredWidth = estimateFieldPreferredWidth(child.field);
                        const maxWidth = getFieldMaxWidth(child.field);

                        return (
                          <div
                            key={child.field.id}
                            className="min-w-0 whitespace-normal rounded-lg border bg-muted/10 p-4"
                            style={{
                              flex: `${estimateLayoutWeight(child.field)} 1 ${preferredWidth}px`,
                              maxWidth: maxWidth ?? undefined,
                              minHeight: horizontalRowMinHeight,
                              minWidth: Math.min(preferredWidth, maxWidth ?? preferredWidth),
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col">
                              {child.type === "field"
                                ? renderDynamicField(child.field)
                                : renderLayoutItems([child])}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <HorizontalScrollNavigator
                    clientWidth={horizontalScrollSnapshot?.clientWidth ?? 0}
                    markerStyles={horizontalMarkerStyles}
                    onScrollLeft={() => {
                      scrollHorizontalSectionToSibling(scrollContainerId, "left");
                    }}
                    onScrollRight={() => {
                      scrollHorizontalSectionToSibling(scrollContainerId, "right");
                    }}
                    onTrackPointerDown={(event) => beginHorizontalDrag(scrollContainerId, event)}
                    onTrackPointerMove={updateHorizontalDrag}
                    onTrackPointerUp={endHorizontalDrag}
                    scrollLeft={horizontalScrollSnapshot?.scrollLeft ?? 0}
                    scrollWidth={horizontalScrollSnapshot?.scrollWidth ?? 0}
                  />
                </div>

                {/* Mobile Portrait View: Fluent Vertical Responsive Stack */}
                <div className="sm:hidden space-y-3">
                  {item.items.map((child) => (
                    <div
                      key={child.field.id}
                      className="w-full min-w-0 rounded-lg border bg-muted/10 p-3.5 space-y-2"
                    >
                      {child.type === "field" ? renderDynamicField(child.field) : renderLayoutItems([child])}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        if (item.type === "section_selector") {
          const value = anamnesisFormResponse[item.field.id];
          const isPlainObject = (v: unknown): v is Record<string, boolean> =>
            typeof v === "object" && v !== null && !Array.isArray(v);

          const childModules = item.items;

          const isChildActive = (childId: string): boolean => {
            if (Array.isArray(value)) {
              return (value as string[]).includes(childId);
            }
            if (isPlainObject(value)) {
              return value[childId] ?? true;
            }
            return true;
          };

          const toggleChildModule = (childId: string) => {
            if (locked) return;
            if (Array.isArray(value)) {
              const currentArray = (value as string[]).filter((id): id is string => typeof id === "string");
              const next = currentArray.includes(childId)
                ? currentArray.filter((id) => id !== childId)
                : [...currentArray, childId];
              updateFormResponse(item.field.id, next);
            } else {
              const currentRecord = isPlainObject(value) ? { ...value } : {};
              const currentState = isChildActive(childId);
              const nextRecord = { ...currentRecord, [childId]: !currentState };
              updateFormResponse(item.field.id, nextRecord);
            }
          };

          const activeChildItems = item.items.filter((child) => isChildActive(child.field.id));

          return (
            <Card key={item.field.id} className="overflow-hidden border-2 border-primary/25 bg-card/90 shadow-sm transition-all">
              <CardContent className="p-0">
                <div className="border-b border-primary/20 bg-primary/5 px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                        <ToggleLeft className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{item.field.label}</p>
                        {item.field.helpText && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.field.helpText}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary self-start sm:self-auto bg-primary/10">
                      Seletor Modular ({childModules.length} {childModules.length === 1 ? "módulo" : "módulos"})
                    </Badge>
                  </div>

                  {childModules.length === 0 ? (
                    <div className="rounded-md border border-dashed border-primary/30 bg-background/60 p-3 text-center text-xs text-muted-foreground">
                      Nenhum módulo modular configurado neste seletor.
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {childModules.map((childModule) => {
                        const childId = childModule.field.id;
                        const isChecked = isChildActive(childId);
                        return (
                          <div
                            key={childId}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isChecked}
                            className={cn(
                              "inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-all select-none",
                              locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                              isChecked
                                ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/25 font-semibold text-foreground"
                                : "border-border/60 bg-background/50 text-muted-foreground opacity-60 hover:opacity-100"
                            )}
                            onClick={() => toggleChildModule(childId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleChildModule(childId);
                              }
                            }}
                          >
                            <span className="text-xs">{childModule.field.label}</span>
                            <Switch
                              checked={isChecked}
                              disabled={locked}
                              onCheckedChange={() => toggleChildModule(childId)}
                              className="scale-90"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {activeChildItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 py-8 px-4 text-center text-xs text-muted-foreground">
                      Nenhum módulo selecionado no momento. Ative um ou mais módulos acima para preencher os campos.
                    </div>
                  ) : (
                    renderLayoutItems(activeChildItems)
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Accordion
            key={item.field.id}
            type="multiple"
            defaultValue={[item.field.id]}
            className="min-w-0 rounded-lg border px-4"
          >
            <AccordionItem value={item.field.id} className="border-none">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="text-left">
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="text-sm text-muted-foreground mt-1">{item.field.helpText}</p>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {renderLayoutItems(item.items)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );

  return <>{renderLayoutItems(layout)}</>;
};
