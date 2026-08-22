import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { Layers3, Loader2, Save, Upload, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormEditorMobileDockProps {
  saving: boolean;
  templateName: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  mobileInspectorOpen: boolean;
  setMobileInspectorOpen: (open: boolean) => void;
  selectedFieldId: string | null;
  handleSave: () => Promise<void>;
  onImportClick: () => void;
}

export const FormEditorMobileDock: React.FC<FormEditorMobileDockProps> = ({
  saving,
  templateName,
  mobileMenuOpen,
  setMobileMenuOpen,
  mobileInspectorOpen,
  setMobileInspectorOpen,
  selectedFieldId,
  handleSave,
  onImportClick,
}) => {
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedId, setMobileDockPressedId] = useState<string | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);

  const formMobileDockItems = [
    {
      value: "componentes",
      label: "Componentes",
      icon: Layers3,
      action: () => setMobileMenuOpen(true),
      disabled: false,
      isActive: mobileMenuOpen,
    },
    {
      value: "salvar",
      label: "Salvar",
      icon: saving ? Loader2 : Save,
      action: () => void handleSave(),
      disabled: saving || !templateName.trim(),
      isActive: saving,
    },
    {
      value: "importar",
      label: "Importar",
      icon: Upload,
      action: onImportClick,
      disabled: false,
      isActive: false,
    },
    {
      value: "fluxo",
      label: selectedFieldId ? "Propriedades" : "Fluxo",
      icon: Workflow,
      action: () => setMobileInspectorOpen(true),
      disabled: false,
      isActive: mobileInspectorOpen || !!selectedFieldId,
    },
  ];

  const updateMobileDockTooltipForButton = (button: HTMLButtonElement, title: string) => {
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
    const safeInset = 68;
    const x = Math.min(Math.max(rect.left + rect.width / 2, safeInset), Math.max(safeInset, viewportWidth - safeInset));
    setMobileDockTooltip({ title, x });
  };

  const finishMobileDockInteraction = () => {
    if (mobileDockPressedId) {
      const activeItem = formMobileDockItems.find((item) => item.value === mobileDockPressedId);
      if (activeItem && !activeItem.disabled) {
        activeItem.action();
      }
    }
    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedId(null);
    setMobileDockTooltip(null);
  };

  const updateMobileDockPressedSectionFromPoint = (clientX: number, clientY: number) => {
    if (!mobileDockPointerActive) return;

    const element = document.elementFromPoint(clientX, clientY);
    const button = element?.closest<HTMLButtonElement>("[data-form-mobile-section]");
    const sectionId = button?.dataset.formMobileSection;
    const section = formMobileDockItems.find((item) => item.value === sectionId);

    if (!button || !section) return;

    setMobileDockPressedId(section.value);
    updateMobileDockTooltipForButton(button, section.label);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }

      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        setMobileDockExpanded(false);
        setMobileDockPressedId(null);
        setMobileDockPointerActive(false);
        setMobileDockTooltip(null);
        mobileDockScrollResetTimerRef.current = null;
      }, 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }
    };
  }, []);

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
          onPointerMove={(event) => updateMobileDockPressedSectionFromPoint(event.clientX, event.clientY)}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (touch) {
              updateMobileDockPressedSectionFromPoint(touch.clientX, touch.clientY);
            }
          }}
          onPointerUp={finishMobileDockInteraction}
          onPointerCancel={finishMobileDockInteraction}
          onTouchEnd={finishMobileDockInteraction}
          onTouchCancel={finishMobileDockInteraction}
          onPointerLeave={() => {
            if (mobileDockPointerActive) {
              finishMobileDockInteraction();
            }
          }}
        >
          {formMobileDockItems.map((item) => {
            const Icon = item.icon;
            const isPressed = mobileDockPressedId === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                disabled={item.disabled}
                data-form-mobile-section={item.value}
                className={cn(
                  "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5 disabled:opacity-50",
                  item.isActive && "is-active",
                  isPressed && "is-pressed"
                )}
                onPointerDown={(event) => {
                  if (item.disabled) return;
                  setMobileDockExpanded(true);
                  setMobileDockPointerActive(true);
                  setMobileDockPressedId(item.value);
                  updateMobileDockTooltipForButton(event.currentTarget, item.label);
                }}
                onTouchStart={(event) => {
                  if (item.disabled) return;
                  const touch = event.touches[0];
                  if (!touch) return;

                  setMobileDockExpanded(true);
                  setMobileDockPointerActive(true);
                  setMobileDockPressedId(item.value);
                  updateMobileDockTooltipForButton(event.currentTarget, item.label);
                }}
                onClick={() => {
                  if (!item.disabled) item.action();
                }}
              >
                <span
                  className={cn(
                    "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300",
                    item.isActive
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-border/80 bg-card/92 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300",
                      item.isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", item.value === "salvar" && saving && "animate-spin")} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
