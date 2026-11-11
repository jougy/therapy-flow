import { useState, useRef, useEffect, useCallback } from "react";
import type { PersonalSection } from "./selecionarClinicaTypes";
import type { NavSectionItem } from "./PersonalDesktopNav";

export function usePersonalMobileDock(visibleSectionItems: NavSectionItem[]) {
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedSection, setMobileDockPressedSection] = useState<PersonalSection | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);

  const updateMobileDockTooltipForButton = useCallback((button: HTMLButtonElement, title: string) => {
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
    const safeInset = 68;
    const x = Math.min(Math.max(rect.left + rect.width / 2, safeInset), Math.max(safeInset, viewportWidth - safeInset));
    setMobileDockTooltip({ title, x });
  }, []);

  const finishMobileDockInteraction = useCallback(() => {
    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedSection(null);
    setMobileDockTooltip(null);
  }, []);

  const updateMobileDockPressedSectionFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!mobileDockPointerActive) {
        return;
      }

      const element = document.elementFromPoint(clientX, clientY);
      const button = element?.closest<HTMLButtonElement>("[data-personal-mobile-section]");
      const sectionId = button?.dataset.personalMobileSection as PersonalSection | undefined;
      const section = visibleSectionItems.find((item) => item.value === sectionId);

      if (!button || !section) {
        return;
      }

      setMobileDockPressedSection(section.value);
      updateMobileDockTooltipForButton(button, section.label);
    },
    [mobileDockPointerActive, updateMobileDockTooltipForButton, visibleSectionItems]
  );

  useEffect(() => {
    const handleScroll = () => {
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }

      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        setMobileDockExpanded(false);
        setMobileDockPressedSection(null);
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

  return {
    mobileDockExpanded,
    mobileDockPressedSection,
    mobileDockPointerActive,
    mobileDockTooltip,
    setMobileDockExpanded,
    setMobileDockPressedSection,
    setMobileDockPointerActive,
    updateMobileDockTooltipForButton,
    finishMobileDockInteraction,
    updateMobileDockPressedSectionFromPoint,
  };
}
