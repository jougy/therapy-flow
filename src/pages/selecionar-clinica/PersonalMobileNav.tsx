import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { PersonalSection } from "./selecionarClinicaTypes";
import type { NavSectionItem } from "./PersonalDesktopNav";

export interface PersonalMobileNavProps {
  visibleSectionItems: NavSectionItem[];
  activeSection: PersonalSection;
  setActiveSection: (section: PersonalSection) => void;
  mobileDockExpanded: boolean;
  mobileDockPressedSection: PersonalSection | null;
  mobileDockPointerActive: boolean;
  mobileDockTooltip: { title: string; x: number } | null;
  onPointerDownButton: (event: React.PointerEvent<HTMLButtonElement>, section: NavSectionItem) => void;
  onTouchStartButton: (event: React.TouchEvent<HTMLButtonElement>, section: NavSectionItem) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  onFinishInteraction: () => void;
}

export function PersonalMobileNav({
  visibleSectionItems,
  activeSection,
  setActiveSection,
  mobileDockExpanded,
  mobileDockPressedSection,
  mobileDockPointerActive,
  mobileDockTooltip,
  onPointerDownButton,
  onTouchStartButton,
  onPointerMove,
  onTouchMove,
  onFinishInteraction,
}: PersonalMobileNavProps) {
  return (
    <div
      className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden"
      data-dock-state={mobileDockExpanded ? "medium" : "compact"}
      data-dock-pressing={mobileDockPointerActive ? "true" : "false"}
    >
      <div className="mx-auto max-w-screen-sm px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {mobileDockTooltip && (
          <span
            className="designlab-settings-mobile-floating-tooltip"
            style={{ "--mobile-dock-tooltip-x": `${mobileDockTooltip.x}px` } as CSSProperties}
          >
            {mobileDockTooltip.title}
          </span>
        )}
        <div
          className="designlab-settings-mobile-dock flex justify-center gap-1.5 overflow-visible pb-1"
          onPointerMove={onPointerMove}
          onTouchMove={onTouchMove}
          onPointerUp={onFinishInteraction}
          onPointerCancel={onFinishInteraction}
          onTouchEnd={onFinishInteraction}
          onTouchCancel={onFinishInteraction}
          onPointerLeave={() => {
            if (mobileDockPointerActive) {
              onFinishInteraction();
            }
          }}
        >
          {visibleSectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.value;
            const isPressed = mobileDockPressedSection === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                data-personal-mobile-section={item.value}
                className={cn(
                  "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5",
                  isActive && "is-active",
                  isPressed && "is-pressed"
                )}
                onPointerDown={(event) => onPointerDownButton(event, item)}
                onTouchStart={(event) => onTouchStartButton(event, item)}
                onClick={() => setActiveSection(item.value)}
              >
                <span
                  className={cn(
                    "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300",
                    isActive ? "border-primary/45 bg-primary/10 text-primary" : "border-border/80 bg-card/92 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300",
                      isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
