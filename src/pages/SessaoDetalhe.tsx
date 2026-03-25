import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildSessionPayload, isCompletedSessionLocked, type SessionFormValues } from "@/lib/session-payload";
import { getPreferredPatientGroupId } from "@/lib/patient-group-defaults";

type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value : "");

const readJsonStringArray = (value: Json | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const TECHNIQUES = [
  "Mobilização articular",
  "Alongamento",
  "Liberação miofascial",
  "Eletroterapia",
  "Cinesioterapia",
  "Termoterapia",
  "Crioterapia",
  "Acupuntura",
  "Bandagem funcional",
];

const SessaoDetalhe = () => {
  const { id: patientId, sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = sessionId === "novo";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [startingFromThis, setStartingFromThis] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [locked, setLocked] = useState(false);

  // Form state
  const [queixa, setQueixa] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [painScore, setPainScore] = useState([0]);
  const [complexityScore, setComplexityScore] = useState([0]);
  const [observacoes, setObservacoes] = useState("");
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [descricaoTratamento, setDescricaoTratamento] = useState("");
  const [orientacoes, setOrientacoes] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) return;

      // Fetch patient name and groups in parallel
      const [patientRes, groupsRes, lastUsedGroupRes] = await Promise.all([
        supabase.from("patients").select("name").eq("id", patientId).maybeSingle(),
        supabase.from("patient_groups").select("*").eq("patient_id", patientId),
        supabase
          .from("sessions")
          .select("group_id")
          .eq("patient_id", patientId)
          .not("group_id", "is", null)
          .order("session_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      
      if (patientRes.data) setPatientName(patientRes.data.name);
      if (groupsRes.data) {
        setGroups(groupsRes.data);

        if (isNew) {
          setGroupId(getPreferredPatientGroupId(groupsRes.data, lastUsedGroupRes.data?.group_id ?? null));
        }
      }

      if (!isNew && sessionId) {
        const { data } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .maybeSingle();

        if (data) {
          const anamnesis = isJsonObject(data.anamnesis) ? data.anamnesis : {};
          const treatment = isJsonObject(data.treatment) ? data.treatment : {};
          setQueixa(readJsonString(anamnesis.queixa));
          setSintomas(readJsonString(anamnesis.sintomas));
          setObservacoes(readJsonString(anamnesis.observacoes));
          setPainScore([data.pain_score || 0]);
          setComplexityScore([data.complexity_score || 0]);
          setSelectedTechniques(readJsonStringArray(treatment.techniques));
          setDescricaoTratamento(readJsonString(treatment.descricao));
          setOrientacoes(readJsonString(treatment.orientacoes));
          setStatus(data.status);
          setNotes(data.notes || "");
          setGroupId(data.group_id);
          setSessionDate(new Date(data.session_date).toLocaleDateString("pt-BR"));
          setLocked(isCompletedSessionLocked(false, data.status));
        }
      } else {
        setLocked(false);
      }
      setLoading(false);
    };
    fetchData();
  }, [patientId, sessionId, isNew]);

  const formValues: SessionFormValues = {
    complexityScore: complexityScore[0],
    descricaoTratamento,
    groupId,
    notes,
    observacoes,
    orientacoes,
    painScore: painScore[0],
    queixa,
    selectedTechniques,
    sintomas,
    status,
  };

  const buildCurrentSessionPayload = (clinicId: string | null, statusOverride?: string) =>
    buildSessionPayload({
      clinicId,
      patientId: patientId!,
      userId: user!.id,
      values: formValues,
      statusOverride,
    });

  const handleSave = async () => {
    if (!patientId || !user || locked) return;
    setSaving(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const sessionData = buildCurrentSessionPayload(clinicRes.data);

    if (isNew) {
      const { data, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("id")
        .single();

      if (error) {
        toast({ title: "Erro ao criar atendimento", variant: "destructive" });
      } else {
        toast({ title: "Atendimento criado" });
        navigate(`/pacientes/${patientId}/sessao/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase
        .from("sessions")
        .update(sessionData)
        .eq("id", sessionId!);

      if (error) {
        toast({ title: "Erro ao salvar atendimento", variant: "destructive" });
      } else {
        setLocked(isCompletedSessionLocked(false, status));
        toast({
          title: status === "concluído" ? "Atendimento concluído" : "Atendimento salvo",
          description:
            status === "concluído"
              ? "Este atendimento foi bloqueado para edição. Use a duplicação para iniciar o próximo."
              : undefined,
        });
      }
    }
    setSaving(false);
  };

  const handleStartFromThis = async () => {
    if (!patientId || !user || isNew) return;
    setStartingFromThis(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const sessionData = buildCurrentSessionPayload(clinicRes.data, "rascunho");

    const { data, error } = await supabase
      .from("sessions")
      .insert(sessionData)
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erro ao iniciar novo atendimento", variant: "destructive" });
    } else {
      toast({ title: "Novo atendimento iniciado", description: "Os dados foram copiados para um novo rascunho editável." });
      navigate(`/pacientes/${patientId}/sessao/${data.id}`);
    }

    setStartingFromThis(false);
  };

  const toggleTechnique = (tech: string) => {
    setSelectedTechniques((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const painColor =
    painScore[0] <= 3 ? "text-success" : painScore[0] <= 6 ? "text-warning" : "text-destructive";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    concluído: "bg-success/15 text-success border-success/20",
    rascunho: "bg-warning/15 text-warning border-warning/20",
    cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/pacientes/${patientId}`)}
            aria-label="Voltar para paciente"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {isNew ? "Novo Atendimento" : `Atendimento — ${sessionDate}`}
            </h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[status] || ""}>
          {status}
        </Badge>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2 flex-wrap items-center">
        {!locked && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            <span>Salvar</span>
          </Button>
        )}
        {!isNew && (
          <Button size="sm" variant="outline" onClick={handleStartFromThis} disabled={startingFromThis}>
            {startingFromThis ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            <span>Iniciar Novo Atendimento a Partir Deste</span>
          </Button>
        )}
        <Select value={status} onValueChange={setStatus} disabled={locked}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="concluído">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        {groups.length > 0 && (
          <Select value={groupId || "none"} onValueChange={(v) => setGroupId(v === "none" ? null : v)} disabled={locked}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Sem grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem grupo</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {locked && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Este atendimento já foi concluído e não pode mais ser editado. Use "Iniciar novo atendimento a partir deste"
          para abrir um novo rascunho com todos os campos já preenchidos.
        </div>
      )}

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="text-sm font-medium">Anotações rápidas</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações gerais sobre o atendimento..."
          className="mt-1.5"
          rows={2}
          disabled={locked}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anamnese" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="anamnese" className="flex-1 max-w-[200px]">Anamnese</TabsTrigger>
          <TabsTrigger value="tratamento" className="flex-1 max-w-[200px]">Tratamento</TabsTrigger>
        </TabsList>

        <TabsContent value="anamnese" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label htmlFor="queixa" className="text-sm font-medium">Queixa Principal</Label>
                <Textarea
                  id="queixa"
                  value={queixa}
                  onChange={(e) => setQueixa(e.target.value)}
                  placeholder="Descreva a queixa principal do paciente..."
                  className="mt-1.5"
                  rows={3}
                  disabled={locked}
                />
              </div>

              <div>
                <Label htmlFor="sintomas" className="text-sm font-medium">Sintomas</Label>
                <Textarea
                  id="sintomas"
                  value={sintomas}
                  onChange={(e) => setSintomas(e.target.value)}
                  placeholder="Liste os sintomas relatados..."
                  className="mt-1.5"
                  rows={2}
                  disabled={locked}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">
                    Nota da Dor (Paciente): <span className={`font-bold ${painColor}`}>{painScore[0]}/10</span>
                  </Label>
                  <Slider
                    value={painScore}
                    onValueChange={setPainScore}
                    max={10}
                    step={1}
                    className="mt-3"
                    disabled={locked}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Nota de Complexidade (Profissional): <span className="font-bold">{complexityScore[0]}/10</span>
                  </Label>
                  <Slider
                    value={complexityScore}
                    onValueChange={setComplexityScore}
                    max={10}
                    step={1}
                    className="mt-3"
                    disabled={locked}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes" className="text-sm font-medium">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais sobre a anamnese..."
                  className="mt-1.5"
                  rows={4}
                  disabled={locked}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tratamento" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label className="text-sm font-medium">Técnicas Aplicadas</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {TECHNIQUES.map((tech) => (
                    <label
                      key={tech}
                      className={`flex items-center gap-2 p-2 rounded-md border transition-colors text-sm ${
                        selectedTechniques.includes(tech) ? "bg-accent border-primary" : ""
                      } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-accent/50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTechniques.includes(tech)}
                        onChange={() => toggleTechnique(tech)}
                        className="rounded border-input"
                        disabled={locked}
                      />
                      <span>{tech}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="descricao-tratamento" className="text-sm font-medium">Descrição do Tratamento</Label>
                <Textarea
                  id="descricao-tratamento"
                  value={descricaoTratamento}
                  onChange={(e) => setDescricaoTratamento(e.target.value)}
                  placeholder="Descreva o tratamento realizado..."
                  className="mt-1.5"
                  rows={4}
                  disabled={locked}
                />
              </div>

              <div>
                <Label htmlFor="orientacoes" className="text-sm font-medium">Orientações ao Paciente</Label>
                <Textarea
                  id="orientacoes"
                  value={orientacoes}
                  onChange={(e) => setOrientacoes(e.target.value)}
                  placeholder="Orientações e exercícios para casa..."
                  className="mt-1.5"
                  rows={3}
                  disabled={locked}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default SessaoDetalhe;
