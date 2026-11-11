import { useState, useMemo } from "react";
import {
  FlaskConical,
  ShieldCheck,
  UserCog,
  SlidersHorizontal,
  Zap,
  UserPlus,
  Monitor,
  Smartphone,
  LogOut,
  ChevronDown,
  Check,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubscriptionPlan } from "@/integrations/supabase/types";
import { SimulationAudienceMode } from "@/contexts/FeatureFlagsContext";
import {
  SimulationMobileRoleDialog,
  SimulationMobilePlanDialog,
  SimulationMobileAudienceDialog,
} from "./simulation";

interface SimulationTopDockProps {
  clinicBrandName: string;
  isSimulationMode: boolean;
  simulatedRole: string;
  onRoleChange: (role: string) => void;
  subscriptionPlan: SubscriptionPlan | null | undefined;
  onPlanChange: (plan: SubscriptionPlan) => void;
  audienceMode?: SimulationAudienceMode;
  onAudienceModeChange?: (mode: SimulationAudienceMode) => void;
  activeRoleOverridesCount: number;
  onOpenRoleModal: () => void;
  activeOverrideCount: number;
  onOpenFlagsModal: () => void;
  errorCount: number;
  onOpenDebugModal: () => void;
  onOpenGeneratePatientModal: () => void;
  viewMode: "widescreen" | "mobile";
  onViewModeChange: (mode: "widescreen" | "mobile") => void;
  onExitSimulation: () => void;
}

const platformRoleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Administrador",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário",
};

const platformPlanLabels: Record<string, string> = {
  solo: "Solo (Individual)",
  clinic: "Clinic (Equipe)",
};

export const SimulationTopDock = ({
  clinicBrandName,
  isSimulationMode,
  simulatedRole,
  onRoleChange,
  subscriptionPlan,
  onPlanChange,
  audienceMode = "tester",
  onAudienceModeChange,
  activeRoleOverridesCount,
  onOpenRoleModal,
  activeOverrideCount,
  onOpenFlagsModal,
  errorCount,
  onOpenDebugModal,
  onOpenGeneratePatientModal,
  viewMode,
  onViewModeChange,
  onExitSimulation,
}: SimulationTopDockProps) => {
  const [mobileRoleDialogOpen, setMobileRoleDialogOpen] = useState(false);
  const [mobilePlanDialogOpen, setMobilePlanDialogOpen] = useState(false);
  const [mobileAudienceDialogOpen, setMobileAudienceDialogOpen] = useState(false);

  // Floating tooltip for mobile long press
  const [mobileTooltip, setMobileTooltip] = useState<{ title: string; x: number } | null>(null);
  const longPressTimerRef = useMemo(() => ({ current: null as number | null }), []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>, title: string) => {
    clearLongPress();
    const touch = e.touches[0];
    if (!touch) return;
    const clientX = touch.clientX;
    longPressTimerRef.current = window.setTimeout(() => {
      setMobileTooltip({ title, x: clientX });
    }, 280);
  };

  const handleTouchEnd = () => {
    clearLongPress();
    setTimeout(() => {
      setMobileTooltip(null);
    }, 1200);
  };

  return (
    <>
      <div className="sticky top-0 z-40 w-full border-b border-amber-300/80 bg-amber-500/15 backdrop-blur-md shadow-xs px-3 sm:px-6 py-1.5 sm:py-2 text-sm text-amber-950 dark:text-amber-200">
        {/* Floating Tooltip Mobile */}
        {mobileTooltip && (
          <div
            className="fixed top-11 z-50 pointer-events-none -translate-x-1/2 rounded-full bg-amber-950/90 dark:bg-amber-900/95 px-3 py-1 text-xs font-semibold text-amber-100 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 duration-150"
            style={{ left: `${Math.max(60, Math.min(window.innerWidth - 60, mobileTooltip.x))}px` }}
          >
            {mobileTooltip.title}
          </div>
        )}

        {/* --- MOBILE VIEW: Scrollable Horizontal Dock (< md) --- */}
        <div className="flex md:hidden items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0 pr-1 border-r border-amber-300/60 font-semibold text-xs text-amber-900 dark:text-amber-300">
            {isSimulationMode ? (
              <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span className="truncate max-w-[100px]">{clinicBrandName}</span>
          </div>

          <div
            className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5"
            onTouchMove={clearLongPress}
          >
            {/* Papel Button */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs font-medium text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
              onClick={() => setMobileRoleDialogOpen(true)}
              onTouchStart={(e) => handleTouchStart(e, "Papel Simulado")}
              onTouchEnd={handleTouchEnd}
              aria-label="Selecionar Papel Simulado"
            >
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Papel:</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {platformRoleLabels[simulatedRole] || simulatedRole}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
            </button>

            {/* Permissões */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
              onClick={onOpenRoleModal}
              onTouchStart={(e) => handleTouchStart(e, "Permissões do Papel")}
              onTouchEnd={handleTouchEnd}
              aria-label="Ajustar Permissões do Papel"
            >
              <UserCog className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              {activeRoleOverridesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {activeRoleOverridesCount}
                </span>
              )}
            </button>

            {/* Plano Button */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs font-medium text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
              onClick={() => setMobilePlanDialogOpen(true)}
              onTouchStart={(e) => handleTouchStart(e, "Plano Simulado")}
              onTouchEnd={handleTouchEnd}
              aria-label="Selecionar Plano Simulado"
            >
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Plano:</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {subscriptionPlan === "solo" ? "Solo" : "Clinic"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
            </button>

            {/* Visão de Público Mobile */}
            {isSimulationMode && onAudienceModeChange && (
              <button
                type="button"
                className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs font-medium text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
                onClick={() => setMobileAudienceDialogOpen(true)}
                onTouchStart={(e) => handleTouchStart(e, "Visão Tester vs Comum")}
                onTouchEnd={handleTouchEnd}
                aria-label="Alternar Visão Tester vs Comum"
              >
                {audienceMode === "tester" ? (
                  <FlaskConical className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Users className="h-3 w-3 text-neutral-600 dark:text-neutral-400" />
                )}
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  {audienceMode === "tester" ? "Tester" : "Comum"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </button>
            )}

            {/* Flags */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
              onClick={onOpenFlagsModal}
              onTouchStart={(e) => handleTouchStart(e, "Feature Flags")}
              onTouchEnd={handleTouchEnd}
              aria-label="Ajustar Feature Flags"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeOverrideCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {activeOverrideCount}
                </span>
              )}
            </button>

            {/* Debug */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-amber-500/10 border border-amber-400/80 text-xs font-bold text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
              onClick={onOpenDebugModal}
              onTouchStart={(e) => handleTouchStart(e, "Diagnóstico & Debug")}
              onTouchEnd={handleTouchEnd}
              aria-label="Abrir Diagnóstico e Debug"
            >
              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-400/20 animate-pulse" />
              {errorCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                  {errorCount}
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>

            {/* Paciente Teste */}
            {isSimulationMode && (
              <button
                type="button"
                className="flex items-center gap-1 h-7 px-2 rounded-lg bg-background/90 border border-amber-300 text-xs text-amber-950 dark:text-amber-200 shrink-0 active:scale-95 transition-transform"
                onClick={onOpenGeneratePatientModal}
                onTouchStart={(e) => handleTouchStart(e, "Gerar Paciente Teste")}
                onTouchEnd={handleTouchEnd}
                aria-label="Gerar Novo Paciente Teste"
              >
                <UserPlus className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
              </button>
            )}

            {/* Viewport switch */}
            <button
              type="button"
              className={`flex items-center gap-1 h-7 px-2 rounded-lg border border-amber-300 text-xs shrink-0 active:scale-95 transition-transform ${
                viewMode === "mobile" ? "bg-amber-600 text-white border-amber-600" : "bg-background/90 text-amber-950 dark:text-amber-200"
              }`}
              onClick={() => onViewModeChange(viewMode === "mobile" ? "widescreen" : "mobile")}
              onTouchStart={(e) => handleTouchStart(e, "Alternar Viewport Mobile/Desktop")}
              onTouchEnd={handleTouchEnd}
              aria-label="Alternar Viewport Mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>

            {/* Sair */}
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold shrink-0 active:scale-95 transition-transform"
              onClick={onExitSimulation}
              onTouchStart={(e) => handleTouchStart(e, "Sair da Simulação")}
              onTouchEnd={handleTouchEnd}
              aria-label="Encerrar Simulação"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* --- DESKTOP VIEW (>= md) --- */}
        <div className="hidden md:flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
              {isSimulationMode ? (
                <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span>
                {isSimulationMode ? "Modo Simulação Backoffice" : "Modo Suporte Ativo"} ({clinicBrandName})
              </span>
            </div>

            <div className="h-4 w-px bg-amber-300/60" />

            {/* Papéis Operacionais */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
                Papel:
              </span>
              <Select value={simulatedRole} onValueChange={onRoleChange}>
                <SelectTrigger className="h-8 w-[140px] border-amber-300 bg-background text-foreground text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(platformRoleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs gap-1"
                onClick={onOpenRoleModal}
                title="Ajustar permissões do papel no simulador"
              >
                <UserCog className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Permissões</span>
                {activeRoleOverridesCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {activeRoleOverridesCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Tipo de Plano */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
                Plano:
              </span>
              <Select
                value={subscriptionPlan ?? "clinic"}
                onValueChange={(value) => onPlanChange(value as SubscriptionPlan)}
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

            {/* Visão de Público: Tester vs Usuário Comum */}
            {isSimulationMode && onAudienceModeChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
                  Visão:
                </span>
                <Select
                  value={audienceMode}
                  onValueChange={(value) => onAudienceModeChange(value as SimulationAudienceMode)}
                >
                  <SelectTrigger className="h-8 w-[145px] border-amber-300 bg-background text-foreground text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tester" className="text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                        <FlaskConical className="h-3.5 w-3.5" />
                        <span>Tester (Todos)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="common" className="text-xs">
                      <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                        <Users className="h-3.5 w-3.5" />
                        <span>Comum (Padrão)</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Feature Flags */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs gap-1.5"
              onClick={onOpenFlagsModal}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Flags</span>
              {activeOverrideCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {activeOverrideCount}
                </span>
              )}
            </Button>

            {/* Debug */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-amber-400/80 bg-amber-500/10 text-amber-950 dark:text-amber-200 hover:bg-amber-500/20 text-xs gap-1.5 font-bold shadow-xs"
              onClick={onOpenDebugModal}
              title="Abrir Painel de Diagnóstico e Debug em Tempo Real (Atalho: Cmd+Ctrl+D / Ctrl+Alt+D)"
            >
              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-400/20 animate-pulse" />
              <span>Debug</span>
              {errorCount > 0 ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                  {errorCount}
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Sistema saudável" />
              )}
            </Button>

            {/* Gerador de Paciente Teste */}
            {isSimulationMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs gap-1.5 font-medium"
                onClick={onOpenGeneratePatientModal}
                title="Gerar paciente fictício com dados válidos para teste"
              >
                <UserPlus className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                <span>+ Paciente Teste</span>
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 xl:pt-0">
            {/* Viewport Mode Switcher */}
            <div className="inline-flex items-center p-0.5 border border-amber-300 rounded-lg bg-background">
              <Button
                type="button"
                variant={viewMode === "widescreen" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1 rounded-md"
                onClick={() => onViewModeChange("widescreen")}
                title="Visualização Widescreen / Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Horizontal</span>
              </Button>
              <Button
                type="button"
                variant={viewMode === "mobile" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1 rounded-md"
                onClick={() => onViewModeChange("mobile")}
                title="Visualização Mobile / Smartphone"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Vertical (Mobile)</span>
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-amber-300 bg-background text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs"
              onClick={onExitSimulation}
            >
              Sair da Simulação
            </Button>
          </div>
        </div>
      </div>

      {/* Touch-Friendly Mobile Role Selection Modal */}
      <SimulationMobileRoleDialog
        open={mobileRoleDialogOpen}
        onOpenChange={setMobileRoleDialogOpen}
        simulatedRole={simulatedRole}
        onRoleChange={onRoleChange}
      />

      {/* Touch-Friendly Mobile Plan Selection Modal */}
      <SimulationMobilePlanDialog
        open={mobilePlanDialogOpen}
        onOpenChange={setMobilePlanDialogOpen}
        subscriptionPlan={subscriptionPlan}
        onPlanChange={onPlanChange}
      />

      {/* Touch-Friendly Mobile Audience Selection Modal */}
      {isSimulationMode && onAudienceModeChange && (
        <SimulationMobileAudienceDialog
          open={mobileAudienceDialogOpen}
          onOpenChange={setMobileAudienceDialogOpen}
          audienceMode={audienceMode}
          onAudienceModeChange={onAudienceModeChange}
        />
      )}
    </>
  );
};
