import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { ScaleIndicator } from "@/components/sessions";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

export interface SessionBaseSliderSectionProps {
  mode: "edit" | "view";
  visibleBaseSliderFields: AnamnesisField[];
  readBaseSliderValue: (field: AnamnesisField) => number;
  updateBaseSliderValue?: (field: AnamnesisField, next: number) => void;
  locked?: boolean;
}

export function SessionBaseSliderSection({
  mode,
  visibleBaseSliderFields,
  readBaseSliderValue,
  updateBaseSliderValue,
  locked = false,
}: SessionBaseSliderSectionProps) {
  if (visibleBaseSliderFields.length === 0) {
    return null;
  }

  return (
    <Card data-tutorial="session-pain-scale">
      <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleBaseSliderFields.map((field) => {
          const value = readBaseSliderValue(field);

          return (
            <div key={field.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div>
                <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
              </div>
              {mode === "view" ? (
                <ScaleIndicator score={value} min={field.min ?? 0} max={field.max ?? 10} />
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    {value}/{field.max ?? 10}
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([next]) => updateBaseSliderValue?.(field, next)}
                    min={field.min ?? 0}
                    max={field.max ?? 10}
                    step={1}
                    disabled={locked}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
