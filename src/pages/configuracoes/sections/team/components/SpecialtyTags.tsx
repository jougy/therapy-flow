import React from "react";
import { Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const parseSpecialties = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export const removeSpecialtyTag = (
  tagToRemove: string,
  currentValue: string,
  setter: (nextVal: string) => void
) => {
  const tags = parseSpecialties(currentValue);
  const updated = tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
  setter(updated.join("; "));
};

export const SpecialtyTagsPreview: React.FC<{
  value: string;
  onRemove?: (tagToRemove: string) => void;
}> = ({ value, onRemove }) => {
  const tags = parseSpecialties(value);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
        <Tag className="h-3 w-3 text-primary/70" />
        Tags:
      </span>
      {tags.map((tag, idx) => (
        <Badge
          key={`${tag}-${idx}`}
          variant="secondary"
          className="text-xs gap-1 font-normal py-0 px-2 bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/20"
        >
          <span>{tag}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="ml-0.5 hover:text-destructive focus:outline-none"
              aria-label={`Remover tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
};
