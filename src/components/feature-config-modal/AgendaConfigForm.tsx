import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MessageSquare, CalendarDays, Coffee } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function AgendaConfigForm({ formData, setFormData, feature }: FeatureSubFormProps) {
  // Agenda Master Onboarding
  if (feature?.key === "agenda_master_onboarding") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
            <Calendar className="w-4 h-4" />
            Agenda Master de Onboarding (Backoffice)
          </div>
          <p>
            Parâmetros globais para a agenda de reuniões de demonstração e onboarding estratégico (/platform/agenda-master).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agm-duration" className="text-xs font-semibold">Duração Padrão das Reuniões (Minutos)</Label>
            <Input
              id="agm-duration"
              type="number"
              min={5}
              max={120}
              placeholder="15"
              value={formData.defaultDurationMinutes !== undefined ? String(formData.defaultDurationMinutes) : "15"}
              onChange={(e) => setFormData({ ...formData, defaultDurationMinutes: Number(e.target.value) })}
            />
            <span className="text-[11px] text-muted-foreground">Duração recomendada para onboarding inicial: 15 minutos.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agm-meet-url" className="text-xs font-semibold">Link da Sala de Reunião Oficial (Google Meet)</Label>
            <Input
              id="agm-meet-url"
              placeholder="https://meet.google.com/pluri-onboarding"
              value={(formData.meetingRoomUrl as string) || "https://meet.google.com/pluri-onboarding"}
              onChange={(e) => setFormData({ ...formData, meetingRoomUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agm-allow-reschedule" className="font-semibold text-xs cursor-pointer">
                Permitir Remarcação com 1 Clique pelo Lead
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Disponibiliza link no e-mail/WhatsApp para o lead escolher um novo slot de horário.
              </p>
            </div>
            <Switch
              id="agm-allow-reschedule"
              checked={formData.allowLeadReschedule !== false}
              onCheckedChange={(val) => setFormData({ ...formData, allowLeadReschedule: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agm-send-calendar" className="font-semibold text-xs cursor-pointer">
                Enviar Convite com Arquivo .ics / Google Calendar
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Gera convite direto na caixa postal do lead e no calendário da equipe.
              </p>
            </div>
            <Switch
              id="agm-send-calendar"
              checked={formData.sendCalendarInvite !== false}
              onCheckedChange={(val) => setFormData({ ...formData, sendCalendarInvite: val })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Agenda WhatsApp Booking Flow
  if (feature?.key === "agenda_whatsapp_booking_flow") {
    const defaultDays = ["seg", "ter", "qua", "qui", "sex"];
    const currentDays: string[] = Array.isArray(formData.workDays) ? (formData.workDays as string[]) : defaultDays;

    const daysList = [
      { id: "seg", label: "Segunda" },
      { id: "ter", label: "Terça" },
      { id: "qua", label: "Quarta" },
      { id: "qui", label: "Quinta" },
      { id: "sex", label: "Sexta" },
      { id: "sab", label: "Sábado" },
      { id: "dom", label: "Domingo" },
    ];

    const toggleDay = (dayId: string, checked: boolean) => {
      let updated: string[];
      if (checked) {
        updated = Array.from(new Set([...currentDays, dayId]));
      } else {
        updated = currentDays.filter(d => d !== dayId);
      }
      setFormData({ ...formData, workDays: updated });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <MessageSquare className="w-4 h-4" />
            Agendamento Interativo via Bot WhatsApp
          </div>
          <p>
            Configura a janela diária de expediente e os dias da semana oferecidos pelo bot interativo de marcação.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bot-start-hour" className="text-xs font-semibold">Horário Inicial de Expediente</Label>
            <Input
              id="bot-start-hour"
              type="time"
              value={(formData.startHour as string) || "08:00"}
              onChange={(e) => setFormData({ ...formData, startHour: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-end-hour" className="text-xs font-semibold">Horário Final de Expediente</Label>
            <Input
              id="bot-end-hour"
              type="time"
              value={(formData.endHour as string) || "18:00"}
              onChange={(e) => setFormData({ ...formData, endHour: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Dias Úteis Ofertados no Menu do Bot</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {daysList.map((day) => {
              const isChecked = currentDays.includes(day.id);
              return (
                <div key={day.id} className="flex items-center space-x-2 p-2 rounded-lg border bg-muted/20">
                  <Checkbox
                    id={`day-${day.id}`}
                    checked={isChecked}
                    onCheckedChange={(v) => toggleDay(day.id, !!v)}
                  />
                  <Label htmlFor={`day-${day.id}`} className="text-xs cursor-pointer">{day.label}</Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <Label htmlFor="bot-interval" className="text-xs font-semibold">Intervalo dos Slots (Minutos)</Label>
            <Select
              value={formData.intervalMinutes !== undefined ? String(formData.intervalMinutes) : "30"}
              onValueChange={(val) => setFormData({ ...formData, intervalMinutes: Number(val) })}
            >
              <SelectTrigger id="bot-interval">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 mt-auto">
            <div className="space-y-0.5 pr-2">
              <Label htmlFor="bot-autoconfirm" className="text-xs font-semibold cursor-pointer">Confirmação Instantânea</Label>
              <p className="text-[10px] text-muted-foreground">Grava direto como confirmado.</p>
            </div>
            <Switch
              id="bot-autoconfirm"
              checked={formData.autoConfirmBooking !== false}
              onCheckedChange={(val) => setFormData({ ...formData, autoConfirmBooking: val })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Agenda Google Calendar Sync
  if (feature?.key === "agenda_google_calendar_sync") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-sky-700 dark:text-sky-400 font-semibold text-sm">
            <CalendarDays className="w-4 h-4" />
            Sincronização com Google Calendar (iCal Feed)
          </div>
          <p>
            Alimenta a agenda da plataforma com compromissos externos em tempo real através do protocolo de calendário iCal.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gcal-feed-url" className="text-xs font-semibold">URL do Feed iCal / Google Calendar</Label>
          <Input
            id="gcal-feed-url"
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            value={(formData.iCalFeedUrl as string) || "https://calendar.google.com/calendar/ical/plurihealth/public/basic.ics"}
            onChange={(e) => setFormData({ ...formData, iCalFeedUrl: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">URL pública ou privada de exportação de agenda em formato .ics.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gcal-cache" className="text-xs font-semibold">Duração do Cache Local (Minutos)</Label>
            <Input
              id="gcal-cache"
              type="number"
              min={1}
              max={120}
              placeholder="15"
              value={formData.cacheDurationMinutes !== undefined ? String(formData.cacheDurationMinutes) : "15"}
              onChange={(e) => setFormData({ ...formData, cacheDurationMinutes: Number(e.target.value) })}
            />
            <span className="text-[11px] text-muted-foreground">Tempo em minutos antes de efetuar nova requisição ao feed iCal.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gcal-autosync" className="text-xs font-semibold">Intervalo de Varredura Automática (Minutos)</Label>
            <Input
              id="gcal-autosync"
              type="number"
              min={5}
              max={360}
              placeholder="30"
              value={formData.autoSyncIntervalMinutes !== undefined ? String(formData.autoSyncIntervalMinutes) : "30"}
              onChange={(e) => setFormData({ ...formData, autoSyncIntervalMinutes: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="gcal-reminders" className="font-semibold text-xs cursor-pointer">
              Sincronizar Alarmes e Lembretes dos Compromissos
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Preserva os avisos e popups cadastrados originalmente no Google Agenda.
            </p>
          </div>
          <Switch
            id="gcal-reminders"
            checked={formData.syncReminders !== false}
            onCheckedChange={(val) => setFormData({ ...formData, syncReminders: val })}
          />
        </div>
      </div>
    );
  }

  // Agenda Smart Blocks Buffers
  if (feature?.key === "agenda_smart_blocks_buffers") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <Coffee className="w-4 h-4" />
            Bloqueios Inteligentes & Margem de Segurança (Buffers)
          </div>
          <p>
            Garante intervalos saudáveis entre atendimentos para evolução clínica, descanso da equipe e bloqueios fixos de agenda.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buff-minutes" className="text-xs font-semibold">Buffer de Margem entre Atendimentos (Minutos)</Label>
          <Select
            value={formData.defaultBufferMinutes !== undefined ? String(formData.defaultBufferMinutes) : "30"}
            onValueChange={(val) => setFormData({ ...formData, defaultBufferMinutes: Number(val) })}
          >
            <SelectTrigger id="buff-minutes">
              <SelectValue placeholder="Selecione o buffer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 minutos (Rápido)</SelectItem>
              <SelectItem value="15">15 minutos (Padrão)</SelectItem>
              <SelectItem value="30">30 minutos (Margem Ampla)</SelectItem>
              <SelectItem value="45">45 minutos (Evolução Complexa)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">Margem de segurança padrão para respiro e anotação de prontuário.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lunch-start" className="text-xs font-semibold">Início do Horário de Almoço</Label>
            <Input
              id="lunch-start"
              type="time"
              value={(formData.lunchBreakStart as string) || "12:00"}
              onChange={(e) => setFormData({ ...formData, lunchBreakStart: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lunch-end" className="text-xs font-semibold">Término do Horário de Almoço</Label>
            <Input
              id="lunch-end"
              type="time"
              value={(formData.lunchBreakEnd as string) || "13:00"}
              onChange={(e) => setFormData({ ...formData, lunchBreakEnd: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="block-thursday" className="font-semibold text-xs cursor-pointer">
                Bloqueio Especial: Quinta-feira de Manhã (Reunião Clínica)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Bloqueia automaticamente das 08h às 12h toda quinta para estudos de caso e alinhamento interno.
              </p>
            </div>
            <Switch
              id="block-thursday"
              checked={formData.blockThursdayMorning !== false}
              onCheckedChange={(val) => setFormData({ ...formData, blockThursdayMorning: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="enforce-break" className="font-semibold text-xs cursor-pointer">
                Impedir Agendamentos Consecutivos Sem Buffer
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Avisa e impede no modal de agendamento a seleção colada no encerramento da sessão anterior.
              </p>
            </div>
            <Switch
              id="enforce-break"
              checked={formData.enforceBreakBetweenPatients !== false}
              onCheckedChange={(val) => setFormData({ ...formData, enforceBreakBetweenPatients: val })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default: Agenda category
  const allowedViews = (formData.allowedViews as Record<string, boolean>) || {
    day: true,
    week: true,
    month: true,
    year: true,
  };

  const toggleView = (viewKey: string, checked: boolean) => {
    const updated = { ...allowedViews, [viewKey]: checked };
    // Garante que ao menos 1 visão fique ativa
    const hasAny = Object.values(updated).some(Boolean);
    if (!hasAny) {
      toast({
        title: "Atenção",
        description: "Ao menos uma visão da agenda deve permanecer habilitada.",
        variant: "destructive",
      });
      return;
    }
    setFormData({ ...formData, allowedViews: updated });
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1 text-primary font-semibold text-sm">
          <Calendar className="w-4 h-4" />
          Módulo da Agenda Clínica & Parâmetros Operacionais
        </div>
        <p>
          Configure as regras de negócio, visões ativas, turno noturno/madrugada, duração padrão de atendimentos e comportamento de blocos condensados na agenda clínica.
        </p>
      </div>

      {/* 1. Visões da Agenda Liberadas */}
      <div className="space-y-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold">Modos de Visualização Liberados</Label>
          <p className="text-xs text-muted-foreground">
            Selecione quais botões de visão estarão disponíveis no seletor da barra superior da agenda.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center space-x-2.5 p-3 rounded-lg border bg-muted/20">
            <Checkbox
              id="view-day"
              checked={allowedViews.day ?? true}
              onCheckedChange={(c) => toggleView("day", Boolean(c))}
            />
            <Label htmlFor="view-day" className="text-xs font-medium cursor-pointer">
              Visão Diária (Dia)
            </Label>
          </div>

          <div className="flex items-center space-x-2.5 p-3 rounded-lg border bg-muted/20">
            <Checkbox
              id="view-week"
              checked={allowedViews.week ?? true}
              onCheckedChange={(c) => toggleView("week", Boolean(c))}
            />
            <Label htmlFor="view-week" className="text-xs font-medium cursor-pointer">
              Visão Semanal (Semana)
            </Label>
          </div>

          <div className="flex items-center space-x-2.5 p-3 rounded-lg border bg-muted/20">
            <Checkbox
              id="view-month"
              checked={allowedViews.month ?? true}
              onCheckedChange={(c) => toggleView("month", Boolean(c))}
            />
            <Label htmlFor="view-month" className="text-xs font-medium cursor-pointer">
              Visão Mensal (Mês)
            </Label>
          </div>

          <div className="flex items-center space-x-2.5 p-3 rounded-lg border bg-muted/20">
            <Checkbox
              id="view-year"
              checked={allowedViews.year ?? true}
              onCheckedChange={(c) => toggleView("year", Boolean(c))}
            />
            <Label htmlFor="view-year" className="text-xs font-medium cursor-pointer">
              Visão Anual (Ano)
            </Label>
          </div>
        </div>
      </div>

      {/* 2. Visão Inicial Padrão & Duração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-1.5">
          <Label htmlFor="agenda-default-view" className="text-xs font-semibold">
            Visão Padrão Inicial
          </Label>
          <Select
            value={(formData.defaultView as string) || "day"}
            onValueChange={(val) => setFormData({ ...formData, defaultView: val })}
          >
            <SelectTrigger id="agenda-default-view" className="h-9 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Visão Diária (Padrão)</SelectItem>
              <SelectItem value="week">Visão Semanal</SelectItem>
              <SelectItem value="month">Visão Mensal</SelectItem>
              <SelectItem value="year">Visão Anual</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Modo exibido ao entrar na tela da agenda.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agenda-default-duration" className="text-xs font-semibold">
            Duração Padrão (Minutos)
          </Label>
          <div className="relative">
            <Input
              id="agenda-default-duration"
              type="number"
              min={10}
              max={480}
              step={5}
              value={Number(formData.defaultDurationMinutes ?? 50)}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultDurationMinutes: Math.max(5, Math.min(480, Number(e.target.value) || 50)),
                })
              }
              className="h-9 text-xs pr-12"
            />
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">
              min
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pré-preenchimento ao abrir o modal de novo evento.
          </p>
        </div>
      </div>

      {/* 3. Recursos e Parâmetros Operacionais */}
      <div className="space-y-3 pt-2 border-t">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold">Recursos e Comportamentos Operacionais</Label>
          <p className="text-xs text-muted-foreground">
            Ative ou desative lógicas visuais e mecanismos de apoio da agenda clínica.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Turno Madrugada */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agenda-dawn-shift" className="font-semibold text-xs cursor-pointer">
                Turno de Madrugada (00h00 às 06h59)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Garante cobertura ininterrupta das 24 horas do dia sem lacunas na visão diária e semanal.
              </p>
            </div>
            <Switch
              id="agenda-dawn-shift"
              checked={Boolean(formData.enableDawnShift ?? true)}
              onCheckedChange={(val) => setFormData({ ...formData, enableDawnShift: val })}
            />
          </div>

          {/* Alerta de Conflitos em Tempo Real */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agenda-conflict-warn" className="font-semibold text-xs cursor-pointer">
                Aviso de Conflitos em Tempo Real
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Alerta no modal ao digitar horários que sobrepõem outros compromissos ativos do profissional.
              </p>
            </div>
            <Switch
              id="agenda-conflict-warn"
              checked={Boolean(formData.enableConflictWarning ?? true)}
              onCheckedChange={(val) => setFormData({ ...formData, enableConflictWarning: val })}
            />
          </div>

          {/* Blocos Condensados */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agenda-condensed-slots" className="font-semibold text-xs cursor-pointer">
                Blocos Condensados de Horários Livres
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Agrupa lacunas contíguas em botões rápidos de 1 clique em vez de renderizar colunas vazias.
              </p>
            </div>
            <Switch
              id="agenda-condensed-slots"
              checked={Boolean(formData.enableCondensedSlots ?? true)}
              onCheckedChange={(val) => setFormData({ ...formData, enableCondensedSlots: val })}
            />
          </div>

          {/* Horário de Término nos Cards */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agenda-show-endtime" className="font-semibold text-xs cursor-pointer">
                Exibição de Início e Término nos Cards
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Mostra a faixa completa (HH:mm – HH:mm) e a duração em minutos nos cards ocupados.
              </p>
            </div>
            <Switch
              id="agenda-show-endtime"
              checked={Boolean(formData.showEndTimeOnCards ?? true)}
              onCheckedChange={(val) => setFormData({ ...formData, showEndTimeOnCards: val })}
            />
          </div>

          {/* Badges de Spanning (Interperíodo) */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="agenda-spanning-badges" className="font-semibold text-xs cursor-pointer">
                Badges de Continuidade (Eventos Interperíodos)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Destaca quando um atendimento atravessa a fronteira entre turnos (ex: das 06h30 às 07h20).
              </p>
            </div>
            <Switch
              id="agenda-spanning-badges"
              checked={Boolean(formData.showSpanningBadges ?? true)}
              onCheckedChange={(val) => setFormData({ ...formData, showSpanningBadges: val })}
            />
          </div>
        </div>
      </div>

      {/* 4. Mensagem de Manutenção (Opcional) */}
      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor="agenda-maintenance-msg" className="text-sm font-semibold">
          Mensagem de Manutenção / Aviso da Agenda (Opcional)
        </Label>
        <p className="text-xs text-muted-foreground">
          Se preenchida, será exibida aos profissionais da clínica como aviso especial de sincronização na página da agenda.
        </p>
        <Textarea
          id="agenda-maintenance-msg"
          placeholder="Ex: A agenda passará por calibração de horários das 22h às 23h..."
          value={(formData.maintenanceMessage as string) || ""}
          onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
          className="resize-none text-xs"
          rows={2}
        />
      </div>
    </div>
  );
}
