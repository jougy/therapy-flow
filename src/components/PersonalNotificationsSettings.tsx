import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type NotificationSoundKey,
  NOTIFICATION_SOUND_GROUPS,
  NOTIFICATION_SOUND_LABELS,
  playNotificationSound,
} from "@/lib/notification-sounds";

export type PreferenceToggleKey =
  | "notify_security"
  | "notify_clinic_access"
  | "notify_patient_saved"
  | "notify_session_activity"
  | "notify_event_reminders"
  | "notify_system";

export interface NotificationPreferences {
  notify_clinic_access: boolean;
  notify_event_reminders: boolean;
  notify_patient_saved: boolean;
  notify_security: boolean;
  notify_session_activity: boolean;
  notify_system: boolean;
  sound_key: NotificationSoundKey;
  sound_mode: "default" | "silent";
}

export const defaultNotificationPreferences: NotificationPreferences = {
  notify_clinic_access: true,
  notify_event_reminders: true,
  notify_patient_saved: true,
  notify_security: true,
  notify_session_activity: true,
  notify_system: true,
  sound_key: "soft",
  sound_mode: "default",
};

export const preferenceItems: Array<{ key: PreferenceToggleKey; label: string; description: string }> = [
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

interface PersonalNotificationsSettingsProps {
  preferences: NotificationPreferences;
  savingPreference: boolean;
  onUpdatePreferences: (changes: Partial<NotificationPreferences>) => Promise<void>;
}

export const PersonalNotificationsSettings = ({
  preferences,
  savingPreference,
  onUpdatePreferences,
}: PersonalNotificationsSettingsProps) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Som</label>
          <Select
            value={preferences.sound_mode}
            onValueChange={(value) => void onUpdatePreferences({ sound_mode: value as NotificationPreferences["sound_mode"] })}
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
          <div className="flex items-center gap-2">
            <Select
              value={preferences.sound_key}
              disabled={preferences.sound_mode === "silent"}
              onValueChange={(value) => void onUpdatePreferences({ sound_key: value as NotificationSoundKey })}
            >
              <SelectTrigger className="h-9 min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_SOUND_GROUPS.map((group) => (
                  <SelectGroup key={group.intensity}>
                    <SelectLabel className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group.groupLabel}
                    </SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={preferences.sound_mode === "silent"}
              onClick={() => playNotificationSound(preferences.sound_key)}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
              aria-label={`Ouvir prévia do toque ${NOTIFICATION_SOUND_LABELS[preferences.sound_key] ?? ""}`}
              title="Ouvir toque selecionado"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
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
              onCheckedChange={(checked) => void onUpdatePreferences({ [item.key]: checked } as Partial<NotificationPreferences>)}
              aria-label={`Alternar ${item.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
