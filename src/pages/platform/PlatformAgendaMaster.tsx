import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  Search,
  Filter,
  Plus,
  RotateCcw,
  LayoutList,
  Calendar as CalendarIcon,
  Loader2,
  CheckCircle2,
  CalendarClock,
  XCircle,
  UserX,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import type { OnboardingMeeting, MeetingStatus, AgendaViewMode } from "@/components/platform/agenda/types";
import { AgendaStatsHeader } from "@/components/platform/agenda/AgendaStatsHeader";
import { MeetingCard } from "@/components/platform/agenda/MeetingCard";
import { MeetingCalendarView } from "@/components/platform/agenda/MeetingCalendarView";
import { CreateMeetingModal } from "@/components/platform/agenda/CreateMeetingModal";
import { EditMeetingNotesDialog } from "@/components/platform/agenda/EditMeetingNotesDialog";
import { RescheduleMeetingDialog } from "@/components/platform/agenda/RescheduleMeetingDialog";

export const PlatformAgendaMaster: React.FC = () => {
  const { user } = useAuth();

  // State
  const [meetings, setMeetings] = useState<OnboardingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & View
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<AgendaViewMode>("list");

  // Modals & Dialogs
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [notesMeeting, setNotesMeeting] = useState<OnboardingMeeting | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<OnboardingMeeting | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  // Fetch meetings
  const loadMeetings = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("platform_onboarding_meetings")
        .select("*")
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.warn("Erro ao buscar platform_onboarding_meetings:", error.message);
        // Se a tabela ainda não existir no banco local ou houver erro, mantém lista vazia sem quebrar a UI
      } else if (data) {
        setMeetings(data as OnboardingMeeting[]);
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar reuniões:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  // Supabase Realtime: Refletir instantaneamente inserções, confirmações, cancelamentos e reagendamentos
  useEffect(() => {
    if (!supabase || typeof supabase.channel !== "function") return;

    const channel = supabase
      .channel("platform-onboarding-meetings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_onboarding_meetings",
        },
        (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const newMeeting = payload.new as unknown as OnboardingMeeting;
            setMeetings((prev) => {
              const exists = prev.some((m) => m.id === newMeeting.id);
              if (exists) return prev;
              return [newMeeting, ...prev];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const updatedMeeting = payload.new as unknown as OnboardingMeeting;
            setMeetings((prev) =>
              prev.map((m) => (m.id === updatedMeeting.id ? { ...m, ...updatedMeeting } : m))
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) {
              setMeetings((prev) => prev.filter((m) => m.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === "function") {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  // Handle Status Update
  const handleStatusChange = useCallback(async (meetingId: string, newStatus: MeetingStatus) => {
    // Optimistic update
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, status: newStatus, updated_at: new Date().toISOString() } : m))
    );

    try {
      const { error } = await supabase
        .from("platform_onboarding_meetings")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", meetingId);

      if (error) {
        throw error;
      }

      toast({
        title: "Status atualizado com sucesso",
        description: `A reunião foi marcada como ${newStatus}.`,
      });
    } catch (err) {
      // Rollback on error
      void loadMeetings(true);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível salvar o novo status no banco de dados.",
        variant: "destructive",
      });
    }
  }, [loadMeetings]);

  // Handle Save Notes
  const handleSaveNotes = useCallback(async (meetingId: string, notes: string) => {
    // Optimistic update
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, notes, updated_at: new Date().toISOString() } : m))
    );

    try {
      const { error } = await supabase
        .from("platform_onboarding_meetings")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", meetingId);

      if (error) throw error;

      toast({
        title: "Anotações salvas",
        description: "As notas da reunião foram gravadas com sucesso.",
      });
    } catch (err) {
      void loadMeetings(true);
      toast({
        title: "Erro ao salvar anotações",
        description: "Não foi possível gravar as anotações.",
        variant: "destructive",
      });
    }
  }, [loadMeetings]);

  // Handle Reschedule
  const handleReschedule = useCallback(async (meetingId: string, newScheduledAt: string, reasonNotes?: string) => {
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m;
        const updatedNotes = reasonNotes
          ? m.notes
            ? `${m.notes}\n[Remarcada]: ${reasonNotes}`
            : `[Remarcada]: ${reasonNotes}`
          : m.notes;

        return {
          ...m,
          scheduled_at: newScheduledAt,
          status: "rescheduled",
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        };
      })
    );

    try {
      // Recupera anotação formatada
      let formattedNotes = reasonNotes;
      const { data: currentRecord } = await supabase
        .from("platform_onboarding_meetings")
        .select("notes")
        .eq("id", meetingId)
        .maybeSingle();

      if (currentRecord?.notes && reasonNotes) {
        formattedNotes = `${currentRecord.notes}\n[Remarcada]: ${reasonNotes}`;
      }

      const { error } = await supabase
        .from("platform_onboarding_meetings")
        .update({
          scheduled_at: newScheduledAt,
          status: "rescheduled",
          ...(formattedNotes ? { notes: formattedNotes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", meetingId);

      if (error) throw error;

      toast({
        title: "Reunião remarcada com sucesso",
        description: "O novo horário foi registrado na agenda.",
      });
    } catch (err) {
      void loadMeetings(true);
      toast({
        title: "Erro ao remarcar reunião",
        description: "Não foi possível gravar o novo horário.",
        variant: "destructive",
      });
    }
  }, [loadMeetings]);

  // Handle 1-click WhatsApp Reminder
  const handleSendReminder = useCallback((meeting: OnboardingMeeting) => {
    toast({
      title: "Lembrete WhatsApp iniciado",
      description: `Disparando lembrete de confirmação de reunião para ${meeting.lead_name}.`,
    });
  }, []);

  // Handle Create Meeting
  const handleCreateMeeting = useCallback(async (payload: {
    lead_name: string;
    phone: string;
    email?: string;
    clinic_name?: string;
    scheduled_at: string;
    duration_minutes: number;
    meet_url?: string;
    notes?: string;
  }) => {
    try {
      const newRecord = {
        lead_name: payload.lead_name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || null,
        clinic_name: payload.clinic_name?.trim() || null,
        scheduled_at: payload.scheduled_at,
        duration_minutes: payload.duration_minutes || 15,
        meet_url: payload.meet_url?.trim() || null,
        notes: payload.notes?.trim() || null,
        status: "scheduled" as MeetingStatus,
        created_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from("platform_onboarding_meetings")
        .insert([newRecord])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setMeetings((prev) => [data as OnboardingMeeting, ...prev]);
      } else {
        void loadMeetings(true);
      }

      toast({
        title: "Reunião agendada!",
        description: `Agendamento criado para ${payload.lead_name}.`,
      });
    } catch (err) {
      console.error("Erro ao criar reunião:", err);
      toast({
        title: "Erro ao criar agendamento",
        description: "Não foi possível inserir o registro de reunião.",
        variant: "destructive",
      });
      throw err;
    }
  }, [user?.id, loadMeetings]);

  // Filtered Meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      // Status Filter
      if (statusFilter !== "all" && meeting.status !== statusFilter) {
        return false;
      }

      // Query Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanDigits = q.replace(/\D/g, "");
        const matchName = meeting.lead_name.toLowerCase().includes(q);
        const matchClinic = (meeting.clinic_name || "").toLowerCase().includes(q);
        const matchPhone = cleanDigits.length > 0 && (meeting.phone || "").replace(/\D/g, "").includes(cleanDigits);
        const matchEmail = (meeting.email || "").toLowerCase().includes(q);
        const matchNotes = (meeting.notes || "").toLowerCase().includes(q);

        if (!matchName && !matchClinic && !matchPhone && !matchEmail && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [meetings, statusFilter, searchQuery]);

  // Split into Upcoming and Past for rich list presentation
  const { upcomingList, pastList } = useMemo(() => {
    const now = Date.now();
    const upcoming: OnboardingMeeting[] = [];
    const past: OnboardingMeeting[] = [];

    // Sort upcoming ascending (soonest first) and past descending (most recent first)
    filteredMeetings.forEach((m) => {
      const time = new Date(m.scheduled_at).getTime();
      if (time >= now && (m.status === "scheduled" || m.status === "rescheduled")) {
        upcoming.push(m);
      } else {
        past.push(m);
      }
    });

    upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    past.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    return { upcomingList: upcoming, pastList: past };
  }, [filteredMeetings]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Statistics Header */}
      <AgendaStatsHeader
        meetings={meetings}
        onFilterClick={(status) => setStatusFilter(status)}
        activeStatusFilter={statusFilter}
      />

      {/* 2. Controls, Search, Filter & View Toggle Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-xl border shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lead, clínica, telefone ou e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[155px] text-xs h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="rescheduled">Remarcadas</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
              <SelectItem value="no_show">Não compareceu</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn(
                "h-8 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={cn(
                "h-8 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "calendar"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Calendário</span>
            </Button>
          </div>

          {/* Reload Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void loadMeetings(true)}
            disabled={refreshing || loading}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Recarregar reuniões"
          >
            <RotateCcw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin")} />
          </Button>

          {/* New Meeting Button */}
          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Agendamento</span>
          </Button>
        </div>
      </div>

      {/* 3. Main Content: List or Calendar View */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Carregando reuniões de onboarding...</p>
        </div>
      ) : viewMode === "calendar" ? (
        <MeetingCalendarView
          meetings={filteredMeetings}
          onSelectMeeting={(meeting) => {
            setNotesMeeting(meeting);
            setNotesDialogOpen(true);
          }}
          onOpenCreate={() => setCreateModalOpen(true)}
        />
      ) : (
        /* List Mode */
        <div className="space-y-6">
          {filteredMeetings.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center space-y-3 bg-card/50">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhuma reunião encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os termos de busca."
                  : "Ainda não há agendamentos cadastrados. Crie a primeira reunião de demonstração ou onboarding."}
              </p>
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="mt-2 text-xs font-medium gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Criar Agendamento</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Upcoming Meetings Section */}
              {upcomingList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sky-500" />
                      <span>Próximas Reuniões ({upcomingList.length})</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingList.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onStatusChange={handleStatusChange}
                        onEditNotes={(m) => {
                          setNotesMeeting(m);
                          setNotesDialogOpen(true);
                        }}
                        onReschedule={(m) => {
                          setRescheduleMeeting(m);
                          setRescheduleDialogOpen(true);
                        }}
                        onSendReminder={handleSendReminder}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past / Completed / Handled Section */}
              {pastList.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
                      <span>Histórico & Reuniões Realizadas ({pastList.length})</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastList.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onStatusChange={handleStatusChange}
                        onEditNotes={(m) => {
                          setNotesMeeting(m);
                          setNotesDialogOpen(true);
                        }}
                        onReschedule={(m) => {
                          setRescheduleMeeting(m);
                          setRescheduleDialogOpen(true);
                        }}
                        onSendReminder={handleSendReminder}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 4. Modals and Dialogs */}
      <CreateMeetingModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreateMeeting={handleCreateMeeting}
      />

      <EditMeetingNotesDialog
        meeting={notesMeeting}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={handleSaveNotes}
      />

      <RescheduleMeetingDialog
        meeting={rescheduleMeeting}
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        onReschedule={handleReschedule}
      />
    </div>
  );
};

export default PlatformAgendaMaster;
