import { useState, useMemo, useEffect } from "react";
import { LogOut, ShieldCheck, Settings, FlaskConical, SlidersHorizontal, Smartphone, Monitor, UserCog, UserPlus, Star, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ProfileAccountButton from "@/components/ProfileAccountButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PersonalNotificationsButton from "@/components/PersonalNotificationsButton";
import ReleaseNotesDialog from "@/components/ReleaseNotesDialog";
import { TermsUpdatePromptModal } from "@/components/TermsUpdatePromptModal";
import { UserFeedbackModal } from "@/components/UserFeedbackModal";
import { useFeedbackTrigger } from "@/hooks/useFeedbackTrigger";
import { SimulationFeatureFlagsModal } from "@/components/SimulationFeatureFlagsModal";
import { SimulationRolePermissionsModal } from "@/components/SimulationRolePermissionsModal";
import { SimulationGeneratePatientDialog } from "@/components/SimulationGeneratePatientDialog";
import { SimulationDebugPanel } from "@/components/SimulationDebugPanel";
import { useRuntimeDebugEvents } from "@/lib/runtime-debug";
import { MobileTouchSimulator } from "@/components/MobileTouchSimulator";
import { getClinicBrandName } from "@/lib/clinic-settings";
import { SubscriptionPlan } from "@/integrations/supabase/types";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAntiPrintProtection } from "@/hooks/useAntiPrintProtection";
import { AntiPrintOverlay } from "@/components/AntiPrintOverlay";
import { useGovernance } from "@/hooks/useGovernance";
import { TutorialTriggerButton } from "@/components/tutorial/TutorialTriggerButton";
import { SimulationTopDock } from "@/components/SimulationTopDock";
import { FreeTrialUsageBanner } from "@/components/FreeTrialUsageBanner";
import { TrialReadOnlyBanner } from "@/components/TrialReadOnlyBanner";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { clinic, endPlatformClinicAccess, leaveClinic, platformAccess, profile, setPlatformSupportRole, setPlatformSimulatedPlan, signOut, subscriptionPlan, simulatedRoleCapabilityOverrides = {} } = useAuth();
  const { flagOverrides } = useFeatureFlags();
  const location = useLocation();
  const navigate = useNavigate();
  
  useTelemetry();
  const { isBlurred, unblur } = useAntiPrintProtection();
  const { isReadOnly, isSuspended, suspensionReason } = useGovernance();
  
  const [flagsModalOpen, setFlagsModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [generatePatientModalOpen, setGeneratePatientModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const debugEvents = useRuntimeDebugEvents();
  const errorCount = useMemo(() => debugEvents.filter((e) => e.type === "error").length, [debugEvents]);

  const {
    isOpen: feedbackModalOpen,
    setIsOpen: setFeedbackModalOpen,
    triggerSource: feedbackTriggerSource,
    openManualFeedback,
  } = useFeedbackTrigger();
  const [viewMode, setViewMode] = useState<"widescreen" | "mobile">("widescreen");

  // Atalho global Cmd+Ctrl+D (Mac) ou Ctrl+Alt+D (Windows/Linux) para abrir painel de debug do backoffice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyD = e.key === "D" || e.key === "d";
      const isMacCmdCtrl = e.metaKey && e.ctrlKey && isKeyD;
      const isCtrlAlt = e.ctrlKey && e.altKey && isKeyD;
      if (isMacCmdCtrl || isCtrlAlt) {
        e.preventDefault();
        e.stopPropagation();
        setDebugModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isPreviewIframe = useMemo(() => {
    try {
      return (
        window.self !== window.top ||
        new URLSearchParams(location.search).get("is_preview_iframe") === "1"
      );
    } catch {
      return true;
    }
  }, [location.search]);

  const iframeSrc = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("is_preview_iframe", "1");
    return url.toString();
  }, [location.pathname, location.search]);

  const isPersonalOriginSettings =
    (location.pathname.startsWith("/configuracoes") && !location.pathname.startsWith("/clinica")) ||
    new URLSearchParams(location.search).get("origem") === "pessoal";

  const displayName = profile?.full_name || profile?.email || "Usuário";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const clinicBrandName = getClinicBrandName(clinic?.name);
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const isPlatformSupportMode = Boolean(platformAccess);
  const isSimulationMode = Boolean(platformAccess?.isSimulation);
  const activeOverrideCount = Object.keys(flagOverrides).length;
  const activeRoleOverridesCount = Object.keys(simulatedRoleCapabilityOverrides).length;

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {/* 1. Simulation Top Dock - Posicionada no topo absoluto */}
      {isPlatformSupportMode && !isPreviewIframe && (
        <SimulationTopDock
          clinicBrandName={clinicBrandName}
          isSimulationMode={isSimulationMode}
          simulatedRole={platformAccess?.simulatedRole ?? "owner"}
          onRoleChange={(role) => {
            void setPlatformSupportRole?.(role as any);
          }}
          subscriptionPlan={subscriptionPlan}
          onPlanChange={(plan) => {
            setPlatformSimulatedPlan?.(plan);
          }}
          activeRoleOverridesCount={activeRoleOverridesCount}
          onOpenRoleModal={() => setRoleModalOpen(true)}
          activeOverrideCount={activeOverrideCount}
          onOpenFlagsModal={() => setFlagsModalOpen(true)}
          errorCount={errorCount}
          onOpenDebugModal={() => setDebugModalOpen(true)}
          onOpenGeneratePatientModal={() => setGeneratePatientModalOpen(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onExitSimulation={() => {
            void endPlatformClinicAccess?.().finally(() => navigate("/platform"));
          }}
        />
      )}

      {isReadOnly && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 text-center shadow-inner flex items-center justify-center gap-2">
          <span>🔒 Modo Somente Leitura Ativo: Esta conta está temporariamente restrita a visualizações por motivos de governança.</span>
        </div>
      )}

      {/* 2. Header Principal */}
      {!isPreviewIframe && (
        <header className="border-b bg-card shrink-0">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="flex items-center gap-3 text-left min-w-0"
              onClick={() => navigate(isPersonalOriginSettings ? "/espacopessoal" : clinicHomePath)}
              aria-label={isPersonalOriginSettings ? "Ir para o espaço pessoal" : `Ir para a página inicial da clínica ${clinicBrandName}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {clinic?.logo_url && !isPersonalOriginSettings ? (
                  <img
                    src={clinic.logo_url}
                    alt={`Logo da ${clinicBrandName}`}
                    className="h-8 w-8 shrink-0 rounded-md object-contain border bg-card/60 p-0.5 shadow-2xs"
                  />
                ) : (
                  <img
                    src="/branding/logo/pluri_health_icon_gradient.svg"
                    alt="Pluri-Health"
                    className="h-8 w-8 shrink-0 drop-shadow-xs"
                  />
                )}
                <span className="text-base sm:text-lg font-semibold text-foreground tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                  {isPersonalOriginSettings ? "Pluri-Health" : clinicBrandName}
                </span>
              </div>
            </button>

            {/* Ações do Header: No mobile (< sm), estritamente Notificações. Tutorial, Feedback, Perfil, Configurações e Logout são ocultados no mobile */}
            <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
              <div className="hidden sm:block">
                <TutorialTriggerButton />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                onClick={openManualFeedback}
                aria-label="Dar feedback e avaliar a plataforma"
                title="Avaliar a plataforma"
              >
                <Star className="h-4 w-4 fill-amber-400/20 text-amber-500" />
              </Button>
              <PersonalNotificationsButton />
              <div className="hidden sm:inline-flex">
                <ProfileAccountButton
                  displayName={displayName}
                  subtitle={isPersonalOriginSettings ? (profile?.email || "Conta pessoal") : clinicBrandName}
                  avatarUrl={profile?.avatar_url}
                  initials={initials}
                  onClick={() => navigate(
                    isPersonalOriginSettings || !clinic?.route_key
                      ? "/configuracoes/pessoal/perfil"
                      : `${clinicHomePath}/configuracoes/pessoal/perfil`
                  )}
                />
              </div>
              {!isPersonalOriginSettings && clinic?.route_key && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex group/clinic-settings h-8 w-8 justify-center gap-0 overflow-hidden px-0 text-muted-foreground transition-[width,gap,padding,box-shadow,border-color,background-color,color,transform] duration-700 ease-in-out hover:text-foreground sm:hover:w-[144px] sm:hover:justify-start sm:hover:gap-2 sm:hover:px-3 sm:hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] sm:focus-visible:w-[144px] sm:focus-visible:justify-start sm:focus-visible:gap-2 sm:focus-visible:px-3"
                  onClick={() => navigate(`${clinicHomePath}/configuracoes/perfil`)}
                  aria-label="Editar Clínica"
                >
                  <Settings className="h-4 w-4 shrink-0 transition-transform duration-700 ease-in-out group-hover/clinic-settings:rotate-180 group-focus-visible/clinic-settings:rotate-180" />
                  <span className="hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/clinic-settings:ml-2 group-hover/clinic-settings:max-w-[10rem] group-hover/clinic-settings:opacity-100 group-focus-visible/clinic-settings:ml-2 group-focus-visible/clinic-settings:max-w-[10rem] group-focus-visible/clinic-settings:opacity-100 sm:inline">
                    Editar Clínica
                  </span>
                </Button>
              )}
              {isPersonalOriginSettings ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={signOut}
                  aria-label="Sair da conta"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Voltar ao painel pessoal"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Voltar ao painel pessoal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você encerrará seu acesso ativo à clínica {clinicBrandName} e voltará para a seleção de clínicas.
                        Isso libera a vaga de acesso simultâneo desta clínica, mas mantém seu login aberto no painel pessoal.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continuar na clínica</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          const exitAccess = isPlatformSupportMode && endPlatformClinicAccess
                            ? endPlatformClinicAccess
                            : leaveClinic;
                          void exitAccess().finally(() => navigate(isPlatformSupportMode ? "/platform" : "/espacopessoal"));
                        }}
                      >
                        {isPlatformSupportMode ? "Voltar ao painel global" : "Voltar e liberar acesso"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Banner de Modo Leitura para Teste Gratuito Expirado */}
      {!isPreviewIframe && <TrialReadOnlyBanner clinicId={clinic?.id} />}

      {/* Banner Informativo de Cota de Teste Grátis */}
      {!isPreviewIframe && <FreeTrialUsageBanner clinicId={clinic?.id} />}

      {viewMode === "mobile" && isPlatformSupportMode && !isPreviewIframe ? (
        <MobileTouchSimulator iframeSrc={iframeSrc} />
      ) : (
        <main className="min-w-0 flex-1 px-2 py-4 sm:p-6 lg:px-8">
          {children}
        </main>
      )}

      <SimulationFeatureFlagsModal
        open={flagsModalOpen}
        onOpenChange={setFlagsModalOpen}
      />

      <SimulationRolePermissionsModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
      />

      <SimulationGeneratePatientDialog
        open={generatePatientModalOpen}
        onOpenChange={setGeneratePatientModalOpen}
        clinicId={clinic?.id}
      />

      <SimulationDebugPanel
        open={debugModalOpen}
        onOpenChange={setDebugModalOpen}
      />

      {!isPreviewIframe && (
        <>
          <ReleaseNotesDialog />
          <TermsUpdatePromptModal />
          <UserFeedbackModal
            open={feedbackModalOpen}
            onOpenChange={setFeedbackModalOpen}
            triggerSource={feedbackTriggerSource}
          />
        </>
      )}

      <AntiPrintOverlay isVisible={isBlurred} onDismiss={unblur} />
    </div>
  );
};

export default AppLayout;
