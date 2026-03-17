import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Phone, Mail, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const groupBorderColors: Record<string, string> = {
  lavender: "border-l-group-lavender",
  sage: "border-l-group-sage",
  peach: "border-l-group-peach",
  sky: "border-l-group-sky",
  rose: "border-l-group-rose",
};

const groupBadgeColors: Record<string, string> = {
  lavender: "bg-group-lavender/40 text-foreground border-group-lavender",
  sage: "bg-group-sage/40 text-foreground border-group-sage",
  peach: "bg-group-peach/40 text-foreground border-group-peach",
  sky: "bg-group-sky/40 text-foreground border-group-sky",
  rose: "bg-group-rose/40 text-foreground border-group-rose",
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
  const [patient, setPatient] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
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
    fetch();
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

  // Group sessions by group_id
  const groupedSessions = groups.map((g) => ({
    ...g,
    sessions: sessions.filter((s) => s.group_id === g.id),
  }));
  const ungroupedSessions = sessions.filter((s) => !s.group_id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Atendimento</span>
        </Button>
      </div>

      {groupedSessions.map((group) => (
        <Card key={group.id}>
          <CardHeader className={`border-l-4 rounded-tl-lg ${groupBorderColors[group.color] || ""}`}>
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{group.sessions.length} atendimento{group.sessions.length !== 1 ? "s" : ""}</p>
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
    </motion.div>
  );
};

export default PacienteDetalhe;
