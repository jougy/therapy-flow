import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TutorialProvider, useTutorial } from "../../contexts/TutorialContext";
import { TUTORIAL_CHAPTERS, TUTORIAL_REGISTRY, getTutorialConfigForPath } from "./tutorial-registry";
import React from "react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Tutorial Module - Core Engine, Chapters & Master Journey", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should have 9 registered chapters with steps and metadata", () => {
    expect(TUTORIAL_CHAPTERS.length).toBe(9);
    expect(TUTORIAL_CHAPTERS[0].id).toBe("espaco-pessoal");
    expect(TUTORIAL_CHAPTERS[1].id).toBe("home-clinica");
    expect(TUTORIAL_CHAPTERS[2].id).toBe("novo-paciente");
    expect(TUTORIAL_CHAPTERS[3].id).toBe("card-paciente");
    expect(TUTORIAL_CHAPTERS[4].id).toBe("agenda-gestao");
    expect(TUTORIAL_CHAPTERS[5].id).toBe("relogio-cores");
    expect(TUTORIAL_CHAPTERS[6].id).toBe("prontuario-paciente");
    expect(TUTORIAL_CHAPTERS[7].id).toBe("registro-sessao");
    expect(TUTORIAL_CHAPTERS[8].id).toBe("dashboard-configuracoes");

    TUTORIAL_CHAPTERS.forEach((ch) => {
      expect(ch.steps.length).toBeGreaterThan(0);
      expect(ch.title).toBeDefined();
    });
  });

  it("should correctly resolve paths to tutorial configs via getTutorialConfigForPath", () => {
    expect(getTutorialConfigForPath("/")?.pageId).toBe("espaco-pessoal");
    expect(getTutorialConfigForPath("/clinica/123")?.pageId).toBe("home-clinica");
    expect(getTutorialConfigForPath("/clinica/123/pacientes/456")?.pageId).toBe("prontuario-paciente");
    expect(getTutorialConfigForPath("/clinica/123/pacientes/456/sessao/789")?.pageId).toBe("registro-sessao");
    expect(getTutorialConfigForPath("/clinica/123/configuracoes")?.pageId).toBe("dashboard-configuracoes");
  });

  it("should initialize with tutorial closed and default state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/clinica/123"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeTutorial).toBeNull();
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentStep).toBeNull();
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.completionPercentage).toBe(0);
  });

  it("should start a specific chapter correctly and track activeChapter", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startChapter("card-paciente");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeTutorial?.pageId).toBe("card-paciente");
    expect(result.current.activeChapter?.id).toBe("card-paciente");
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.totalSteps).toBeGreaterThan(0);
  });

  it("should start Master Journey from Chapter 1 and advance through steps", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startMasterJourney();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isMasterJourneyActive).toBe(true);
    expect(result.current.activeChapter?.id).toBe("espaco-pessoal");

    // Advance step via target click
    act(() => {
      result.current.handleTargetClick();
    });
    expect(result.current.currentStepIndex).toBe(1);
  });

  it("should open and close the Chapter Selection Modal", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    expect(result.current.isChapterModalOpen).toBe(false);

    act(() => {
      result.current.setIsChapterModalOpen(true);
    });

    expect(result.current.isChapterModalOpen).toBe(true);

    act(() => {
      result.current.setIsChapterModalOpen(false);
    });

    expect(result.current.isChapterModalOpen).toBe(false);
  });

  it("should complete chapters and update completion percentage correctly", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.startChapter("espaco-pessoal");
    });

    act(() => {
      result.current.finishTutorial();
    });

    expect(result.current.isTutorialCompleted("espaco-pessoal")).toBe(true);
    // 1 chapter completed out of 9 = 11%
    expect(result.current.completionPercentage).toBeGreaterThanOrEqual(11);
  });

  it("should trigger showComponentHelp for composite blocks with multi-step breakdown", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.showComponentHelp("agenda-widget");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isSingleHelpMode).toBe(true);
    expect(result.current.totalSteps).toBe(6);
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentStep?.title).toContain("Agenda Integrada da Clínica");
    expect(result.current.currentStep?.targetSelector).toBe("[data-tutorial='agenda-widget']");

    // Advance to Step 2 (Navigation arrows)
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.currentStep?.targetSelector).toBe("[data-tutorial='agenda-nav-arrows']");

    // Advance to Step 3 (Date picker button)
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(2);
    expect(result.current.currentStep?.targetSelector).toBe("[data-tutorial='agenda-date-picker-btn']");
  });

  it("should trigger showComponentHelp with custom inline config", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/"]}>
        <TutorialProvider>{children}</TutorialProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useTutorial(), { wrapper });

    act(() => {
      result.current.showComponentHelp({
        title: "Ajuda Personalizada",
        description: "Explicação sobre este componente customizado.",
        targetSelector: "[data-test='custom']",
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isSingleHelpMode).toBe(true);
    expect(result.current.totalSteps).toBe(1);
    expect(result.current.currentStep?.title).toBe("Ajuda Personalizada");
    expect(result.current.currentStep?.description).toBe("Explicação sobre este componente customizado.");
  });
});

