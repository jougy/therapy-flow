import { DateFieldInput } from "@/components/anamnesis/DateFieldInput";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { AddressBlockInput } from "@/components/anamnesis/AddressBlockInput";
import { TagFieldInput } from "@/components/anamnesis/TagFieldInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getOptionMatrixRows, type AnamnesisField } from "@/lib/anamnesis-forms";

export interface FormEditorLivePreviewProps {
  field: AnamnesisField;
  testAnswers: Record<string, unknown>;
  setFieldTestAnswer: (fieldId: string, value: unknown) => void;
  onFieldFocus?: (fieldId: string) => void;
}

export const FormEditorLivePreview: React.FC<FormEditorLivePreviewProps> = ({
  field,
  testAnswers,
  setFieldTestAnswer,
  onFieldFocus,
}) => {
  const triggerFocus = () => {
    onFieldFocus?.(field.id);
  };

  if (field.type === "short_text") {
    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <Input
          value={(testAnswers[field.id] as string) ?? ""}
          onChange={(e) => setFieldTestAnswer(field.id, e.target.value)}
          onFocus={triggerFocus}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "long_text") {
    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <Textarea
          value={(testAnswers[field.id] as string) ?? ""}
          onChange={(e) => setFieldTestAnswer(field.id, e.target.value)}
          onFocus={triggerFocus}
          placeholder={field.placeholder}
          rows={4}
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <DateFieldInput
          id={field.id}
          value={(testAnswers[field.id] as string) ?? ""}
          onChange={(val) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <Input
          type="number"
          value={(testAnswers[field.id] as string | number) ?? ""}
          onChange={(e) => setFieldTestAnswer(field.id, e.target.value)}
          onFocus={triggerFocus}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <Select
          value={(testAnswers[field.id] as string) ?? ""}
          onValueChange={(val) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
        >
          <SelectTrigger className="w-full" onClick={triggerFocus}>
            <SelectValue placeholder="Selecione uma opção..." />
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

  if (field.type === "slider") {
    const currentSliderValue = typeof testAnswers[field.id] === "number" ? testAnswers[field.id] : field.min ?? 0;
    const minLabel = field.sliderMinLabel || `${field.min ?? 0}`;
    const maxLabel = field.sliderMaxLabel || `${field.max ?? 10}`;

    return (
      <div className="min-w-0 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {currentSliderValue}
          </span>
        </div>
        <Slider
          value={[Number(currentSliderValue)]}
          min={field.min ?? 0}
          max={field.max ?? 10}
          step={field.sliderStep ?? 1}
          onValueChange={([val]) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate max-w-[45%] font-medium">{minLabel}</span>
          <span className="truncate max-w-[45%] text-right font-medium">{maxLabel}</span>
        </div>
      </div>
    );
  }

  if (field.type === "address_block") {
    const currentAddress = (testAnswers[field.id] as Record<string, unknown>) ?? {};
    return (
      <div className="min-w-0 space-y-2">
        <AddressBlockInput
          label={field.label}
          helpText={field.helpText}
          required={field.required}
          value={currentAddress}
          onChange={(val) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
          disabled={false}
        />
      </div>
    );
  }

  if (field.type === "multiple_choice") {
    const optionRows = getOptionMatrixRows(field.options ?? []);

    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <RadioGroup
          value={(testAnswers[field.id] as string) ?? ""}
          onValueChange={(val) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
        >
          <div className="space-y-4">
            {optionRows.map(({ rowIndex, items }) => (
              <div key={rowIndex} className="space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  {items.map((option) => (
                    <div
                      key={option.id}
                      className={`inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                        testAnswers[field.id] === option.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerFocus();
                        setFieldTestAnswer(field.id, option.id);
                      }}
                    >
                      <RadioGroupItem
                        value={option.id}
                        id={`preview_${field.id}_${option.id}`}
                        className="mt-0.5 shrink-0"
                      />
                      <Label
                        htmlFor={`preview_${field.id}_${option.id}`}
                        className="max-w-[48ch] min-w-0 break-words leading-snug cursor-pointer"
                      >
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
    const optionRows = getOptionMatrixRows(field.options ?? []);
    const currentChecked = (testAnswers[field.id] as string[]) ?? [];
    const toggleChecklistOption = (optionId: string) => {
      triggerFocus();
      const next = currentChecked.includes(optionId)
        ? currentChecked.filter((id) => id !== optionId)
        : [...currentChecked, optionId];
      setFieldTestAnswer(field.id, next);
    };

    return (
      <div className="min-w-0 space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <div className="space-y-3">
          {optionRows.map(({ rowIndex, items }) => (
            <div key={rowIndex} className="space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                {items.map((option) => {
                  const isChecked = currentChecked.includes(option.id);
                  return (
                    <div
                      key={option.id}
                      className={`inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                        isChecked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChecklistOption(option.id);
                      }}
                    >
                      <Checkbox
                        id={`preview_${field.id}_${option.id}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleChecklistOption(option.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <Label
                        htmlFor={`preview_${field.id}_${option.id}`}
                        className="max-w-[48ch] min-w-0 break-words leading-snug cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
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

  if (field.type === "tags") {
    return (
      <div className="min-w-0">
        <TagFieldInput
          field={field}
          value={testAnswers[field.id]}
          onChange={(val) => {
            triggerFocus();
            setFieldTestAnswer(field.id, val);
          }}
          onFocus={triggerFocus}
          disabled={false}
        />
      </div>
    );
  }

  if (field.type === "table") {
    const columns = field.options ?? [];
    const currentTableValues = (testAnswers[field.id] as Record<string, string>) ?? {};
    const updateTableCell = (colId: string, val: string) => {
      triggerFocus();
      setFieldTestAnswer(field.id, { ...currentTableValues, [colId]: val });
    };

    return (
      <div className="space-y-2">
        <FieldLabelWithHelp label={field.label} helpText={field.helpText} required={field.required} />
        <div className="overflow-x-auto rounded-md border">
          <div
            className="grid min-w-max gap-3 border-b bg-muted/40 p-3 text-sm font-medium text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))` }}
          >
            {columns.length > 0 ? (
              columns.map((option) => <span key={option.id}>{option.label}</span>)
            ) : (
              <span>Coluna</span>
            )}
          </div>
          <div
            className="grid min-w-max gap-3 p-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))` }}
          >
            {(columns.length > 0 ? columns : [{ id: "preview_column", label: "Coluna" }]).map((option) => (
              <Input
                key={option.id}
                placeholder={option.label}
                value={currentTableValues[option.id] ?? ""}
                onChange={(e) => updateTableCell(option.id, e.target.value)}
                onFocus={triggerFocus}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
