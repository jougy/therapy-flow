import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Label } from "@/components/ui/label";

interface FieldLabelWithHelpProps {
  helpText?: string | null;
  label: string;
}

export const FieldLabelWithHelp = ({ helpText, label }: FieldLabelWithHelpProps) => {
  const [open, setOpen] = useState(false);
  const normalizedHelpText = helpText?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <Label>{label}</Label>
      {normalizedHelpText ? (
        <>
          <button
            type="button"
            aria-label={`Ajuda para ${label}`}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
          {open ? (
            <div
              role="dialog"
              className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md border bg-popover p-3 text-sm leading-relaxed text-popover-foreground shadow-md"
            >
              {normalizedHelpText}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
