import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Phone, Calendar, Loader2, ChevronDown, ChevronUp,
  Pencil, Trash2, Palette, FolderPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

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

const PacienteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("lavender");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = async () => {
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
  };

  useEffect(() => { fetchData(); }, [id]);

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupColor("lavender");
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: any) => {
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
    fetchData();
  };

  const handleDeleteGroup = async (groupId: string) => {
    // Unlink sessions first
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro ao excluir grupo", variant: "destructive" }); }
    else { toast({ title: "Grupo excluído" }); }
    setDeleteConfirmId(null);
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

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
        <Button onClick={() => navigate(`/pacientes/${id}/sessao/novo`)}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Atendimento</span>
        </Button>
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
              <CardContent className="pt-0 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <p className="text-sm font-medium">{patient.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF</Label>
                  <p className="text-sm font-medium">{patient.cpf || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Idade</Label>
                  <p className="text-sm font-medium">{patient.age ? `${patient.age} anos` : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <p className="text-sm font-medium">{patient.phone || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="text-sm font-medium capitalize">{patient.status}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cadastrado em</Label>
                  <p className="text-sm font-medium">{new Date(patient.created_at).toLocaleDateString("pt-BR")}</p>
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
            {group.sessions.map((session: any) => (
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
    </motion.div>
  );
};

export default PacienteDetalhe;
