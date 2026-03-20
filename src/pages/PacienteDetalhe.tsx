import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Plus, Phone, Calendar, Loader2, ChevronDown, ChevronUp,
  Pencil, Trash2, Palette, FolderPlus, ClipboardEdit, Share2, Copy, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildPatientRegistrationUrl, getPatientRegistrationPassword } from "@/lib/patient-registration";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];
type ShareLinkResponse = {
  completed: boolean;
  password_prefix: string;
  token: string;
};

const GROUP_COLORS = [
  { value: "lavender", label: "Lavanda" },
  { value: "sage", label: "Verde" },
  { value: "peach", label: "Pêssego" },
  { value: "sky", label: "Azul" },
  { value: "rose", label: "Rosa" },
];

const groupBorderColors: Record<string, string> = {
  lavender: "border-l-group-lavender",
  sage: "border-l-group-sage",
  peach: "border-l-group-peach",
  sky: "border-l-group-sky",
  rose: "border-l-group-rose",
};

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const PainIndicator = ({ score }: { score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`w-2 h-4 rounded-sm ${i < score ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/10</span>
    </div>
  );
};
const InfoField = ({ label, value, capitalize: cap }: { label: string; value?: string | null; capitalize?: boolean }) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <p className={`text-sm font-medium ${cap ? "capitalize" : ""}`}>{value || "—"}</p>
  </div>
);

const isShareLinkResponse = (value: Json): value is ShareLinkResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, Json | undefined>;
  return (
    typeof data.completed === "boolean" &&
    typeof data.password_prefix === "string" &&
    typeof data.token === "string"
  );
};

const PacienteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("lavender");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareCompleted, setShareCompleted] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [pRes, gRes, sRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("patient_groups").select("*").eq("patient_id", id),
      supabase.from("sessions").select("*").eq("patient_id", id).order("session_date", { ascending: false }),
    ]);

    setPatient(pRes.data);
    setGroups(gRes.data ?? []);
    setSessions(sRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleOpenShareDialog = useCallback(async () => {
    if (!id || !patient) return;
    setGeneratingShareLink(true);

    const { data, error } = await supabase.rpc("create_patient_registration_link", {
      _patient_id: id,
    });

    if (error || !data || !isShareLinkResponse(data)) {
      toast({
        title: "Não foi possível gerar o link",
        description: error?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setGeneratingShareLink(false);
      return;
    }

    setShareLink(buildPatientRegistrationUrl(window.location.origin, data.token));
    setSharePassword(data.password_prefix);
    setShareCompleted(data.completed);
    setShareDialogOpen(true);
    setGeneratingShareLink(false);
  }, [id, patient]);

  useEffect(() => {
    const shouldOpenShareDialog = (location.state as { openShareDialog?: boolean } | null)?.openShareDialog;

    if (!shouldOpenShareDialog || !patient) return;

    void handleOpenShareDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [handleOpenShareDialog, location.pathname, location.state, navigate, patient]);

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupColor("lavender");
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: PatientGroup) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupColor(g.color);
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !id || !user) return;
    setSavingGroup(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });

    if (editingGroup) {
      const { error } = await supabase.from("patient_groups").update({ name: groupName.trim(), color: groupColor }).eq("id", editingGroup.id);
      if (error) { toast({ title: "Erro ao atualizar grupo", variant: "destructive" }); }
      else { toast({ title: "Grupo atualizado" }); }
    } else {
      const { error } = await supabase.from("patient_groups").insert({
        name: groupName.trim(),
        color: groupColor,
        patient_id: id,
        user_id: user.id,
        clinic_id: clinicRes.data,
      });
      if (error) { toast({ title: "Erro ao criar grupo", variant: "destructive" }); }
      else { toast({ title: "Grupo criado" }); }
    }

    setSavingGroup(false);
    setGroupDialogOpen(false);
    void fetchData();
  };

  const handleDeleteGroup = async (groupId: string) => {
    // Unlink sessions first
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro ao excluir grupo", variant: "destructive" }); }
    else { toast({ title: "Grupo excluído" }); }
    setDeleteConfirmId(null);
    void fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

  const sharePasswordAvailable = !!getPatientRegistrationPassword(patient.cpf);
  const groupedSessions = groups.map((g) => ({
    ...g,
    sessions: sessions.filter((s) => s.group_id === g.id),
  }));
  const ungroupedSessions = sessions.filter((s) => !s.group_id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{patient.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {patient.age && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {patient.age} anos</span>}
            {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/pacientes/${id}/cadastro`)}>
            <ClipboardEdit className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Cadastro Completo</span>
          </Button>
          <Button onClick={() => navigate(`/pacientes/${id}/sessao/novo`)}>
            <Plus className="h-4 w-4 mr-2" />
            <span>Novo Atendimento</span>
          </Button>
        </div>
      </div>

      {/* Expandable patient info */}
      <Card>
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="font-medium text-sm">Mais informações</span>
          {showInfo ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-4 space-y-5">
                {/* Dados básicos */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dados Básicos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="Nome completo" value={patient.name} />
                    <InfoField
                      label="Data de nascimento"
                      value={patient.date_of_birth ? new Date(`${patient.date_of_birth}T12:00:00`).toLocaleDateString("pt-BR") : null}
                    />
                    <InfoField label="Idade" value={patient.age ? `${patient.age} anos` : null} />
                    <InfoField label="CPF" value={patient.cpf} />
                    <InfoField label="Telefone" value={patient.phone} />
                    <InfoField label="E-mail" value={patient.email} />
                    <InfoField label="Status" value={patient.status} capitalize />
                    <InfoField label="Cadastrado em" value={new Date(patient.created_at).toLocaleDateString("pt-BR")} />
                  </div>
                </div>

                {/* Dados pessoais */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="Gênero" value={patient.gender} capitalize />
                    <InfoField label="Pronome" value={patient.pronoun} />
                    <InfoField label="RG" value={patient.rg} />
                    <InfoField label="Tipo sanguíneo" value={patient.blood_type} />
                    <InfoField label="Profissão" value={patient.profession} />
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Endereço</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="CEP" value={patient.cep} />
                    <InfoField label="Rua" value={patient.street} />
                    <InfoField label="Número" value={patient.address_number} />
                    <InfoField label="Complemento" value={patient.address_complement} />
                    <InfoField label="Bairro" value={patient.neighborhood} />
                    <InfoField label="Cidade" value={patient.city} />
                    <InfoField label="Estado" value={patient.state} />
                    <InfoField label="País" value={patient.country} />
                  </div>
                </div>

                {/* Histórico clínico */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico Clínico</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoField label="Problemas crônicos" value={patient.chronic_conditions} />
                    <InfoField label="Cirurgias" value={patient.surgeries} />
                    <InfoField label="Medicamentos contínuos" value={patient.continuous_medications} />
                    <InfoField label="Alergias" value={patient.allergies} />
                    <InfoField label="Observações clínicas" value={patient.clinical_notes} />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/pacientes/${id}/cadastro`)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Editar dados cadastrais
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenShareDialog()}
                    disabled={generatingShareLink || !sharePasswordAvailable || patient.registration_complete}
                  >
                    {generatingShareLink ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Share2 className="h-3.5 w-3.5 mr-2" />}
                    Compartilhar com o paciente
                  </Button>
                  {patient.registration_complete && (
                    <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Cadastro concluído
                    </Badge>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Group management toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Grupos & Atendimentos</h2>
        <Button variant="outline" size="sm" onClick={openNewGroup}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      {/* Groups with sessions */}
      {groupedSessions.map((group) => (
        <Card key={group.id}>
          <CardHeader className={`border-l-4 rounded-tl-lg ${groupBorderColors[group.color] || ""}`}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{group.sessions.length} atendimento{group.sessions.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGroup(group)} aria-label="Editar grupo">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(group.id)} aria-label="Excluir grupo">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {group.sessions.map((session) => (
              <Card
                key={session.id}
                className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${groupBorderColors[group.color] || ""}`}
                onClick={() => navigate(`/pacientes/${id}/sessao/${session.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${id}/sessao/${session.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
                        <Badge variant="outline" className={`text-xs ${statusColors[session.status] || ""}`}>{session.status}</Badge>
                      </div>
                      {session.notes && <p className="text-sm text-muted-foreground">{session.notes}</p>}
                    </div>
                    <div className="space-y-1.5 shrink-0">
                      <div><span className="text-xs text-muted-foreground block">Dor</span><PainIndicator score={session.pain_score || 0} /></div>
                      <div><span className="text-xs text-muted-foreground block">Complexidade</span><PainIndicator score={session.complexity_score || 0} /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {group.sessions.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum atendimento neste grupo.</p>}
          </CardContent>
        </Card>
      ))}

      {/* Ungrouped sessions */}
      {ungroupedSessions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Atendimentos sem grupo</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3">
            {ungroupedSessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/pacientes/${id}/sessao/${session.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${id}/sessao/${session.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
                      <Badge variant="outline" className={`text-xs ml-2 ${statusColors[session.status] || ""}`}>{session.status}</Badge>
                    </div>
                    <div className="flex gap-4">
                      <div><span className="text-xs text-muted-foreground">Dor: {session.pain_score || 0}/10</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 && groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum atendimento registrado.</p>
        </Card>
      )}

      {/* Group create/edit dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Lombalgia crônica" />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={groupColor} onValueChange={setGroupColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-group-${c.value}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveGroup} disabled={!groupName.trim() || savingGroup}>
              {savingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGroup ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir grupo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Os atendimentos deste grupo serão mantidos, mas ficarão sem grupo.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteGroup(deleteConfirmId)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar com o paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareCompleted ? (
              <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Link do cadastro</Label>
                  <div className="flex gap-2">
                    <Input value={shareLink} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareLink);
                        toast({ title: "Link copiado" });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-medium">Senha de acesso</p>
                  <p className="text-muted-foreground mt-1">
                    Oriente o paciente a usar os 6 primeiros dígitos do CPF para abrir o formulário.
                  </p>
                  <p className="mt-2 font-mono text-base">{sharePassword}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default PacienteDetalhe;
