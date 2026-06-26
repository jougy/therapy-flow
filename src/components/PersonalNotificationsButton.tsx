import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, ExternalLink, Loader2, Settings, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRuntimeError } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";

type NotificationCategory = "security" | "clinic_access" | "patient" | "session" | "reminder" | "system";
type PreferenceToggleKey =
  | "notify_security"
  | "notify_clinic_access"
  | "notify_patient_saved"
  | "notify_session_activity"
  | "notify_event_reminders"
  | "notify_system";

interface PersonalNotification {
  action_label: string | null;
  action_url: string | null;
  actor_name: string | null;
  actor_user_id: string | null;
  body: string;
  category: NotificationCategory;
  clinic_id: string | null;
  clinic_name: string | null;
  created_at: string;
  event_type: string;
  notification_id: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  title: string;
}

interface NotificationPreferences {
  notify_clinic_access: boolean;
  notify_event_reminders: boolean;
  notify_patient_saved: boolean;
  notify_security: boolean;
  notify_session_activity: boolean;
  notify_system: boolean;
  sound_key: "soft" | "chime" | "pulse";
  sound_mode: "default" | "silent";
}

const defaultPreferences: NotificationPreferences = {
  notify_clinic_access: true,
  notify_event_reminders: true,
  notify_patient_saved: true,
  notify_security: true,
  notify_session_activity: true,
  notify_system: true,
  sound_key: "soft",
  sound_mode: "default",
};

const preferenceItems: Array<{ key: PreferenceToggleKey; label: string; description: string }> = [
  {
    key: "notify_security",
    label: "Segurança e acessos pessoais",
    description: "Senha, sessões encerradas e alterações no seu acesso.",
  },
  {
    key: "notify_clinic_access",
    label: "Entrada e saída da clínica",
    description: "Quando alguém acessa, sai ou perde acesso à clínica.",
  },
  {
    key: "notify_patient_saved",
    label: "Cadastros de paciente",
    description: "Confirmações de cadastro salvo ou atualizado.",
  },
  {
    key: "notify_session_activity",
    label: "Atendimentos da clínica",
    description: "Atendimentos registrados por outros usuários, com atalho quando houver.",
  },
  {
    key: "notify_event_reminders",
    label: "Lembretes de agenda",
    description: "Eventos e atendimentos próximos do horário.",
  },
  {
    key: "notify_system",
    label: "Sistema e novidades",
    description: "Avisos operacionais, atualizações e mensagens gerais.",
  },
];

const categoryLabel: Record<NotificationCategory, string> = {
  clinic_access: "Clínica",
  patient: "Paciente",
  reminder: "Agenda",
  security: "Segurança",
  session: "Atendimento",
  system: "Sistema",
};

const soundLabels: Record<NotificationPreferences["sound_key"], string> = {
  chime: "Chime",
  pulse: "Pulso",
  soft: "Suave",
};

const formatNotificationDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const playNotificationPreview = (soundKey: NotificationPreferences["sound_key"]) => {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = soundKey === "chime" ? 880 : soundKey === "pulse" ? 520 : 660;

  oscillator.frequency.value = frequency;
  oscillator.type = soundKey === "pulse" ? "square" : "sine";
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
};

const PersonalNotificationsButton = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOpen = desktopOpen || mobileOpen;
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read_at).length, [notifications]);

  const fetchNotificationCenter = useCallback(async ({ markAsRead = false, showLoading = false }: { markAsRead?: boolean; showLoading?: boolean } = {}) => {
    if (!user?.id) {
      setNotifications([]);
      setPreferences(defaultPreferences);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    const [notificationsResponse, preferencesResponse] = await Promise.all([
      supabase.rpc("list_current_user_notifications"),
      supabase.rpc("list_current_user_notification_preferences"),
    ]);

    if (showLoading) {
      setLoading(false);
    }

    if (notificationsResponse.error) {
      logRuntimeError("personal_space.notifications", notificationsResponse.error, { userId: user?.id });
      setNotifications([]);
    } else {
      const nextNotifications = (notificationsResponse.data ?? []) as PersonalNotification[];
      const unreadIds = nextNotifications
        .filter((notification) => !notification.read_at)
        .map((notification) => notification.notification_id);

      if (markAsRead && unreadIds.length > 0) {
        const readAt = new Date().toISOString();
        setNotifications(
          nextNotifications.map((notification) =>
            unreadIds.includes(notification.notification_id) ? { ...notification, read_at: readAt } : notification,
          ),
        );

        const { error } = await supabase
          .from("app_notifications")
          .update({ read_at: readAt })
          .in("id", unreadIds)
          .eq("user_id", user.id);

        if (error) {
          logRuntimeError("personal_space.notifications.mark_read", error, { userId: user.id });
          setNotifications(nextNotifications);
        }
      } else {
        setNotifications(nextNotifications);
      }
    }

    if (preferencesResponse.error) {
      logRuntimeError("personal_space.notification_preferences", preferencesResponse.error, { userId: user?.id });
    } else {
      setPreferences(((preferencesResponse.data ?? [defaultPreferences])[0] ?? defaultPreferences) as NotificationPreferences);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchNotificationCenter();
  }, [fetchNotificationCenter]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchNotificationCenter({ markAsRead: true, showLoading: true });
  }, [fetchNotificationCenter, isOpen]);

  const updatePreferences = async (changes: Partial<NotificationPreferences>) => {
    const nextPreferences = { ...preferences, ...changes };
    setPreferences(nextPreferences);
    setSavingPreference(true);

    const { error } = await supabase.rpc("update_current_user_notification_preferences", {
      _notify_clinic_access: nextPreferences.notify_clinic_access,
      _notify_event_reminders: nextPreferences.notify_event_reminders,
      _notify_patient_saved: nextPreferences.notify_patient_saved,
      _notify_security: nextPreferences.notify_security,
      _notify_session_activity: nextPreferences.notify_session_activity,
      _notify_system: nextPreferences.notify_system,
      _sound_key: nextPreferences.sound_key,
      _sound_mode: nextPreferences.sound_mode,
    });

    setSavingPreference(false);

    if (error) {
      logRuntimeError("personal_space.notification_preferences.update", error, { userId: user?.id });
      setPreferences(preferences);
      toast({ title: "Erro ao salvar notificações", description: error.message, variant: "destructive" });
      return;
    }

    if (changes.sound_key && nextPreferences.sound_mode !== "silent") {
      playNotificationPreview(changes.sound_key);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    setNotifications((current) => current.filter((notification) => notification.notification_id !== notificationId));
    const { error } = await supabase.rpc("delete_current_user_notification", { _notification_id: notificationId });

    if (error) {
      toast({ title: "Erro ao excluir notificação", description: error.message, variant: "destructive" });
      await fetchNotificationCenter();
    }
  };

  const clearNotifications = async () => {
    const previousNotifications = notifications;
    setNotifications([]);
    const { error } = await supabase.rpc("clear_current_user_notifications");

    if (error) {
      setNotifications(previousNotifications);
      toast({ title: "Erro ao limpar notificações", description: error.message, variant: "destructive" });
    }
  };

  const handleAction = (notification: PersonalNotification) => {
    if (!notification.action_url) return;
    if (desktopOpen) setDesktopOpen(false);
    if (mobileOpen) setMobileOpen(false);
    navigate(notification.action_url);
  };

  const trigger = (ariaLabel: string, visibilityClassName: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "group/notifications relative h-10 w-10 shrink-0 justify-center gap-0 overflow-hidden rounded-full px-0 text-muted-foreground transition-[width,gap,padding,box-shadow,border-color,background-color,color,transform] duration-700 ease-in-out hover:text-foreground sm:hover:w-[156px] sm:hover:justify-start sm:hover:gap-2 sm:hover:px-3 sm:hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] sm:focus-visible:w-[156px] sm:focus-visible:justify-start sm:focus-visible:gap-2 sm:focus-visible:px-3",
        visibilityClassName,
        className,
      )}
      aria-label={unreadCount > 0 ? `${ariaLabel}, ${unreadCount} notificações novas` : ariaLabel}
    >
      <BellRing className="h-4 w-4 shrink-0 transition-transform duration-700 group-hover/notifications:animate-[notification-bell-swing_0.7s_ease-in-out] group-focus-visible/notifications:animate-[notification-bell-swing_0.7s_ease-in-out]" />
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/notifications:ml-2 group-hover/notifications:max-w-[7rem] group-hover/notifications:opacity-100 group-focus-visible/notifications:ml-2 group-focus-visible/notifications:max-w-[7rem] group-focus-visible/notifications:opacity-100 sm:inline">
        Notificações
      </span>
      {unreadCount > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
          {unreadCount}
        </span>
      )}
    </Button>
  );

  const settingsPanel = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Som</label>
          <Select
            value={preferences.sound_mode}
            onValueChange={(value) => void updatePreferences({ sound_mode: value as NotificationPreferences["sound_mode"] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <span className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5" />
                  Com toque
                </span>
              </SelectItem>
              <SelectItem value="silent">
                <span className="flex items-center gap-2">
                  <VolumeX className="h-3.5 w-3.5" />
                  Silencioso
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Toque</label>
          <Select
            value={preferences.sound_key}
            disabled={preferences.sound_mode === "silent"}
            onValueChange={(value) => void updatePreferences({ sound_key: value as NotificationPreferences["sound_key"] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(soundLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {preferenceItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              checked={preferences[item.key]}
              disabled={savingPreference}
              onCheckedChange={(checked) => void updatePreferences({ [item.key]: checked } as Partial<NotificationPreferences>)}
              aria-label={`Alternar ${item.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const feed = (
    <div className="min-w-0">
      {showSettings ? (
        settingsPanel
      ) : loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
          Nenhuma notificação registrada ainda.
        </div>
      ) : (
        <div className="max-h-[min(28rem,70vh)] space-y-2 overflow-y-auto pr-1">
          {notifications.map((notification) => (
            <article key={notification.notification_id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {categoryLabel[notification.category] ?? "Notificação"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">[{formatNotificationDate(notification.created_at)}]</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">{notification.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notification.body}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void deleteNotification(notification.notification_id)}
                  aria-label="Excluir notificação"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {notification.action_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8"
                  onClick={() => handleAction(notification)}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  {notification.action_label || "Abrir"}
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );

  const header = (
    <div className="border-b px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Notificações</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {showSettings ? "Escolha quais avisos quer receber e como eles devem tocar." : "Avisos, atalhos e histórico recente do seu espaço pessoal."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!showSettings && notifications.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => void clearNotifications()}
              aria-label="Limpar histórico de notificações"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant={showSettings ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettings((current) => !current)}
            aria-label={showSettings ? "Voltar para notificações" : "Configurar notificações"}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
        <PopoverTrigger asChild>
          {trigger("Abrir notificações", "hidden sm:inline-flex")}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="flex max-h-[min(34rem,calc(100vh-6rem))] w-[28rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0">
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{feed}</div>
        </PopoverContent>
      </Popover>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          {trigger("Abrir notificações no popup", "sm:hidden")}
        </DialogTrigger>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Notificações</DialogTitle>
            <DialogDescription>Avisos, atalhos e histórico recente do seu espaço pessoal.</DialogDescription>
          </DialogHeader>
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{feed}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PersonalNotificationsButton;
