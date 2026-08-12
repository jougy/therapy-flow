import { useState, useMemo } from "react";
import { LogOut, ShieldCheck, Settings, FlaskConical, SlidersHorizontal, Smartphone, Monitor, UserCog } from "lucide-react";
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
import { SimulationFeatureFlagsModal } from "@/components/SimulationFeatureFlagsModal";
import { SimulationRolePermissionsModal } from "@/components/SimulationRolePermissionsModal";
import { MobileTouchSimulator } from "@/components/MobileTouchSimulator";
import { getClinicBrandName } from "@/lib/clinic-settings";
import { SubscriptionPlan } from "@/integrations/supabase/types";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAntiPrintProtection } from "@/hooks/useAntiPrintProtection";
import { AntiPrintOverlay } from "@/components/AntiPrintOverlay";
import { useGovernance } from "@/hooks/useGovernance";

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
  const [viewMode, setViewMode] = useState<"widescreen" | "mobile">("widescreen");

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
    location.pathname === "/configuracoes" && new URLSearchParams(location.search).get("origem") === "pessoal";

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

  const platformRoleLabels = {
    admin: "Administrador",
    assistant: "Assistente",
    estagiario: "Estagiário",
    owner: "Owner",
    professional: "Profissional",
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {isReadOnly && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 text-center shadow-inner flex items-center justify-center gap-2">
          <span>🔒 Modo Somente Leitura Ativo: Esta conta está temporariamente restrita a visualizações por motivos de governança.</span>
        </div>
      )}
      {!isPreviewIframe && (
        <header className="border-b bg-card shrink-0">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="flex items-center gap-3 text-left min-w-0"
              onClick={() => navigate(isPersonalOriginSettings ? "/espacopessoal" : clinicHomePath)}
              aria-label={isPersonalOriginSettings ? "Ir para o espaço pessoal" : `Ir para a página inicial da clínica ${clinicBrandName}`}
            >
              {clinic?.logo_url ? (
                <img src={clinic.logo_url} alt={`Logo da ${clinicBrandName}`} className="h-9 max-w-[140px] object-contain" />
              ) : (
                <span className="text-base sm:text-lg font-semibold text-foreground tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">{clinicBrandName}</span>
              )}
            </button>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <PersonalNotificationsButton />
              <ProfileAccountButton
                displayName={displayName}
                subtitle={clinicBrandName}
                avatarUrl={profile?.avatar_url}
                initials={initials}
                onClick={() => navigate(
                  isPersonalOriginSettings
                    ? "/configuracoes?secao=profile&origem=pessoal"
                    : `${clinicHomePath}/configuracoes?secao=profile`
                )}
              />
              {!isPersonalOriginSettings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="group/clinic-settings h-8 w-8 justify-center gap-0 overflow-hidden px-0 text-muted-foreground transition-[width,gap,padding,box-shadow,border-color,background-color,color,transform] duration-700 ease-in-out hover:text-foreground sm:hover:w-[144px] sm:hover:justify-start sm:hover:gap-2 sm:hover:px-3 sm:hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] sm:focus-visible:w-[144px] sm:focus-visible:justify-start sm:focus-visible:gap-2 sm:focus-visible:px-3"
                  onClick={() => navigate(`${clinicHomePath}/configuracoes?secao=clinic`)}
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
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
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

      {isPlatformSupportMode && !isPreviewIframe && (
        <div className="sticky top-0 z-40 flex flex-col gap-2.5 border-b border-amber-300 bg-amber-500/15 backdrop-blur-md px-4 py-2 text-sm text-amber-950 dark:text-amber-200 xl:flex-row xl:items-center xl:justify-between sm:px-6 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
              {isSimulationMode ? <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" /> : <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />}
              <span>{isSimulationMode ? "Modo Simulação Backoffice" : "Modo Suporte Ativo"} ({clinicBrandName})</span>
            </div>

            <div className="h-4 w-px bg-amber-300/60 hidden sm:block" />

            {/* Papéis Operacionais */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">Papel:</span>
              <Select
                value={platformAccess?.simulatedRole ?? "owner"}
                onValueChange={(value) => {
                  void setPlatformSupportRole?.(value as keyof typeof platformRoleLabels);
                }}
              >
                <SelectTrigger className="h-8 w-[140px] border-amber-300 bg-background text-foreground text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{platformRoleLabels.owner}</SelectItem>
                  <SelectItem value="admin">{platformRoleLabels.admin}</SelectItem>
                  <SelectItem value="professional">{platformRoleLabels.professional}</SelectItem>
                  <SelectItem value="assistant">{platformRoleLabels.assistant}</SelectItem>
                  <SelectItem value="estagiario">{platformRoleLabels.estagiario}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs gap-1"
                onClick={() => setRoleModalOpen(true)}
                title="Ajustar permissões do papel no simulador"
              >
                <UserCog className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Permissões</span>
                {activeRoleOverridesCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {activeRoleOverridesCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Tipo de Plano */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">Plano:</span>
              <Select
                value={subscriptionPlan ?? "clinic"}
                onValueChange={(value) => {
                  setPlatformSimulatedPlan?.(value as SubscriptionPlan);
                }}
              >
                <SelectTrigger className="h-8 w-[140px] border-amber-300 bg-background text-foreground text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">Solo (Individual)</SelectItem>
                  <SelectItem value="clinic">Clinic (Equipe)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feature Flags Trigger */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs gap-1.5"
              onClick={() => setFlagsModalOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Flags</span>
              {activeOverrideCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {activeOverrideCount}
                </span>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 xl:pt-0">
            {/* Viewport Mode Switcher */}
            <div className="inline-flex items-center p-0.5 border border-amber-300 rounded-lg bg-background">
              <Button
                type="button"
                variant={viewMode === "widescreen" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1 rounded-md"
                onClick={() => setViewMode("widescreen")}
                title="Visualização Widescreen / Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Horizontal</span>
              </Button>
              <Button
                type="button"
                variant={viewMode === "mobile" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1 rounded-md"
                onClick={() => setViewMode("mobile")}
                title="Visualização Mobile / Smartphone"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vertical (Mobile)</span>
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs"
              onClick={() => {
                void endPlatformClinicAccess?.().finally(() => navigate("/platform"));
              }}
            >
              Sair da Simulação
            </Button>
          </div>
        </div>
      )}

      {viewMode === "mobile" && isPlatformSupportMode && !isPreviewIframe ? (
        <MobileTouchSimulator iframeSrc={iframeSrc} />
      ) : (
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:px-8">
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

      {!isPreviewIframe && (
        <>
          <ReleaseNotesDialog />
          <TermsUpdatePromptModal />
        </>
      )}

      <AntiPrintOverlay isVisible={isBlurred} onDismiss={unblur} />
    </div>
  );
};

export default AppLayout;
