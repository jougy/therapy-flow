import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import {
  ANAMNESIS_OPTION_LIMIT,
  addOptionToVerticalList,
  getVerticalOptionList,
  removeOptionFromVerticalList,
  updateVerticalOptionLabel,
} from "@/lib/anamnesis-forms";
import { INPUT_LIMITS } from "@/lib/input-security";

interface OptionListEditorProps {
  maxOptions?: number;
  onChange: (options: AnamnesisFieldOption[]) => void;
  options?: AnamnesisFieldOption[];
}

export const OptionListEditor = ({ maxOptions = ANAMNESIS_OPTION_LIMIT, onChange, options = [] }: OptionListEditorProps) => {
  const items = getVerticalOptionList(options);
  const optionLimitReached = items.length >= maxOptions;

  return (
    <div className="space-y-3">
      {items.map((option, index) => {
        const isFirstOption = index === 0;

        return (
          <div key={option.id} className="flex items-center gap-2">
            <Input
              value={option.label}
              onChange={(event) => onChange(updateVerticalOptionLabel(items, option.id, event.target.value))}
              placeholder={isFirstOption ? "Opção inicial" : "Nova opção"}
              maxLength={INPUT_LIMITS.formOptionLabel}
            />
            {!isFirstOption ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover opção ${index + 1}`}
                onClick={() => onChange(removeOptionFromVerticalList(items, option.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange(addOptionToVerticalList(items))} disabled={optionLimitReached}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar opção
      </Button>
    </div>
  );
};
