import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CreditCard,
  FlaskConical,
  Loader2,
  MessageSquareHeart,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tags,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PersonalNotificationsButton from "@/components/PersonalNotificationsButton";
import { PlatformMobileDock } from "@/components/PlatformMobileDock";
import { SimulationDebugPanel } from "@/components/SimulationDebugPanel";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useRuntimeDebugEvents } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "./platform-api";

export interface PlatformNavItem {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
}

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  {
    id: "directory",
    path: "/platform/diretorio",
    label: "Diretório Mestre",
    icon: UsersRound,
  },
  {
    id: "forms",
    path: "/platform/formularios",
    label: "Biblioteca de Formulários",
    icon: BookOpen,
  },
  {
    id: "feedbacks",
    path: "/platform/feedbacks",
    label: "Feedbacks & Avaliações",
    icon: MessageSquareHeart,
  },
  {
    id: "news",
    path: "/platform/novidades",
    label: "Notas de Novidades",
    icon: Sparkles,
  },
  {
    id: "tags",
    path: "/platform/tags",
    label: "Gestão de Tags",
    icon: Tags,
  },
  {
    id: "flags",
    path: "/platform/flags",
    label: "Feature Flags",
    icon: SlidersHorizontal,
  },
  {
    id: "governance",
    path: "/platform/governanca",
    label: "Governança & Segurança",
    icon: ShieldAlert,
  },
  {
    id: "billing",
    path: "/platform/faturamento",
    label: "Faturamento & Webhooks",
    icon: CreditCard,
  },
];

interface PlatformLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  showNav?: boolean;
}

export const PlatformLayout = ({
  children,
  title = "Painel administrativo global",
  subtitle = "Busque clínicas, contas e pacientes; os detalhes, logs e ferramentas ficam em páginas dedicadas.",
  showNav = true,
}: PlatformLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { startPlatformClinicSimulation } = useAuth();
  const [startingSim, setStartingSim] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const debugEvents = useRuntimeDebugEvents();
  const errorCount = useMemo(() => debugEvents.filter((e) => e.type === "error").length, [debugEvents]);

  // Atalho global Cmd+Ctrl+D (Mac) ou Ctrl+Alt+D (Windows/Linux) para abrir painel de debug no backoffice
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

  const handleStartSimulation = async () => {
    if (!startPlatformClinicSimulation) return;
    setStartingSim(true);
    try {
      const access = await startPlatformClinicSimulation();
      navigate(`/clinica/${access.clinic.route_key}`);
    } catch (error) {
      toast({
        title: "Não foi possível iniciar a simulação",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setStartingSim(false);
    }
  };

  // Resolve current active tab ID from current pathname
  const currentTabId = React.useMemo(() => {
    const pathname = location.pathname;
    if (pathname.includes("/platform/feedbacks")) return "feedbacks";
    if (pathname.includes("/platform/novidades")) return "news";
    if (pathname.includes("/platform/tags")) return "tags";
    if (pathname.includes("/platform/flags")) return "flags";
    if (pathname.includes("/platform/governanca")) return "governance";
    if (pathname.includes("/platform/faturamento")) return "billing";
    return "directory";
  }, [location.pathname]);

  const handleDockTabChange = (tabId: string) => {
    const item = PLATFORM_NAV_ITEMS.find((t) => t.id === tabId);
    if (item) {
      navigate(item.path);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/branding/logo/pluri_health_icon_gradient.svg"
              alt="Pluri-Health"
              className="h-10 w-10 shrink-0 drop-shadow-xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pluri-Health</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PersonalNotificationsButton />
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">platform_owner</Badge>

            {/* Painel de Debug em Tempo Real */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-400/80 bg-amber-500/10 text-amber-950 dark:text-amber-200 hover:bg-amber-500/20 text-xs gap-1.5 font-bold shadow-xs"
              onClick={() => setDebugModalOpen(true)}
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

            <Button
              type="button"
              disabled={startingSim}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow-sm"
              onClick={() => void handleStartSimulation()}
            >
              {startingSim ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              <span>Simulação (Preview)</span>
            </Button>
            <Button variant="outline" onClick={() => navigate("/platform/diretorio")}>
              Painel mestre
            </Button>
            <Button variant="outline" onClick={() => navigate("/espacopessoal")}>
              Espaço pessoal
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 overflow-x-hidden pb-28 lg:pb-6">
        {showNav && (
          <div className="w-full">
            {/* Desktop & Tablet Top Horizontal Nav Bar */}
            <nav className="flex items-center gap-1.5 overflow-x-auto rounded-xl border bg-muted/30 p-1.5 shadow-sm scrollbar-none">
              {PLATFORM_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.id === "directory" && (location.pathname === "/platform" || location.pathname === "/platform/"));

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 select-none shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Mobile Bottom Floating Dock */}
            <PlatformMobileDock activeTab={currentTabId} onChange={handleDockTabChange} />
          </div>
        )}

        {children}
      </main>

      <SimulationDebugPanel open={debugModalOpen} onOpenChange={setDebugModalOpen} />
    </div>
  );
};
