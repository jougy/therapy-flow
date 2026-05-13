import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLINIC_GROUP_COLOR_SLOT_COUNT,
  cmykToRgb,
  getReadableTextColor,
  hexToRgb,
  hsvToRgb,
  normalizeHexColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
  toRgbaString,
  type CmykColor,
  type HsvColor,
  type RgbColor,
} from "@/lib/group-colors";

export interface ClinicGroupColorSlot {
  alpha: number;
  color_hex: string;
  id: string;
  slot_index: number;
}

interface GroupColorPaletteFieldProps {
  defaultOpen?: boolean;
  onPaletteSave: (slotIndex: number, colorHex: string, alpha: number) => Promise<void> | void;
  onSelectSlot: (slot: ClinicGroupColorSlot) => void;
  previewColorHex: string;
  selectedSlotId: string | null;
  slots: ClinicGroupColorSlot[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildSlotList = (slots: ClinicGroupColorSlot[]) =>
  Array.from({ length: CLINIC_GROUP_COLOR_SLOT_COUNT }, (_, slotIndex) => slots.find((slot) => slot.slot_index === slotIndex) ?? null);

const parseNumberInput = (value: string, fallback: number, max: number) => {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? clamp(parsed, 0, max) : fallback;
};

const ColorEditor = ({
  availableSlots,
  editorSlotIndex,
  initialAlpha,
  initialHex,
  onCancel,
  onSave,
  open,
  setEditorSlotIndex,
}: {
  availableSlots: Array<ClinicGroupColorSlot | null>;
  editorSlotIndex: number;
  initialAlpha: number;
  initialHex: string;
  onCancel: () => void;
  onSave: (payload: { alpha: number; colorHex: string }) => void;
  open: boolean;
  setEditorSlotIndex: (slotIndex: number) => void;
}) => {
  const initialRgb = useMemo(() => hexToRgb(initialHex) ?? { r: 229, g: 231, b: 235 }, [initialHex]);
  const initialHsv = useMemo(() => rgbToHsv(initialRgb), [initialRgb]);
  const [hsv, setHsv] = useState<HsvColor>(initialHsv);
  const [alpha, setAlpha] = useState(initialAlpha);
  const [hexInput, setHexInput] = useState(initialHex.replace("#", ""));
  const [rgbInput, setRgbInput] = useState<RgbColor>(initialRgb);
  const [cmykInput, setCmykInput] = useState<CmykColor>(rgbToCmyk(initialRgb));
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextRgb = hexToRgb(initialHex) ?? { r: 229, g: 231, b: 235 };
    const nextHsv = rgbToHsv(nextRgb);
    setHsv(nextHsv);
    setAlpha(initialAlpha);
    setHexInput(initialHex.replace("#", ""));
    setRgbInput(nextRgb);
    setCmykInput(rgbToCmyk(nextRgb));
  }, [initialAlpha, initialHex, open]);

  const syncFromRgb = (nextRgb: RgbColor) => {
    const nextHex = rgbToHex(nextRgb);
    setRgbInput(nextRgb);
    setHexInput(nextHex.replace("#", ""));
    setCmykInput(rgbToCmyk(nextRgb));
    setHsv(rgbToHsv(nextRgb));
  };

  const syncFromHsv = (nextHsv: HsvColor) => {
    const nextRgb = hsvToRgb(nextHsv);
    const nextHex = rgbToHex(nextRgb);
    setHsv(nextHsv);
    setRgbInput(nextRgb);
    setHexInput(nextHex.replace("#", ""));
    setCmykInput(rgbToCmyk(nextRgb));
  };

  const handleBoardPointer = (clientX: number, clientY: number) => {
    if (!boardRef.current) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const saturation = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const value = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);

    syncFromHsv({ ...hsv, s: saturation, v: value });
  };

  const previewHex = `#${hexInput.padEnd(6, "0").slice(0, 6)}`;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edição de cores</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-medium">Seletor de Cor</p>
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div
                ref={boardRef}
                className="relative h-52 rounded-xl border cursor-crosshair overflow-hidden"
                style={{
                  backgroundColor: `hsl(${hsv.h} 100% 50%)`,
                  backgroundImage:
                    "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
                }}
                onPointerDown={(event) => {
                  handleBoardPointer(event.clientX, event.clientY);
                  const target = event.currentTarget;

                  const move = (moveEvent: PointerEvent) => handleBoardPointer(moveEvent.clientX, moveEvent.clientY);
                  const stop = () => {
                    target.removeEventListener("pointermove", move);
                    target.removeEventListener("pointerup", stop);
                    target.removeEventListener("pointercancel", stop);
                  };

                  target.addEventListener("pointermove", move);
                  target.addEventListener("pointerup", stop);
                  target.addEventListener("pointercancel", stop);
                }}
              >
                <div
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{
                    left: `${hsv.s}%`,
                    top: `${100 - hsv.v}%`,
                  }}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Matiz</Label>
                  <input
                    aria-label="Matiz"
                    className="h-3 w-full cursor-pointer appearance-none rounded-full border"
                    max={360}
                    min={0}
                    onChange={(event) => syncFromHsv({ ...hsv, h: Number(event.target.value) })}
                    style={{ background: "linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                    type="range"
                    value={hsv.h}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opacidade</Label>
                  <input
                    aria-label="Opacidade"
                    className="h-3 w-full cursor-pointer appearance-none rounded-full border"
                    max={100}
                    min={0}
                    onChange={(event) => setAlpha(Number(event.target.value))}
                    style={{
                      background: `linear-gradient(90deg, rgba(255,255,255,0), ${toRgbaString(previewHex, 100)})`,
                    }}
                    type="range"
                    value={alpha}
                  />
                </div>
                <div
                  className="h-16 rounded-xl border"
                  style={{
                    backgroundColor: toRgbaString(previewHex, alpha),
                    color: getReadableTextColor(previewHex),
                  }}
                >
                  <div className="flex h-full items-center justify-center text-sm font-medium">
                    Pré-visualização
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="group-color-hex">HEX</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">#</span>
                <Input
                  id="group-color-hex"
                  maxLength={6}
                  value={hexInput}
                  onChange={(event) => {
                    const nextHex = normalizeHexColor(`#${event.target.value}`);
                    setHexInput(event.target.value.toUpperCase());

                    if (nextHex) {
                      syncFromRgb(hexToRgb(nextHex)!);
                    }
                  }}
                />
              </div>
            </div>
            {(["r", "g", "b"] as const).map((channel) => (
              <div key={channel} className="space-y-2">
                <Label htmlFor={`group-color-${channel}`}>{channel.toUpperCase()}</Label>
                <Input
                  id={`group-color-${channel}`}
                  inputMode="numeric"
                  value={rgbInput[channel]}
                  onChange={(event) => {
                    const nextRgb = {
                      ...rgbInput,
                      [channel]: parseNumberInput(event.target.value, rgbInput[channel], 255),
                    };

                    syncFromRgb(nextRgb);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {(["c", "m", "y", "k"] as const).map((channel) => (
              <div key={channel} className="space-y-2">
                <Label htmlFor={`group-color-${channel}`}>{channel.toUpperCase()}</Label>
                <Input
                  id={`group-color-${channel}`}
                  inputMode="decimal"
                  value={cmykInput[channel]}
                  onChange={(event) => {
                    const nextCmyk = {
                      ...cmykInput,
                      [channel]: parseNumberInput(event.target.value, cmykInput[channel], 100),
                    };

                    setCmykInput(nextCmyk);
                    syncFromRgb(cmykToRgb(nextCmyk));
                  }}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="group-color-alpha">Opacidade %</Label>
              <Input
                id="group-color-alpha"
                inputMode="numeric"
                value={alpha}
                onChange={(event) => setAlpha(parseNumberInput(event.target.value, alpha, 100))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Cores salvas</p>
            <div className="grid grid-cols-7 gap-3 rounded-xl bg-muted/30 p-4">
              {availableSlots.map((slot, slotIndex) => (
                <button
                  key={slotIndex}
                  type="button"
                  aria-label={`Selecionar slot de cor ${slotIndex + 1}`}
                  aria-pressed={editorSlotIndex === slotIndex}
                  className={`h-8 rounded-md border transition ${editorSlotIndex === slotIndex ? "ring-2 ring-primary ring-offset-2" : ""} ${slot ? "hover:scale-105" : "bg-muted"}`}
                  onClick={() => setEditorSlotIndex(slotIndex)}
                  style={slot ? { backgroundColor: toRgbaString(slot.color_hex, slot.alpha) } : undefined}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave({ alpha, colorHex: rgbToHex(rgbInput) })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const GroupColorPaletteField = ({
  defaultOpen = false,
  onPaletteSave,
  onSelectSlot,
  previewColorHex,
  selectedSlotId,
  slots,
}: GroupColorPaletteFieldProps) => {
  const slotList = useMemo(() => buildSlotList(slots), [slots]);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSlotIndex, setEditorSlotIndex] = useState<number>(0);
  const [expanded, setExpanded] = useState(defaultOpen);

  const handleOpenEditor = () => {
    setEditorSlotIndex(selectedSlot?.slot_index ?? slots.find((slot) => slot)?.slot_index ?? 0);
    setEditorOpen(true);
  };

  const editorSlot = slotList[editorSlotIndex];

  return (
    <div className="rounded-xl border bg-card/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-5 w-5 shrink-0 rounded-full border"
            style={{ backgroundColor: toRgbaString(previewColorHex, 100) }}
          />
          <span className="truncate text-sm font-medium">{previewColorHex}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t px-4 py-4">
          <Button type="button" className="w-full sm:w-auto" onClick={handleOpenEditor}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Cor
          </Button>

          <div className="grid grid-cols-7 gap-3 rounded-xl bg-muted/30 p-4">
            {slotList.map((slot, slotIndex) => {
              const isSelected = slot?.id === selectedSlotId;

              return (
                <button
                  key={slotIndex}
                  type="button"
                  aria-label={slot ? `Selecionar cor salva ${slotIndex + 1}` : `Espaço vazio ${slotIndex + 1}`}
                  aria-pressed={isSelected}
                  className={`h-8 rounded-md border transition ${slot ? "cursor-pointer hover:scale-105" : "cursor-not-allowed bg-muted"} ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  disabled={!slot}
                  onClick={() => slot && onSelectSlot(slot)}
                  style={slot ? { backgroundColor: toRgbaString(slot.color_hex, slot.alpha) } : undefined}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <ColorEditor
        availableSlots={slotList}
        editorSlotIndex={editorSlotIndex}
        initialAlpha={editorSlot?.alpha ?? 100}
        initialHex={editorSlot?.color_hex ?? "#E5E7EB"}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onSave={async ({ alpha, colorHex }) => {
          await onPaletteSave(editorSlotIndex, colorHex, alpha);
          setEditorOpen(false);
        }}
        setEditorSlotIndex={setEditorSlotIndex}
      />
    </div>
  );
};
