import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export interface HorizontalScrollNavigatorProps {
  clientWidth: number;
  markerStyles: CSSProperties[];
  onScrollLeft: () => void;
  onScrollRight: () => void;
  onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTrackPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTrackPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  scrollLeft: number;
  scrollWidth: number;
}

export const HorizontalScrollNavigator = ({
  markerStyles,
  onScrollLeft,
  onScrollRight,
  onTrackPointerDown,
  onTrackPointerMove,
  onTrackPointerUp,
  scrollLeft,
  scrollWidth,
  clientWidth,
}: HorizontalScrollNavigatorProps) => {
  const canScrollLeft = scrollLeft > 0;
  const canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
  const scrollableWidth = Math.max(scrollWidth - clientWidth, 0);
  const scrollRatio = scrollableWidth > 0 ? Math.max(0, Math.min(1, scrollLeft / scrollableWidth)) : 0;
  const thumbWidthValue =
    scrollWidth > clientWidth
      ? Math.min(100, Math.max(8, (clientWidth / Math.max(scrollWidth, 1)) * 100))
      : 100;
  const maxThumbLeft = Math.max(0, 100 - thumbWidthValue);
  const thumbLeft = `${scrollRatio * maxThumbLeft}%`;
  const thumbWidth = `${thumbWidthValue}%`;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border bg-background px-2 py-2 shadow-sm">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onScrollLeft}
        disabled={!canScrollLeft}
        aria-label="Rolar para a esquerda"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div
        className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-full border bg-muted/40"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
      >
        {markerStyles.map((style, index) => (
          <span key={index} className="absolute top-0 h-full rounded-full opacity-70" style={style} />
        ))}
        <span
          className="absolute top-0 h-full rounded-full border border-primary/50 bg-primary/10"
          style={{
            left: thumbLeft,
            width: thumbWidth,
          }}
        />
        <span
          className="pointer-events-none absolute top-0 h-full rounded-full border border-primary bg-primary/40 shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset] transition-transform"
          style={{
            left: thumbLeft,
            width: thumbWidth,
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onScrollRight}
        disabled={!canScrollRight}
        aria-label="Rolar para a direita"
      >
        <ArrowLeft className="h-4 w-4 rotate-180" />
      </Button>
    </div>
  );
};
