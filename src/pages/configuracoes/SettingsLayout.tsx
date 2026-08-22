import { useState, useRef, useMemo, CSSProperties } from "react";
import {
  BellRing,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  MessageCircle,
  Pin,
  Settings,
  Shield,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsNavSection = {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
  path: string;
  space: "clinic" | "personal";
};

export const SettingsLayout = () => {
  const { clinicKey } = useParams<{ clinicKey: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Menu retrátil / fixo (padrão desafixado para dar máxima largura à tela e conforto visual)
  const [pinnedMenu, setPinnedMenu] = useState(false);

  // Mobile Dock gesture state
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedSection, setMobileDockPressedSection] = useState<string | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const mobileDockGestureRef = useRef<{
    button: HTMLButtonElement;
    clientX: number;
    clientY: number;
    pointerId: number;
    sectionId: string;
    title: string;
  } | null>(null);

  const basePath = clinicKey ? `/clinica/${clinicKey}/configuracoes` : "/configuracoes";

  // Identifica automaticamente se a sub-rota atual é do espaço pessoal ou da clínica
  const isPersonalSpace = location.pathname.includes("/pessoal/") || location.pathname.includes("/suporte");

  const clinicNavSections: SettingsNavSection[] = useMemo(
    () => [
      {
        id: "perfil",
        title: "Perfil da clínica",
        description: "Edite os dados institucionais, logotipo e endereço.",
        icon: Building2,
        path: `${basePath}/perfil`,
        space: "clinic",
      },
      {
        id: "equipe",
        title: "Colaboradores e acessos",
        description: "Convites, gestão de membros e papéis operacionais.",
        icon: UsersRound,
        path: `${basePath}/equipe`,
        space: "clinic",
      },
      {
        id: "seguranca",
        title: "Segurança da clínica",
        description: "Sessões ativas, integridade de dados e auditoria.",
        icon: ShieldCheck,
        path: `${basePath}/seguranca`,
        space: "clinic",
      },
      {
        id: "assinatura",
        title: "Assinatura e pagamentos",
        description: "Plano contratado, faturas e capacidade de acessos.",
        icon: CreditCard,
        path: `${basePath}/assinatura`,
        space: "clinic",
      },
      {
        id: "tesouraria",
        title: "Tesouraria",
        description: "Configurações financeiras e dados bancários.",
        icon: Wallet,
        path: `${basePath}/tesouraria`,
        space: "clinic",
      },
      {
        id: "formularios",
        title: "Gerenciar formulários",
        description: "Fichas de anamnese e templates clínicos.",
        icon: ClipboardList,
        path: `${basePath}/formularios`,
        space: "clinic",
      },
    ],
    [basePath]
  );

  const personalNavSections: SettingsNavSection[] = useMemo(
    () => [
      {
        id: "pessoal-perfil",
        title: "Perfil pessoal",
        description: "Dados pessoais da sua identidade global.",
        icon: UserRound,
        path: `${basePath}/pessoal/perfil`,
        space: "personal",
      },
      {
        id: "pessoal-seguranca",
        title: "Segurança pessoal",
        description: "Senha de acesso e proteções da conta.",
        icon: Shield,
        path: `${basePath}/pessoal/seguranca`,
        space: "personal",
      },
      {
        id: "pessoal-notificacoes",
        title: "Alertas & Notificações",
        description: "Avisos por e-mail, sons e preferências.",
        icon: BellRing,
        path: `${basePath}/pessoal/notificacoes`,
        space: "personal",
      },
      {
        id: "suporte",
        title: "Suporte",
        description: "Fale com o atendimento ou tire dúvidas.",
        icon: MessageCircle,
        path: `${basePath}/suporte`,
        space: "personal",
      },
    ],
    [basePath]
  );

  const activeNavSections = isPersonalSpace ? personalNavSections : clinicNavSections;

  // Handlers da Dock Mobile
  const startMobileDockGesture = (
    button: HTMLButtonElement,
    sectionId: string,
    title: string,
    clientX: number,
    clientY: number,
    pointerId = 0
  ) => {
    mobileDockGestureRef.current = { button, clientX, clientY, pointerId, sectionId, title };
    setMobileDockPointerActive(true);
    setMobileDockExpanded(true);
    setMobileDockPressedSection(sectionId);
    const rect = button.getBoundingClientRect();
    setMobileDockTooltip({ title, x: rect.left + rect.width / 2 });
  };

  const finishMobileDockInteraction = () => {
    mobileDockGestureRef.current = null;
    setMobileDockPointerActive(false);
    setMobileDockPressedSection(null);
    setMobileDockTooltip(null);
  };

  const renderSettingsSideCard = (floating = false) => (
    <Card
      className={cn(
        "hidden lg:flex flex-col transition-all duration-500 ease-out",
        floating
          ? "pointer-events-auto w-80 max-h-[calc(100vh-4rem)] max-h-[calc(100dvh-4rem)] shadow-2xl shadow-primary/10 border bg-card/95 backdrop-blur z-50"
          : "max-h-[calc(100vh-6rem)] max-h-[calc(100dvh-6rem)]"
      )}
    >
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 font-semibold">
            <Settings className="h-4 w-4 text-primary" />
            {isPersonalSpace ? "Espaço Pessoal" : "Configurações da Clínica"}
          </CardTitle>
          <Button
            type="button"
            variant={pinnedMenu ? "default" : "outline"}
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={() => setPinnedMenu((curr) => !curr)}
            aria-label={pinnedMenu ? "Desafixar menu lateral" : "Fixar menu lateral"}
            title={pinnedMenu ? "Desafixar menu" : "Fixar menu"}
          >
            <Pin className={cn("h-4 w-4", pinnedMenu && "fill-current")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="overflow-y-auto flex-1 p-3 pt-0 min-h-0 [scrollbar-width:thin] space-y-1.5">
        {activeNavSections.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.id === "perfil" && location.pathname.endsWith("/perfil")) ||
            (item.id === "equipe" && location.pathname.endsWith("/equipe"));

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl p-2.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary font-semibold border border-primary/30 shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
              )}
            >
              <div
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                  isActive ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-xs text-foreground">{item.title}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{item.description}</p>
              </div>
            </NavLink>
          );
        })}
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full max-w-screen-2xl space-y-6 px-3 py-4 sm:px-6 lg:px-8"
    >
      {/* Menu Retrátil Flutuante na Borda Esquerda (Desktop) */}
      {!pinnedMenu ? (
        <div className="group/designlab-settings-drawer pointer-events-none fixed top-1/2 left-0 -translate-y-1/2 z-40 hidden w-[356px] h-0 lg:block">
          <button
            type="button"
            className="designlab-settings-drawer-handle pointer-events-auto absolute left-0 top-1/2 z-10 flex h-36 w-10 -translate-y-1/2 items-center justify-center rounded-r-2xl p-[1px] text-primary focus-visible:outline-none shadow-md cursor-pointer"
            onClick={() => setPinnedMenu(true)}
            aria-label="Abrir e fixar menu lateral de configurações"
            title="Abrir menu lateral"
          >
            <span className="designlab-settings-drawer-handle-surface flex h-full w-full flex-col items-center justify-center gap-2 rounded-r-[0.9rem] border border-sky-200/70 bg-card/95 text-primary backdrop-blur">
              <ChevronRight className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] [writing-mode:vertical-rl]">Menu</span>
            </span>
          </button>
          <div className="pointer-events-auto absolute inset-y-0 left-10 z-0 w-2" aria-hidden="true" />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+1.25rem)] opacity-0 transition-all duration-500 ease-out group-hover/designlab-settings-drawer:translate-x-0 group-hover/designlab-settings-drawer:opacity-100 group-focus-within/designlab-settings-drawer:translate-x-0 group-focus-within/designlab-settings-drawer:opacity-100">
            {renderSettingsSideCard(true)}
          </div>
        </div>
      ) : null}

      {/* Grid Principal: Sidebar Fixa (quando pinned) + Conteúdo Amplo */}
      <div
        className={cn(
          "grid gap-6 transition-[grid-template-columns] duration-500 ease-out",
          pinnedMenu ? "lg:grid-cols-[300px,1fr]" : "lg:grid-cols-[1fr]"
        )}
      >
        {pinnedMenu ? renderSettingsSideCard(false) : null}

        {/* Contêiner de Conteúdo com Espaçamento Seguro para a Dock Mobile */}
        <main className="min-w-0 space-y-6 pb-28 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Dock Mobile Animada 100% Preservada */}
      <div
        className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden"
        data-dock-state={mobileDockExpanded ? "medium" : "compact"}
        data-dock-pressing={mobileDockPointerActive ? "true" : "false"}
      >
        <div className="mx-auto flex w-full max-w-screen-sm justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
          {mobileDockTooltip && (
            <span
              className="designlab-settings-mobile-floating-tooltip"
              style={{ "--mobile-dock-tooltip-x": `${mobileDockTooltip.x}px` } as CSSProperties}
            >
              {mobileDockTooltip.title}
            </span>
          )}

          <div
            className="designlab-settings-mobile-dock flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden is-scrollable"
            onPointerUp={finishMobileDockInteraction}
            onPointerCancel={finishMobileDockInteraction}
            onTouchEnd={finishMobileDockInteraction}
            onTouchCancel={finishMobileDockInteraction}
          >
            {activeNavSections.map((item) => {
              const isActive = location.pathname.includes(item.id);
              const isPressed = mobileDockPressedSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.title}
                  data-settings-mobile-section={item.id}
                  className={cn(
                    "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5",
                    isActive && "is-active",
                    isPressed && "is-pressed"
                  )}
                  onPointerDown={(e) => startMobileDockGesture(e.currentTarget, item.id, item.title, e.clientX, e.clientY, e.pointerId)}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) startMobileDockGesture(e.currentTarget, item.id, item.title, touch.clientX, touch.clientY);
                  }}
                  onClick={() => {
                    setMobileDockExpanded(true);
                    navigate(item.path);
                  }}
                >
                  <span
                    className={cn(
                      "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300",
                      isActive
                        ? "border-primary/45 bg-primary/10 text-primary"
                        : "border-border/80 bg-card/92 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300",
                        isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
