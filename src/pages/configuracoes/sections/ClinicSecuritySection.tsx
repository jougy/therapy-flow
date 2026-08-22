import { useEffect, useState } from "react";
import {
  Clock,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SecurityEvent = {
  id: string;
  event_type: string;
  created_at: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata?: Record<string, unknown> | null;
};

type ActiveMemberSession = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  operational_role: string;
  last_seen_at: string | null;
  is_online: boolean;
  is_inactive: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
  owner: "Proprietário(a)",
};

const getEventMeta = (eventType: string) => {
  const normalized = eventType.toLowerCase().replace(/[\s._]/g, "_");

  if (normalized.includes("session_started") || normalized.includes("login") || normalized.includes("auth")) {
    return {
      label: "Acesso ao sistema",
      desc: "Login e início de sessão na plataforma",
      icon: Laptop,
      tone: "text-emerald-600 bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400",
    };
  }
  if (normalized.includes("session_ended") || normalized.includes("logout") || normalized.includes("signout")) {
    return {
      label: "Encerramento de sessão",
      desc: "Logout ou desconexão de dispositivo",
      icon: LogOut,
      tone: "text-muted-foreground bg-muted",
    };
  }
  if (normalized.includes("invite") || normalized.includes("collaborator")) {
    return {
      label: "Convite de equipe",
      desc: "Emissão ou atualização de convite oficial",
      icon: UserCheck,
      tone: "text-sky-600 bg-sky-50 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400",
    };
  }
  if (normalized.includes("role") || normalized.includes("permission")) {
    return {
      label: "Papel operacional ajustado",
      desc: "Alteração de privilégios ou permissões",
      icon: ShieldCheck,
      tone: "text-amber-600 bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-400",
    };
  }
  if (normalized.includes("password") || normalized.includes("senha")) {
    return {
      label: "Atualização de senha",
      desc: "Troca de credencial de segurança",
      icon: KeyRound,
      tone: "text-blue-600 bg-blue-50 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-400",
    };
  }

  return {
    label: eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    desc: "Ação de auditoria registrada no sistema",
    icon: Shield,
    tone: "text-muted-foreground bg-muted",
  };
};

export const ClinicSecuritySection = () => {
  const { clinicId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveMemberSession[]>([]);
  const [disconnectingUserId, setDisconnectingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadSecurityData = async () => {
      if (!clinicId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const [{ data: membersData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("clinic_memberships")
          .select("id, user_id, operational_role, membership_status, profiles(full_name, email, last_seen_at)")
          .eq("clinic_id", clinicId)
          .eq("membership_status", "active"),
        supabase
          .from("security_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(15),
      ]);

      if (!active) return;

      if (membersData) {
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

        const mapped: ActiveMemberSession[] = membersData.map((item: any) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
          const isOnline = lastSeen > 0 && now - lastSeen < 5 * 60 * 1000;
          const isInactive = lastSeen === 0 || now - lastSeen > THIRTY_DAYS_MS;

          return {
            id: item.id,
            user_id: item.user_id,
            full_name: profile?.full_name || "Colaborador",
            email: profile?.email || "",
            operational_role: item.operational_role || "professional",
            last_seen_at: profile?.last_seen_at || null,
            is_online: isOnline,
            is_inactive: isInactive,
          };
        });
        setActiveSessions(mapped);
      }

      if (eventsData) {
        setEvents(eventsData as SecurityEvent[]);
      }

      setLoading(false);
    };

    void loadSecurityData();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const handleDisconnectMember = async (targetUserId: string, memberName: string) => {
    setDisconnectingUserId(targetUserId);
    try {
      await supabase
        .from("user_security_sessions")
        .delete()
        .eq("user_id", targetUserId);

      toast({
        title: "Sessão desconectada",
        description: `As conexões ativas de ${memberName} foram finalizadas com segurança.`,
      });

      setActiveSessions((prev) =>
        prev.map((s) => (s.user_id === targetUserId ? { ...s, is_online: false } : s))
      );
    } catch (err) {
      toast({
        title: "Erro ao desconectar sessão",
        description: "Não foi possível encerrar a sessão remotamente.",
        variant: "destructive",
      });
    } finally {
      setDisconnectingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const onlineMembersCount = activeSessions.filter((s) => s.is_online).length;
  const inactiveMembersCount = activeSessions.filter((s) => s.is_inactive).length;

  return (
    <div className="space-y-6">
      <Card data-tutorial="settings-security-clinic-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Segurança e Governança da Clínica</CardTitle>
              <CardDescription className="text-xs">
                Monitore sessões ativas da equipe, higiene de acessos e eventos de auditoria clínica.
              </CardDescription>
            </div>
          </div>
          <ComponentHelpButton helpId="settings-security-clinic-block" size="sm" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Métricas Principais (3 Blocos Limpos) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Membros da Equipe</p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{activeSessions.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Colaboradores ativos na clínica</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Online Agora</p>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineMembersCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com atividade nos últimos 5 min</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contas Inativas</p>
                <Clock className={cn("h-4 w-4", inactiveMembersCount > 0 ? "text-amber-500" : "text-muted-foreground")} />
              </div>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold",
                  inactiveMembersCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}
              >
                {inactiveMembersCount}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Sem acesso recente há +30 dias</p>
            </div>
          </div>

          {/* Sessões e Conexões Ativas dos Membros */}
          <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-primary" />
                  Sessões e Acessos da Equipe
                </p>
                <p className="text-xs text-muted-foreground">
                  Acompanhe o último acesso e encerre sessões abertas de colaboradores remotamente.
                </p>
              </div>
              <Badge variant="outline" className="w-fit text-xs font-medium">
                {activeSessions.length} colaboradores
              </Badge>
            </div>

            <div className="space-y-2.5">
              {activeSessions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum colaborador registrado nesta clínica.
                </div>
              ) : (
                activeSessions.map((session) => {
                  const roleName = ROLE_LABELS[session.operational_role] || session.operational_role;
                  const isCurrentLoggedUser = session.user_id === user?.id;

                  return (
                    <div
                      key={session.id}
                      className="flex flex-col gap-3 rounded-lg border bg-background p-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-sm text-foreground">{session.full_name}</p>
                            {isCurrentLoggedUser && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                Você
                              </Badge>
                            )}
                            {session.is_inactive && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                                Inativo (+30d)
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {session.email} · <span className="font-medium text-foreground">{roleName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 sm:justify-end">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                session.is_online ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-muted-foreground/40"
                              }`}
                            />
                            <span className="text-xs font-medium">
                              {session.is_online ? "Conectado agora" : "Desconectado"}
                            </span>
                          </div>
                          {session.last_seen_at && (
                            <p className="text-[11px] text-muted-foreground">
                              Último acesso: {new Date(session.last_seen_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {new Date(session.last_seen_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>

                        {!isCurrentLoggedUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5"
                            onClick={() => void handleDisconnectMember(session.user_id, session.full_name)}
                            disabled={disconnectingUserId === session.user_id}
                          >
                            {disconnectingUserId === session.user_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LogOut className="h-3.5 w-3.5" />
                            )}
                            Desconectar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trilha de Auditoria & Eventos de Segurança (Formatado em Português) */}
          <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div>
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-sky-600" />
                Trilha de Auditoria e Eventos de Acesso
              </p>
              <p className="text-xs text-muted-foreground">
                Registro cronológico de acessos, alterações de permissões e eventos administrativos da clínica.
              </p>
            </div>

            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum evento crítico registrado para esta clínica até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const meta = getEventMeta(event.event_type);
                  const Icon = meta.icon;

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg border bg-background p-3 text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", meta.tone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{meta.label}</p>
                          <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px] font-medium">
                        {new Date(event.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
