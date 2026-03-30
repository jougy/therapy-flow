import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import {
  addOptionMatrixRow,
  addOptionToMatrixRow,
  getOptionMatrixRows,
  removeOptionFromMatrix,
  updateOptionMatrixLabel,
} from "@/lib/anamnesis-forms";

interface OptionMatrixEditorProps {
  onChange: (options: AnamnesisFieldOption[]) => void;
  options?: AnamnesisFieldOption[];
}

export const OptionMatrixEditor = ({ onChange, options = [] }: OptionMatrixEditorProps) => {
  const rows = getOptionMatrixRows(options);

  return (
    <div className="space-y-3">
      {rows.map(({ rowIndex, items }, rowPosition) => (
        <ScrollArea key={rowIndex} className="w-full whitespace-nowrap rounded-md border bg-muted/10">
          <div className="flex min-w-max items-start gap-3 p-3">
            {items.map((option, columnIndex) => {
              const isFirstOption = rowPosition === 0 && columnIndex === 0;

              return (
                <div key={option.id} className="flex min-w-[220px] items-center gap-2">
                  <Input
                    value={option.label}
                    onChange={(event) => onChange(updateOptionMatrixLabel(rows.flatMap((row) => row.items), option.id, event.target.value))}
                    placeholder={isFirstOption ? "Opção inicial" : "Nova opção"}
                  />
                  {!isFirstOption ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover opção ${columnIndex + 1} da linha ${rowPosition + 1}`}
                      onClick={() => onChange(removeOptionFromMatrix(rows.flatMap((row) => row.items), option.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onChange(addOptionToMatrixRow(rows.flatMap((row) => row.items), rowIndex))}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar à direita
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange(addOptionMatrixRow(rows.flatMap((row) => row.items)))}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar linha
      </Button>
    </div>
  );
};
