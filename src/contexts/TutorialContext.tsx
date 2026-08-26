import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getTutorialConfigForPath,
  TUTORIAL_CHAPTERS,
  TUTORIAL_REGISTRY,
  COMPONENT_HELP_REGISTRY,
  type PageTutorialConfig,
  type TutorialChapter,
  type TutorialStep,
  type TutorialLearnMoreAction,
  type HelpersFeatureFlagValue,
} from "@/components/tutorial/tutorial-registry";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

export type TutorialAnimation = "dance" | "pulse" | "bounce" | "glow";
export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

interface TutorialContextType {
  activeTutorial: PageTutorialConfig | null;
  activeTutorialId: string | null;
  activeChapter: TutorialChapter | null;
  activeChapterIndex: number;
  isMasterJourneyActive: boolean;
  isSingleHelpMode: boolean;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  isOpen: boolean;
  isPaused: boolean;
  isChapterModalOpen: boolean;
  setIsChapterModalOpen: (open: boolean) => void;
  completedTutorials: Record<string, boolean>;
  startTutorial: (tutorialId?: string, force?: boolean) => void;
  startChapter: (chapterId: string, force?: boolean) => void;
  startMasterJourney: (force?: boolean) => void;
  showComponentHelp: (stepOrConfig: Partial<TutorialStep> | TutorialStep[] | string) => void;
  executeLearnMoreAction: (action: TutorialLearnMoreAction) => void;
  canPermission: (permission?: string) => boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  handleTargetClick: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
  pauseTutorial: () => void;
  resumeTutorial: () => void;
  resetTutorial: (tutorialId: string) => void;
  resetAllTutorials: () => void;
  isTutorialCompleted: (tutorialId: string) => boolean;
  availableTutorialForCurrentRoute: PageTutorialConfig | null;
  completionPercentage: number;
  tutorialDemoPatientId: string | null;
  setTutorialDemoPatientId: (id: string | null) => void;
  cleanupTutorialDemoPatient: () => Promise<void>;
}

const STORAGE_KEY = "therapy_flow_tutorials_completed_chapters_v2";
const DEMO_PATIENT_STORAGE_KEY = "therapy_flow_tutorial_demo_patient_id";

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { flags, isFeatureEnabled } = useFeatureFlags();

  const canPermission = useCallback(
    (perm?: string) => {
      if (!perm) return true;
      if (!auth || typeof auth.can !== "function") return true;
      return auth.can(perm as any);
    },
    [auth]
  );

  const [completedTutorials, setCompletedTutorials] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const [tutorialDemoPatientId, setTutorialDemoPatientIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DEMO_PATIENT_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [activeTutorial, setActiveTutorial] = useState<PageTutorialConfig | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isMasterJourneyActive, setIsMasterJourneyActive] = useState(false);
  const [isSingleHelpMode, setIsSingleHelpMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

  const setTutorialDemoPatientId = useCallback((id: string | null) => {
    setTutorialDemoPatientIdState(id);
    try {
      if (id) {
        localStorage.setItem(DEMO_PATIENT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(DEMO_PATIENT_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Cleanup Demo Patient routine
  const cleanupTutorialDemoPatient = useCallback(async () => {
    const patientId = tutorialDemoPatientId || localStorage.getItem(DEMO_PATIENT_STORAGE_KEY);
    if (!patientId || patientId === "demo" || patientId.startsWith("mock-")) {
      setTutorialDemoPatientId(null);
      return;
    }

    try {
      // Delete any associated agenda events and clinical records for demo patient
      await supabase.from("agenda_events").delete().eq("patient_id", patientId);
      await supabase.from("patient_sessions").delete().eq("patient_id", patientId);
      await supabase.from("patients").delete().eq("id", patientId);

      setTutorialDemoPatientId(null);
      toast({
        title: "Limpeza de Demonstração Concluída 🧹",
        description: "O paciente hipotético de testes foi excluído. Sua clínica permanece limpa!",
      });
    } catch (err) {
      console.warn("Could not auto-delete tutorial demo patient:", err);
      setTutorialDemoPatientId(null);
    }
  }, [tutorialDemoPatientId, setTutorialDemoPatientId]);

  // Identify tutorial for current path
  const availableTutorialForCurrentRoute = useMemo(() => {
    return getTutorialConfigForPath(location.pathname);
  }, [location.pathname]);

  // Persist completed tutorials
  const saveCompleted = useCallback((nextCompleted: Record<string, boolean>) => {
    setCompletedTutorials(nextCompleted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCompleted));
    } catch {
      // ignore storage errors
    }
  }, []);

  const isTutorialCompleted = useCallback(
    (tutorialId: string) => {
      return Boolean(completedTutorials[tutorialId]);
    },
    [completedTutorials]
  );

  const activeChapter = useMemo(() => {
    if (!activeTutorial || isSingleHelpMode) return null;
    return TUTORIAL_CHAPTERS.find((c) => c.id === activeTutorial.pageId) ?? null;
  }, [activeTutorial, isSingleHelpMode]);

  const startChapter = useCallback(
    (chapterId: string, force = true) => {
      if (!isFeatureEnabled("tutorial_training_center")) {
        toast({
          title: "Recurso Indisponível",
          description: "A Central de Treinamento está temporariamente desativada nas Feature Flags.",
        });
        return;
      }

      const chapter = TUTORIAL_CHAPTERS.find((c) => c.id === chapterId);
      if (!chapter || chapter.steps.length === 0) return;

      if (chapter.requiredPermission && !canPermission(chapter.requiredPermission)) {
        toast({
          title: "Acesso Restrito ao Módulo 🔒",
          description: "Seu cargo operacional não possui permissão para acessar este módulo de treinamento.",
        });
        return;
      }

      if (!force && completedTutorials[chapter.id]) {
        return;
      }

      const filteredSteps = chapter.steps.filter((s) => canPermission(s.requiredPermission));
      if (filteredSteps.length === 0) return;

      const chapterIndex = TUTORIAL_CHAPTERS.findIndex((c) => c.id === chapterId);
      setActiveChapterIndex(chapterIndex >= 0 ? chapterIndex : 0);
      setIsSingleHelpMode(false);
      setActiveTutorial({
        pageId: chapter.id,
        title: chapter.title,
        description: chapter.description,
        badge: chapter.badge,
        steps: filteredSteps,
      });
      setCurrentStepIndex(0);
      setIsOpen(true);
      setIsPaused(false);
      setIsChapterModalOpen(false);
    },
    [completedTutorials, canPermission, isFeatureEnabled]
  );

  const showComponentHelp = useCallback(
    (stepOrConfig: Partial<TutorialStep> | TutorialStep[] | string) => {
      if (!isFeatureEnabled("system_helpers")) {
        return;
      }

      let resolvedSteps: TutorialStep[];

      if (typeof stepOrConfig === "string") {
        const helpersVal = flags["system_helpers"] as HelpersFeatureFlagValue | undefined;
        const customConfig = helpersVal?.helpers?.[stepOrConfig];

        // Se estiver explicitamente oculto, não abre
        if (customConfig?.hidden) {
          return;
        }

        const found = COMPONENT_HELP_REGISTRY[stepOrConfig];
        if (Array.isArray(found)) {
          resolvedSteps = [...found];
        } else if (found) {
          resolvedSteps = [found];
        } else {
          resolvedSteps = [
            {
              id: `help-${stepOrConfig}`,
              targetSelector: `[data-tutorial='${stepOrConfig}']`,
              title: "Ajuda do Componente 💡",
              description: "Este componente faz parte do fluxo operacional da clínica.",
              placement: "bottom",
              animation: "glow",
            },
          ];
        }

        // Aplica textos customizados se existirem
        if (customConfig && resolvedSteps.length > 0) {
          resolvedSteps = [
            {
              ...resolvedSteps[0],
              title: customConfig.title || resolvedSteps[0].title,
              description: customConfig.description || resolvedSteps[0].description,
              tip: customConfig.tip !== undefined ? customConfig.tip : resolvedSteps[0].tip,
            },
            ...resolvedSteps.slice(1),
          ];
        }
      } else if (Array.isArray(stepOrConfig)) {
        resolvedSteps = stepOrConfig;
      } else {
        resolvedSteps = [
          {
            id: stepOrConfig.id || "help-custom",
            targetSelector: stepOrConfig.targetSelector,
            title: stepOrConfig.title || "Ajuda do Componente 💡",
            description: stepOrConfig.description || "",
            tip: stepOrConfig.tip,
            actionPrompt: stepOrConfig.actionPrompt,
            requiresAction: stepOrConfig.requiresAction,
            interactive: stepOrConfig.interactive,
            placement: stepOrConfig.placement || "bottom",
            animation: stepOrConfig.animation || "glow",
            visualPreview: stepOrConfig.visualPreview,
            learnMoreAction: stepOrConfig.learnMoreAction,
            requiredPermission: stepOrConfig.requiredPermission,
            requiredRole: stepOrConfig.requiredRole,
            isDemoNotice: stepOrConfig.isDemoNotice,
          },
        ];
      }

      const filteredResolvedSteps = resolvedSteps.filter((s) => canPermission(s.requiredPermission));
      if (filteredResolvedSteps.length === 0) return;

      setIsSingleHelpMode(true);
      setIsMasterJourneyActive(false);
      setActiveTutorial({
        pageId: typeof stepOrConfig === "string" ? stepOrConfig : "component-help",
        title: filteredResolvedSteps[0]?.title || "Guia do Bloco 💡",
        description: filteredResolvedSteps[0]?.description || "",
        badge: filteredResolvedSteps.length > 1 ? "Guia do Bloco (?)" : "Ajuda Rápida (?)",
        steps: filteredResolvedSteps,
      });
      setCurrentStepIndex(0);
      setIsOpen(true);
      setIsPaused(false);
      setIsChapterModalOpen(false);
    },
    [canPermission, isFeatureEnabled, flags]
  );

  const startMasterJourney = useCallback(
    (force = true) => {
      if (!isFeatureEnabled("tutorial_training_center")) {
        toast({
          title: "Recurso Indisponível",
          description: "A Central de Treinamento está temporariamente desativada nas Feature Flags.",
        });
        return;
      }

      setIsMasterJourneyActive(true);
      setIsSingleHelpMode(false);
      const firstChapter = TUTORIAL_CHAPTERS[0];
      if (firstChapter) {
        startChapter(firstChapter.id, force);
      }
    },
    [startChapter]
  );

  const startTutorial = useCallback(
    (tutorialId?: string, force = true) => {
      if (tutorialId) {
        startChapter(tutorialId, force);
        return;
      }

      if (availableTutorialForCurrentRoute) {
        startChapter(availableTutorialForCurrentRoute.pageId, force);
      } else {
        setIsChapterModalOpen(true);
      }
    },
    [availableTutorialForCurrentRoute, startChapter]
  );

  const finishTutorial = useCallback(() => {
    if (activeTutorial && !isSingleHelpMode) {
      const nextCompleted = {
        ...completedTutorials,
        [activeTutorial.pageId]: true,
      };
      saveCompleted(nextCompleted);

      // If in Master Journey, advance to next chapter
      if (isMasterJourneyActive) {
        const nextChapterIndex = activeChapterIndex + 1;
        if (nextChapterIndex < TUTORIAL_CHAPTERS.length) {
          const nextChapter = TUTORIAL_CHAPTERS[nextChapterIndex];
          setActiveChapterIndex(nextChapterIndex);
          setActiveTutorial({
            pageId: nextChapter.id,
            title: nextChapter.title,
            description: nextChapter.description,
            badge: nextChapter.badge,
            steps: nextChapter.steps,
          });
          setCurrentStepIndex(0);
          return;
        } else {
          setIsMasterJourneyActive(false);
          // Cleanup demo patient at conclusion of master journey
          void cleanupTutorialDemoPatient();
        }
      }
    }
    setIsOpen(false);
    setActiveTutorial(null);
    setCurrentStepIndex(0);
    setIsSingleHelpMode(false);
  }, [activeTutorial, isSingleHelpMode, completedTutorials, isMasterJourneyActive, activeChapterIndex, saveCompleted, cleanupTutorialDemoPatient]);

  const executeLearnMoreAction = useCallback(
    (action: TutorialLearnMoreAction) => {
      if (action.actionType === "navigate_chapter" && action.targetId) {
        if (action.targetRoute) {
          navigate(action.targetRoute);
        }
        startChapter(action.targetId, true);
      } else if (action.actionType === "navigate_help" && action.targetId) {
        showComponentHelp(action.targetId);
      } else if (action.actionType === "navigate_route" && action.targetRoute) {
        navigate(action.targetRoute);
        finishTutorial();
      }
    },
    [navigate, startChapter, showComponentHelp, finishTutorial]
  );

  const skipTutorial = useCallback(() => {
    if (activeTutorial && !isSingleHelpMode) {
      saveCompleted({
        ...completedTutorials,
        [activeTutorial.pageId]: true,
      });
      // Cleanup demo patient if skipped
      void cleanupTutorialDemoPatient();
    }
    setIsMasterJourneyActive(false);
    setIsSingleHelpMode(false);
    setIsOpen(false);
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, [activeTutorial, isSingleHelpMode, completedTutorials, saveCompleted, cleanupTutorialDemoPatient]);

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;
    if (currentStepIndex < activeTutorial.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      finishTutorial();
    }
  }, [activeTutorial, currentStepIndex, finishTutorial]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (activeTutorial && index >= 0 && index < activeTutorial.steps.length) {
        setCurrentStepIndex(index);
      }
    },
    [activeTutorial]
  );

  const handleTargetClick = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const pauseTutorial = useCallback(() => setIsPaused(true), []);
  const resumeTutorial = useCallback(() => setIsPaused(false), []);

  const resetTutorial = useCallback(
    (tutorialId: string) => {
      const next = { ...completedTutorials };
      delete next[tutorialId];
      saveCompleted(next);
    },
    [completedTutorials, saveCompleted]
  );

  const resetAllTutorials = useCallback(() => {
    saveCompleted({});
    void cleanupTutorialDemoPatient();
  }, [saveCompleted, cleanupTutorialDemoPatient]);

  // Execute onBeforeStep if defined
  useEffect(() => {
    if (!isOpen || !activeTutorial) return;
    const step = activeTutorial.steps[currentStepIndex];
    if (step?.onBeforeStep) {
      void step.onBeforeStep();
    }
  }, [isOpen, activeTutorial, currentStepIndex]);

  const currentStep = useMemo(() => {
    if (!activeTutorial || !isOpen) return null;
    return activeTutorial.steps[currentStepIndex] ?? null;
  }, [activeTutorial, isOpen, currentStepIndex]);

  const totalSteps = activeTutorial ? activeTutorial.steps.length : 0;

  const completionPercentage = useMemo(() => {
    const totalChapters = TUTORIAL_CHAPTERS.length;
    if (totalChapters === 0) return 0;
    const completedCount = TUTORIAL_CHAPTERS.filter((c) => completedTutorials[c.id]).length;
    return Math.round((completedCount / totalChapters) * 100);
  }, [completedTutorials]);

  return (
    <TutorialContext.Provider
      value={{
        activeTutorial,
        activeTutorialId: activeTutorial?.pageId ?? null,
        activeChapter,
        activeChapterIndex,
        isMasterJourneyActive,
        isSingleHelpMode,
        currentStepIndex,
        currentStep,
        totalSteps,
        isOpen,
        isPaused,
        isChapterModalOpen,
        setIsChapterModalOpen,
        completedTutorials,
        startTutorial,
        startChapter,
        startMasterJourney,
        showComponentHelp,
        executeLearnMoreAction,
        canPermission,
        nextStep,
        prevStep,
        goToStep,
        handleTargetClick,
        skipTutorial,
        finishTutorial,
        pauseTutorial,
        resumeTutorial,
        resetTutorial,
        resetAllTutorials,
        isTutorialCompleted,
        availableTutorialForCurrentRoute,
        completionPercentage,
        tutorialDemoPatientId,
        setTutorialDemoPatientId,
        cleanupTutorialDemoPatient,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

const NOOP_TUTORIAL_CONTEXT: TutorialContextType = {
  activeTutorial: null,
  activeTutorialId: null,
  activeChapter: null,
  activeChapterIndex: 0,
  isMasterJourneyActive: false,
  isSingleHelpMode: false,
  currentStepIndex: 0,
  currentStep: null,
  totalSteps: 0,
  isOpen: false,
  isPaused: false,
  isChapterModalOpen: false,
  setIsChapterModalOpen: () => {},
  completedTutorials: {},
  startTutorial: () => {},
  startChapter: () => {},
  startMasterJourney: () => {},
  showComponentHelp: () => {},
  executeLearnMoreAction: () => {},
  canPermission: () => true,
  nextStep: () => {},
  prevStep: () => {},
  goToStep: () => {},
  handleTargetClick: () => {},
  skipTutorial: () => {},
  finishTutorial: () => {},
  pauseTutorial: () => {},
  resumeTutorial: () => {},
  resetTutorial: () => {},
  resetAllTutorials: () => {},
  isTutorialCompleted: () => false,
  availableTutorialForCurrentRoute: null,
  completionPercentage: 0,
  tutorialDemoPatientId: null,
  setTutorialDemoPatientId: () => {},
  cleanupTutorialDemoPatient: async () => {},
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    return NOOP_TUTORIAL_CONTEXT;
  }
  return context;
};
