import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_FIELD_PLACEHOLDER, formatDateValue, normalizeDateInput, parseDateInput } from "@/lib/date-field";

type DateFieldInputProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export const DateFieldInput = ({ value, onChange, disabled = false, placeholder = DATE_FIELD_PLACEHOLDER, id }: DateFieldInputProps) => {
  const [open, setOpen] = useState(false);
  const normalizedValue = typeof value === "string" ? normalizeDateInput(value) : "";
  const selectedDate = useMemo(() => parseDateInput(normalizedValue), [normalizedValue]);

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={normalizedValue}
        onChange={(event) => onChange(normalizeDateInput(event.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-12"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Abrir calendário"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selectedDate ?? undefined}
            defaultMonth={selectedDate ?? new Date()}
            onSelect={(date) => {
              onChange(date ? formatDateValue(date) : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
