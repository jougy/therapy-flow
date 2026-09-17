import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import type { AnamnesisField } from "@/lib/anamnesis-forms";
import { ANAMNESIS_OPTION_LIMIT } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";

export interface SimpleListFieldInputProps {
  field: AnamnesisField;
  value?: unknown;
  onChange: (value: string[]) => void;
  disabled?: boolean;
  onFocus?: () => void;
}

export const SimpleListFieldInput: React.FC<SimpleListFieldInputProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  onFocus,
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Normalize, bound and sanitize current list of string items
  const items: string[] = useMemo(() => {
    if (!Array.isArray(value)) {
      if (typeof value === "string" && value.trim()) {
        const sanitized = sanitizeSingleLineInput(value, INPUT_LIMITS.formOptionLabel).trim();
        return sanitized ? [sanitized] : [];
      }
      return [];
    }

    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => sanitizeSingleLineInput(item, INPUT_LIMITS.formOptionLabel).trim())
      .filter((item) => item.length > 0)
      .slice(0, ANAMNESIS_OPTION_LIMIT);
  }, [value]);

  const isAtLimit = items.length >= ANAMNESIS_OPTION_LIMIT;

  const handleAddItem = useCallback(() => {
    if (disabled || isAtLimit) {
      return;
    }

    // Support comma or newline separated entries when typing or pasting
    const rawParts = inputValue.includes(",") || inputValue.includes("\n")
      ? inputValue.split(/[\n,]+/)
      : [inputValue];

    const currentLowerSet = new Set(items.map((item) => item.toLowerCase()));
    const toAdd: string[] = [];

    for (const part of rawParts) {
      const trimmed = sanitizeSingleLineInput(part, INPUT_LIMITS.formOptionLabel).trim();
      if (!trimmed) {
        continue;
      }

      const lowerTrimmed = trimmed.toLowerCase();
      if (!currentLowerSet.has(lowerTrimmed) && items.length + toAdd.length < ANAMNESIS_OPTION_LIMIT) {
        currentLowerSet.add(lowerTrimmed);
        toAdd.push(trimmed);
      }
    }

    if (toAdd.length > 0) {
      onChange([...items, ...toAdd]);
    }
    setInputValue("");
    inputRef.current?.focus();
  }, [disabled, inputValue, isAtLimit, items, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddItem();
      }
    },
    [handleAddItem]
  );

  const handleRemoveItem = useCallback((indexToRemove: number) => {
    if (disabled) return;
    const next = items.filter((_, idx) => idx !== indexToRemove);
    onChange(next);
  }, [disabled, items, onChange]);

  const buttonLabel = field.addButtonLabel?.trim() || "+ Adicionar item";
  const placeholderText = isAtLimit
    ? "Limite de itens atingido"
    : field.placeholder || "Escreva um item aqui...";

  return (
    <div className="w-full space-y-2.5">
      <FieldLabelWithHelp
        htmlFor={inputId}
        label={field.label}
        helpText={field.helpText}
        required={field.required}
      />

      {/* Input row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={inputId}
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            placeholder={placeholderText}
            disabled={disabled || isAtLimit}
            maxLength={INPUT_LIMITS.formOptionLabel * 3}
            className="w-full h-9 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled || !inputValue.trim() || isAtLimit}
          className="h-9 shrink-0 gap-1.5 px-3 font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{buttonLabel}</span>
        </Button>
      </div>

      {/* Badges / Chips list */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.map((item, index) => (
            <Badge
              key={`${item}_${index}`}
              variant="secondary"
              title={item}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-normal bg-secondary/70 hover:bg-secondary border border-border/50 text-foreground transition-all rounded-md max-w-full"
            >
              <span className="truncate max-w-[280px] sm:max-w-[400px]">{item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none"
                  aria-label={`Remover ${item}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
