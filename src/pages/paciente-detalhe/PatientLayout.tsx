import { Suspense, useCallback, useMemo, type FC } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, CalendarDays, ClipboardList, FolderOpen, Home, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingFeedback } from "@/components/ui/loading-feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientMobileDock, type PatientMobileTab } from "@/components/patients/PatientMobileDock";
import { PatientFilesProvider } from "@/contexts/PatientFilesContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { getClinicPatientPath } from "@/lib/patient-routing";
import { cn } from "@/lib/utils";
import { PatientGlobalModals } from "./PatientGlobalModals";
import { PatientHeaderBar } from "./PatientHeaderBar";
import { PatientTabSkeleton } from "./PatientTabSkeleton";
import { PatientWorkspaceProvider, usePatientWorkspace } from "./context/PatientWorkspaceContext";
import PatientOverviewPage from "./pages/PatientOverviewPage";

const prefetchSubRoute = (subpath: string) => {
  switch (subpath) {
    case "": void import("./pages/PatientOverviewPage"); break;
    case "atendimentos": void import("./pages/PatientSessionsPage"); break;
    case "agenda": void import("./pages/PatientAgendaPage"); break;
    case "pagamentos": void import("./pages/PatientPaymentsPage"); break;
    case "arquivos": void import("./pages/PatientFilesPage"); break;
    case "estatisticas": void import("./pages/PatientStatsPage"); break;
  }
};

const PatientLayoutShell: FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const outlet = useOutlet();
  const navigate = useNavigate();
  const location = useLocation();
  const { isFeatureEnabled } = useFeatureFlags();
  const ws = usePatientWorkspace();

  const patientRef = ws.patient || ws.id || "";
  const showFiles = isFeatureEnabled("storage_s3_integration");
  const showStats = isFeatureEnabled("dashboards_patient");

  const routeMobileTab = useMemo<PatientMobileTab>(() => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith("/atendimentos")) return "historico";
    if (p.endsWith("/agenda")) return "agenda_completa";
    if (p.endsWith("/pagamentos")) return "pagamentos";
    if (p.endsWith("/arquivos")) return "arquivos";
    if (p.endsWith("/estatisticas")) return "estatisticas";
    return "inicio";
  }, [location.pathname]);

  const handleMobileTabChange = useCallback((tab: PatientMobileTab) => {
    if (tab === "termos") { ws.setMobileTermsSheetOpen(true); return; }
    if (tab === "compartilhar") { ws.setMobileShareSheetOpen(true); return; }
    if (tab === "status") { ws.setMobileStatusSheetOpen(true); return; }
    if (tab === "resumo") { ws.setPatientInfoDialogOpen(true); return; }
    if (tab === "agendar") { ws.handleOpenPatientAgendaDialog(); return; }
    if (tab === "atender") { void ws.handleStartAttendanceNow(); return; }
    if (tab === "pagamentos" && !ws.canViewFinancialData) return;

    const subpathMap: Partial<Record<PatientMobileTab, string>> = {
      inicio: "",
      historico: "atendimentos",
      agenda_completa: "agenda",
      pagamentos: "pagamentos",
      arquivos: "arquivos",
      estatisticas: "estatisticas",
    };
    const subpath = subpathMap[tab];
    if (subpath !== undefined && patientRef) {
      navigate(getClinicPatientPath(ws.targetClinicKey, patientRef, subpath));
    }
  }, [navigate, patientRef, ws]);

  const navItems = useMemo(() => [
    { id: "overview", label: "Visão Geral", subpath: "", end: true, icon: Home, show: true },
    { id: "sessions", label: "Atendimentos", subpath: "atendimentos", end: false, icon: ClipboardList, show: true },
    { id: "agenda", label: "Agenda", subpath: "agenda", end: false, icon: CalendarDays, show: true },
    { id: "payments", label: "Pagamentos", subpath: "pagamentos", end: false, icon: Wallet, show: ws.canViewFinancialData },
    { id: "files", label: "Arquivos", subpath: "arquivos", end: false, icon: FolderOpen, show: showFiles },
    { id: "stats", label: "Estatísticas", subpath: "estatisticas", end: false, icon: BarChart3, show: showStats },
  ].filter((item) => item.show), [showFiles, showStats, ws.canViewFinancialData]);

  if (ws.loading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-28" /></div>
          </div>
          <div className="flex items-center gap-2"><Skeleton className="h-9 w-24 rounded-md" /><Skeleton className="h-9 w-32 rounded-md" /></div>
        </div>
        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6">
            <LoadingFeedback message="Carregando prontuário do paciente..." onRetry={() => void ws.invalidatePatientData(ws.realPatientId || ws.id)} />
          </CardContent>
        </Card>
        <PatientTabSkeleton />
      </div>
    );
  }

  if (!ws.patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

  return (
    <PatientFilesProvider patientId={ws.patient.id || ws.id!} clinicId={ws.clinicId}>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className="w-full max-w-full min-w-0 overflow-x-hidden space-y-4 sm:space-y-5 pb-24 md:pb-6"
      >
        <PatientHeaderBar navigate={navigate} />

        <nav
          aria-label="Seções do paciente"
          className="hidden md:flex w-full max-w-full min-w-0 items-center gap-1 overflow-x-auto touch-pan-x border-b border-border/70 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const to = getClinicPatientPath(ws.targetClinicKey, patientRef, item.subpath);
            return (
              <NavLink
                key={item.id}
                to={to}
                end={item.end}
                onMouseEnter={() => prefetchSubRoute(item.subpath)}
                onFocus={() => prefetchSubRoute(item.subpath)}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-lg",
                    isActive
                      ? "border-primary text-primary font-semibold bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/80 font-medium"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <Suspense fallback={<PatientTabSkeleton />}>
          {outlet ?? <PatientOverviewPage />}
        </Suspense>

        <PatientGlobalModals navigate={navigate} />

        <PatientMobileDock
          activeTab={
            ws.mobileTermsSheetOpen ? "termos"
              : ws.mobileShareSheetOpen ? "compartilhar"
              : ws.mobileStatusSheetOpen ? "status"
              : routeMobileTab
          }
          onTabChange={handleMobileTabChange}
          showFiles={showFiles}
          showStats={showStats}
          showPayments={ws.canViewFinancialData}
          pendingPaymentsCount={ws.pendingPaymentsCount}
        />
      </motion.div>
    </PatientFilesProvider>
  );
};

export const PatientLayout: FC = () => (
  <PatientWorkspaceProvider>
    <PatientLayoutShell />
  </PatientWorkspaceProvider>
);

export default PatientLayout;
