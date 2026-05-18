import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type ColorCodeMode = "hex" | "rgb" | "cmyk";
type ColorDragMode = "triangle" | "wheel" | null;

const COLOR_WHEEL_SIZE = 240;
const COLOR_WHEEL_CENTER = COLOR_WHEEL_SIZE / 2;
const COLOR_WHEEL_RING_RADIUS = 98;
const TRIANGLE_POINTS = {
  white: { x: 120, y: 54 },
  hue: { x: 176, y: 164 },
  black: { x: 64, y: 164 },
};
const TRIANGLE_WHITE_HUE_MIDPOINT = {
  x: (TRIANGLE_POINTS.white.x + TRIANGLE_POINTS.hue.x) / 2,
  y: (TRIANGLE_POINTS.white.y + TRIANGLE_POINTS.hue.y) / 2,
};

const getHuePoint = (hue: number) => {
  const angle = (hue * Math.PI) / 180;

  return {
    x: COLOR_WHEEL_CENTER + Math.cos(angle) * COLOR_WHEEL_RING_RADIUS,
    y: COLOR_WHEEL_CENTER + Math.sin(angle) * COLOR_WHEEL_RING_RADIUS,
  };
};

const getTrianglePointFromHsv = ({ s, v }: HsvColor) => {
  const hueWeight = (v / 100) * (s / 100);
  const whiteWeight = (v / 100) * (1 - s / 100);
  const blackWeight = 1 - v / 100;

  return {
    x: TRIANGLE_POINTS.white.x * whiteWeight + TRIANGLE_POINTS.hue.x * hueWeight + TRIANGLE_POINTS.black.x * blackWeight,
    y: TRIANGLE_POINTS.white.y * whiteWeight + TRIANGLE_POINTS.hue.y * hueWeight + TRIANGLE_POINTS.black.y * blackWeight,
  };
};

const getTriangleBarycentric = (x: number, y: number) => {
  const { black, hue, white } = TRIANGLE_POINTS;
  const denominator = (black.y - hue.y) * (white.x - hue.x) + (hue.x - black.x) * (white.y - hue.y);
  const whiteWeight = ((black.y - hue.y) * (x - hue.x) + (hue.x - black.x) * (y - hue.y)) / denominator;
  const blackWeight = ((hue.y - white.y) * (x - hue.x) + (white.x - hue.x) * (y - hue.y)) / denominator;
  const hueWeight = 1 - whiteWeight - blackWeight;

  return { blackWeight, hueWeight, whiteWeight };
};

const getHsvFromTrianglePoint = (x: number, y: number, hue: number): HsvColor => {
  const barycentric = getTriangleBarycentric(x, y);
  const whiteWeight = clamp(barycentric.whiteWeight, 0, 1);
  const blackWeight = clamp(barycentric.blackWeight, 0, 1);
  const hueWeight = clamp(barycentric.hueWeight, 0, 1);
  const total = whiteWeight + blackWeight + hueWeight || 1;
  const normalizedWhite = whiteWeight / total;
  const normalizedBlack = blackWeight / total;
  const normalizedHue = hueWeight / total;
  const value = clamp((1 - normalizedBlack) * 100, 0, 100);
  const saturation = value > 0 ? clamp((normalizedHue / (normalizedHue + normalizedWhite)) * 100, 0, 100) : 0;

  return { h: hue, s: saturation, v: value };
};

const getHueFromWheelPoint = (x: number, y: number) => {
  const angle = Math.atan2(y - COLOR_WHEEL_CENTER, x - COLOR_WHEEL_CENTER);
  return Math.round((angle * 180) / Math.PI + 360) % 360;
};

const getHueMarkerRotation = (hue: number) => `translate(-50%, -50%) rotate(${hue + 90}deg)`;

const isInsideTriangle = (x: number, y: number) => {
  const barycentric = getTriangleBarycentric(x, y);

  return (
    barycentric.whiteWeight >= 0 &&
    barycentric.blackWeight >= 0 &&
    barycentric.hueWeight >= 0 &&
    barycentric.whiteWeight <= 1 &&
    barycentric.blackWeight <= 1 &&
    barycentric.hueWeight <= 1
  );
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
  const [codeMode, setCodeMode] = useState<ColorCodeMode>("hex");
  const dragModeRef = useRef<ColorDragMode>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);

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

  const getWheelPoint = (clientX: number, clientY: number) => {
    if (!wheelRef.current) {
      return null;
    }

    const rect = wheelRef.current.getBoundingClientRect();

    return {
      x: ((clientX - rect.left) / rect.width) * COLOR_WHEEL_SIZE,
      y: ((clientY - rect.top) / rect.height) * COLOR_WHEEL_SIZE,
    };
  };

  const handleWheelPointer = (clientX: number, clientY: number, dragMode: Exclude<ColorDragMode, null>) => {
    const point = getWheelPoint(clientX, clientY);

    if (!point) {
      return;
    }

    if (dragMode === "wheel") {
      syncFromHsv({ ...hsv, h: getHueFromWheelPoint(point.x, point.y) });
      return;
    }

    syncFromHsv(getHsvFromTrianglePoint(point.x, point.y, hsv.h));
  };

  const getDragModeFromPoint = (clientX: number, clientY: number): Exclude<ColorDragMode, null> => {
    const point = getWheelPoint(clientX, clientY);

    if (!point) {
      return "wheel";
    }

    return isInsideTriangle(point.x, point.y) ? "triangle" : "wheel";
  };

  const previewHex = `#${hexInput.padEnd(6, "0").slice(0, 6)}`;
  const trianglePoint = getTrianglePointFromHsv(hsv);
  const huePoint = getHuePoint(hsv.h);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edição de cores</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-medium">Seletor de Cor</p>
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="flex justify-center">
                <div
                  ref={wheelRef}
                  aria-label="Seletor triangular de cor"
                  className="relative aspect-square w-full max-w-[210px] touch-none select-none rounded-full"
                  onPointerDown={(event) => {
                    dragModeRef.current = getDragModeFromPoint(event.clientX, event.clientY);
                    handleWheelPointer(event.clientX, event.clientY, dragModeRef.current);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId) && dragModeRef.current) {
                      handleWheelPointer(event.clientX, event.clientY, dragModeRef.current);
                    }
                  }}
                  onPointerUp={(event) => {
                    dragModeRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={(event) => {
                    dragModeRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  role="slider"
                  style={{
                    background:
                      "conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  }}
                  tabIndex={0}
                >
                  <div className="absolute inset-[18%] rounded-full bg-background" />
                  <div
                    className="pointer-events-none absolute h-8 w-4 rounded-full border-2 border-white bg-white/35 shadow-[0_2px_8px_rgba(15,23,42,0.25)]"
                    style={{
                      left: `${(huePoint.x / COLOR_WHEEL_SIZE) * 100}%`,
                      top: `${(huePoint.y / COLOR_WHEEL_SIZE) * 100}%`,
                      transform: getHueMarkerRotation(hsv.h),
                    }}
                  />
                  <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${COLOR_WHEEL_SIZE} ${COLOR_WHEEL_SIZE}`}>
                    <defs>
                      <clipPath id="group-color-triangle-clip">
                        <polygon
                          points={`${TRIANGLE_POINTS.white.x},${TRIANGLE_POINTS.white.y} ${TRIANGLE_POINTS.hue.x},${TRIANGLE_POINTS.hue.y} ${TRIANGLE_POINTS.black.x},${TRIANGLE_POINTS.black.y}`}
                        />
                      </clipPath>
                      <linearGradient id="group-color-white-hue" x1={TRIANGLE_POINTS.white.x} y1={TRIANGLE_POINTS.white.y} x2={TRIANGLE_POINTS.hue.x} y2={TRIANGLE_POINTS.hue.y} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor={`hsl(${hsv.h} 100% 50%)`} />
                      </linearGradient>
                      <linearGradient
                        id="group-color-black-fade"
                        x1={TRIANGLE_POINTS.black.x}
                        y1={TRIANGLE_POINTS.black.y}
                        x2={TRIANGLE_WHITE_HUE_MIDPOINT.x}
                        y2={TRIANGLE_WHITE_HUE_MIDPOINT.y}
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0%" stopColor="#000000" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`${TRIANGLE_POINTS.white.x},${TRIANGLE_POINTS.white.y} ${TRIANGLE_POINTS.hue.x},${TRIANGLE_POINTS.hue.y} ${TRIANGLE_POINTS.black.x},${TRIANGLE_POINTS.black.y}`}
                      fill="url(#group-color-white-hue)"
                      stroke="rgba(15, 23, 42, 0.12)"
                      strokeWidth="1"
                    />
                    <rect
                      clipPath="url(#group-color-triangle-clip)"
                      fill="url(#group-color-black-fade)"
                      height={COLOR_WHEEL_SIZE}
                      width={COLOR_WHEEL_SIZE}
                      x="0"
                      y="0"
                    />
                    <circle
                      cx={trianglePoint.x}
                      cy={trianglePoint.y}
                      fill="none"
                      r="6"
                      stroke="#ffffff"
                      strokeWidth="3"
                    />
                    <circle cx={trianglePoint.x} cy={trianglePoint.y} fill="none" r="7" stroke="rgba(15, 23, 42, 0.35)" strokeWidth="1" />
                  </svg>
                </div>
              </div>
              <div className="space-y-4">
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

          <div className="rounded-xl border p-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-2 sm:w-40">
                  <Label htmlFor="group-color-code-mode">Código da cor</Label>
                  <Select value={codeMode} onValueChange={(value) => setCodeMode(value as ColorCodeMode)}>
                    <SelectTrigger id="group-color-code-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hex">HEX</SelectItem>
                      <SelectItem value="rgb">RGB</SelectItem>
                      <SelectItem value="cmyk">CMYK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {codeMode === "hex" ? (
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="group-color-hex">Valor HEX</Label>
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
                ) : null}

                {codeMode === "rgb" ? (
                  <div className="grid flex-1 grid-cols-3 gap-2">
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
                ) : null}

                {codeMode === "cmyk" ? (
                  <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
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
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
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
            <div className="grid grid-cols-7 gap-2 rounded-xl bg-muted/30 p-3 sm:gap-3 sm:p-4">
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
        <DialogFooter className="gap-2">
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
