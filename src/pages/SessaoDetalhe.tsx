import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Copy, Loader2, Plus, Trash2, Pencil, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { readBusinessHours } from "@/lib/clinic-settings";
import { readProfileAddress } from "@/lib/profile-settings";
import { buildSessionPayload, type SessionFormValues } from "@/lib/session-payload";
import {
  buildSessionDocument,
  isSessionImmutable,
  printSessionDocument,
  type SessionDocumentKind,
} from "@/lib/session-documents";
import { getPreferredPatientGroupId } from "@/lib/patient-group-defaults";
import { buildSessionEditHistoryView, formatSessionAuditDateTime, getSessionPersonLabel } from "@/lib/session-people";
import { createTreatmentBlock, formatTreatmentSummary, readTreatmentState, type TreatmentBlock } from "@/lib/session-treatment";
import { getSessionPreviewIndicators, getSessionSummaryContent } from "@/lib/session-preview";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import {
  buildTemplateLayout,
  getVisibleTemplateFields,
  type AnamnesisField,
  type AnamnesisFormResponse,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";

type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type AnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
type ClinicDocumentSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  "address" | "anamnesis_base_schema" | "business_hours" | "cnpj" | "email" | "legal_name" | "logo_url" | "name" | "phone"
>;
type CollaboratorProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "email" | "full_name" | "id" | "job_title" | "phone" | "professional_license" | "specialty"
>;
type SessionEditHistoryRow = Database["public"]["Tables"]["session_edit_history"]["Row"];

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value : "");

const readJsonRecord = (value: Json | null): AnamnesisFormResponse =>
  isJsonObject(value) ? (value as Record<string, string | number | string[] | boolean | null>) : {};

const readTemplateSchema = (value: Json): AnamnesisTemplateSchema =>
  Array.isArray(value) ? (value as AnamnesisTemplateSchema) : [];

const formatCnpj = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 14);

  if (digits.length !== 14) {
    return value?.trim() || "";
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatAddressLine = (value: Json | null | undefined) => {
  const address = readProfileAddress(value);

  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join(" - "),
    address.cep,
  ]
    .filter(Boolean)
    .join(", ");
};

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, index) => (
          <div key={index} className={`h-4 w-2 rounded-sm ${index < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/{max}</span>
    </div>
  );
};

const SessaoDetalhe = () => {
  const { id: patientId, sessionId } = useParams();
  const navigate = useNavigate();
  const { user, clinicId, profile } = useAuth();
  const isNew = sessionId === "novo";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [startingFromThis, setStartingFromThis] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [patientName, setPatientName] = useState("");
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([]);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState<AnamnesisTemplate[]>([]);
  const [baseTemplateSchema, setBaseTemplateSchema] = useState<AnamnesisTemplateSchema>([]);
  const [clinicDocumentInfo, setClinicDocumentInfo] = useState<ClinicDocumentSummary | null>(null);
  const [locked, setLocked] = useState(false);
  const [createdByUserId, setCreatedByUserId] = useState<string | null>(user?.id ?? null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<SessionEditHistoryRow[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Form state
  const [queixa, setQueixa] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [painScore, setPainScore] = useState([0]);
  const [complexityScore, setComplexityScore] = useState([0]);
  const [observacoes, setObservacoes] = useState("");
  const [treatmentBlocks, setTreatmentBlocks] = useState<TreatmentBlock[]>([]);
  const [treatmentGeneralGuidance, setTreatmentGeneralGuidance] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [anamnesisTemplateId, setAnamnesisTemplateId] = useState<string | null>(null);
  const [anamnesisFormResponse, setAnamnesisFormResponse] = useState<AnamnesisFormResponse>({});

  const loadSessionPage = useCallback(async () => {
    if (!patientId || !clinicId) {
      return;
    }

    setLoading(true);

    const [patientRes, groupsRes, lastUsedGroupRes, templatesRes, clinicRes, profilesRes] = await Promise.all([
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
      supabase
        .from("anamnesis_form_templates")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .eq("is_system_default", false)
        .order("updated_at", { ascending: false }),
      supabase
        .from("clinics")
        .select("address, anamnesis_base_schema, business_hours, cnpj, email, legal_name, logo_url, name, phone")
        .eq("id", clinicId)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, specialty, job_title, professional_license")
        .eq("clinic_id", clinicId),
    ]);

    if (patientRes.data) {
      setPatientName(patientRes.data.name);
    }

    if (templatesRes.data) {
      setAnamnesisTemplates(templatesRes.data);

      if (isNew && templatesRes.data.length > 0) {
        setAnamnesisTemplateId((current) => current ?? templatesRes.data[0].id);
      }
    }

    if (clinicRes.data) {
      setClinicDocumentInfo(clinicRes.data);
      setBaseTemplateSchema(readTemplateSchema(clinicRes.data.anamnesis_base_schema));
    }

    if (profilesRes.data) {
      setCollaboratorProfiles(profilesRes.data as CollaboratorProfile[]);
    }

    if (groupsRes.data) {
      setGroups(groupsRes.data);

      if (isNew) {
        setGroupId(getPreferredPatientGroupId(groupsRes.data, lastUsedGroupRes.data?.group_id ?? null));
      }
    }

    if (!isNew && sessionId) {
      const [{ data: sessionData }, { data: historyData }] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase.from("session_edit_history").select("*").eq("session_id", sessionId).order("edited_at", { ascending: false }),
      ]);

      if (sessionData) {
        const anamnesis = isJsonObject(sessionData.anamnesis) ? sessionData.anamnesis : {};
        const treatment = isJsonObject(sessionData.treatment) ? sessionData.treatment : {};
        const treatmentState = readTreatmentState(treatment);

        setQueixa(readJsonString(anamnesis.queixa));
        setSintomas(readJsonString(anamnesis.sintomas));
        setObservacoes(readJsonString(anamnesis.observacoes));
        setPainScore([sessionData.pain_score || 0]);
        setComplexityScore([sessionData.complexity_score || 0]);
        setTreatmentBlocks(treatmentState.blocks);
        setTreatmentGeneralGuidance(treatmentState.generalGuidance);
        setStatus(sessionData.status);
        setNotes(sessionData.notes || "");
        setGroupId(sessionData.group_id);
        setSessionDate(new Date(sessionData.session_date).toLocaleDateString("pt-BR"));
        setAnamnesisTemplateId(sessionData.anamnesis_template_id);
        setAnamnesisFormResponse(readJsonRecord(sessionData.anamnesis_form_response));
        setLocked(isSessionImmutable(false, sessionData.status));
        setCreatedByUserId(sessionData.user_id);
        setSessionCreatedAt(sessionData.created_at);
        setEditHistory(historyData ?? []);
        setIsEditing(false);
      }
    } else {
      setLocked(false);
      setIsEditing(true);
      setCreatedByUserId(user?.id ?? null);
      setSessionCreatedAt(null);
      setEditHistory([]);
    }

    setLoading(false);
  }, [clinicId, isNew, patientId, sessionId, user?.id]);

  useEffect(() => {
    void loadSessionPage();
  }, [loadSessionPage]);

  const activeTemplate = anamnesisTemplates.find((template) => template.id === anamnesisTemplateId) ?? null;
  const activeTemplateSchema = activeTemplate ? readTemplateSchema(activeTemplate.schema) : [];
  const visibleBaseFields = getVisibleTemplateFields(baseTemplateSchema, anamnesisFormResponse);
  const visibleTemplateFields = getVisibleTemplateFields(activeTemplateSchema, anamnesisFormResponse);
  const visibleBaseSliderFields = visibleBaseFields.filter((field) => field.type === "slider");
  const baseLayout = buildTemplateLayout(visibleBaseFields.filter((field) => field.type !== "slider")).filter(
    (item) => item.type === "field" || item.items.length > 0
  );
  const extraLayout = buildTemplateLayout(visibleTemplateFields);
  const previewIndicators = getSessionPreviewIndicators(
    {
      anamnesis_form_response: anamnesisFormResponse as Json,
      complexity_score: complexityScore[0],
      pain_score: painScore[0],
    },
    baseTemplateSchema
  );
  const collaboratorProfileMap = useMemo(
    () => new Map(collaboratorProfiles.map((person) => [person.id, person])),
    [collaboratorProfiles]
  );
  const creatorProfile =
    (createdByUserId ? collaboratorProfileMap.get(createdByUserId) : null) ??
    (profile && createdByUserId === user?.id
      ? {
          email: profile.email,
          full_name: profile.full_name,
          id: profile.id,
          job_title: profile.job_title,
          phone: profile.phone,
          professional_license: profile.professional_license,
          specialty: profile.specialty,
        }
      : null);
  const editHistoryView = useMemo(
    () => buildSessionEditHistoryView(editHistory, collaboratorProfileMap),
    [collaboratorProfileMap, editHistory]
  );

  const updateFormResponse = (fieldId: string, value: string | number | string[] | boolean | null) => {
    setAnamnesisFormResponse((current) => ({
      ...current,
      [fieldId]: value,
    }));
  };

  const readBaseSliderValue = (field: AnamnesisField) => {
    if (field.systemKey === "pain_score") {
      return painScore[0];
    }

    if (field.systemKey === "complexity_score") {
      return complexityScore[0];
    }

    const responseValue = anamnesisFormResponse[field.id];

    if (typeof responseValue === "number") {
      return responseValue;
    }

    if (typeof responseValue === "string" && responseValue.trim()) {
      const parsed = Number(responseValue);
      return Number.isNaN(parsed) ? field.min ?? 0 : parsed;
    }

    return field.min ?? 0;
  };

  const updateBaseSliderValue = (field: AnamnesisField, next: number) => {
    if (field.systemKey === "pain_score") {
      setPainScore([next]);
      return;
    }

    if (field.systemKey === "complexity_score") {
      setComplexityScore([next]);
      return;
    }

    updateFormResponse(field.id, next);
  };

  const formValues: SessionFormValues = {
    anamnesisFormResponse,
    anamnesisTemplateId,
    complexityScore: complexityScore[0],
    groupId,
    notes,
    observacoes,
    painScore: painScore[0],
    queixa,
    sintomas,
    status,
    treatmentBlocks,
    treatmentGeneralGuidance,
  };

  const buildCurrentSessionPayload = (clinicId: string | null, statusOverride?: string) =>
    buildSessionPayload({
      clinicId,
      creatorUserId: createdByUserId ?? user!.id,
      patientId: patientId!,
      values: formValues,
      statusOverride,
    });

  const handleSave = async () => {
    if (!patientId || !user || locked || (!isNew && !isEditing)) return;
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
        setIsEditing(false);
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
        await loadSessionPage();
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

  const addTreatmentBlock = () => {
    setTreatmentBlocks((current) => [...current, createTreatmentBlock(current.length)]);
  };

  const updateTreatmentBlock = (blockId: string, changes: Partial<TreatmentBlock>) => {
    setTreatmentBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, ...changes } : block))
    );
  };

  const removeTreatmentBlock = (blockId: string) => {
    setTreatmentBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const painColor =
    painScore[0] <= 3 ? "text-success" : painScore[0] <= 6 ? "text-warning" : "text-destructive";

  const readOnly = locked || (!isNew && !isEditing);
  const canEditSavedDraft = !isNew && status === "rascunho";
  const canDeleteDraft = !isNew && status === "rascunho";
  const treatmentSummary = formatTreatmentSummary({
    blocks: treatmentBlocks,
    generalGuidance: treatmentGeneralGuidance,
  });
  const sessionSummary = getSessionSummaryContent(
    {
      anamnesis: {
        observacoes,
        queixa,
        sintomas,
      },
      anamnesis_form_response: anamnesisFormResponse as Json,
      complexity_score: complexityScore[0],
      pain_score: painScore[0],
    },
    baseTemplateSchema,
    activeTemplateSchema
  );

  const handleDelete = async () => {
    if (!sessionId || !canDeleteDraft) {
      return;
    }

    if (!window.confirm("Excluir este atendimento em rascunho?")) {
      return;
    }

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

    if (error) {
      toast({ title: "Erro ao excluir atendimento", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Atendimento excluído" });
    navigate(`/pacientes/${patientId}`);
  };

  const buildCurrentDocumentData = () => ({
    anamnesisIndicators: previewIndicators,
    anamnesisSummary: sessionSummary,
    appName: "Pronto Health - Fisio",
    clinic: {
      address: formatAddressLine(clinicDocumentInfo?.address),
      businessHours: readBusinessHours(clinicDocumentInfo?.business_hours).summary,
      cnpj: formatCnpj(clinicDocumentInfo?.cnpj),
      email: clinicDocumentInfo?.email ?? null,
      legalName: clinicDocumentInfo?.legal_name ?? null,
      logoUrl: clinicDocumentInfo?.logo_url ?? null,
      name: clinicDocumentInfo?.name ?? "Pronto Health - Fisio",
      phone: clinicDocumentInfo?.phone ?? null,
    },
    generatedAt: new Date().toLocaleString("pt-BR"),
    patientName,
    provider: {
      email: creatorProfile?.email ?? null,
      fullName: getSessionPersonLabel(creatorProfile, "Profissional responsável"),
      jobTitle: creatorProfile?.job_title ?? null,
      phone: creatorProfile?.phone ?? null,
      professionalLicense: creatorProfile?.professional_license ?? null,
      specialty: creatorProfile?.specialty ?? null,
    },
    quickNotes: notes,
    sessionDate,
    treatmentDetails: {
      blocks: treatmentBlocks,
      generalGuidance: treatmentGeneralGuidance,
    },
    treatmentSummary,
  });

  const handleShareDocument = async (kind: SessionDocumentKind) => {
    const documentData = buildSessionDocument(kind, buildCurrentDocumentData());

    try {
      if (navigator.share) {
        await navigator.share({
          text: documentData.text,
          title: documentData.title,
        });
      } else {
        await navigator.clipboard.writeText(documentData.text);
        toast({ title: "Documento copiado para a área de transferência" });
      }
    } catch (error) {
      toast({
        title: "Não foi possível compartilhar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePrintDocument = async (kind: SessionDocumentKind) => {
    try {
      await printSessionDocument(kind, buildCurrentDocumentData());
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o documento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const renderDynamicField = (field: AnamnesisField) => {
    if (field.systemKey === "queixa") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={queixa}
            onChange={(event) => setQueixa(event.target.value)}
            placeholder={field.placeholder || "Descreva a queixa principal do paciente..."}
            className="mt-1.5"
            rows={3}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "sintomas") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={sintomas}
            onChange={(event) => setSintomas(event.target.value)}
            placeholder={field.placeholder || "Liste os sintomas relatados..."}
            className="mt-1.5"
            rows={2}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "pain_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className={`text-sm font-bold ${painColor}`}>{painScore[0]}/10</span>
          </div>
          <Slider value={painScore} onValueChange={setPainScore} max={10} step={1} className="mt-3" disabled={locked} />
        </div>
      );
    }

    if (field.systemKey === "complexity_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-bold">{complexityScore[0]}/10</span>
          </div>
          <Slider value={complexityScore} onValueChange={setComplexityScore} max={10} step={1} className="mt-3" disabled={locked} />
        </div>
      );
    }

    if (field.systemKey === "observacoes") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            placeholder={field.placeholder || "Observações adicionais sobre a anamnese..."}
            className="mt-1.5"
            rows={4}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "section") {
      return (
        <div key={field.id} className="rounded-lg border bg-muted/30 p-4">
          <p className="font-medium">{field.label}</p>
          {field.helpText && <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    }

    const value = anamnesisFormResponse[field.id];

    if (field.type === "short_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "long_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
            rows={4}
          />
        </div>
      );
    }

    if (field.type === "number") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            type="number"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value === "" ? null : Number(event.target.value))}
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "slider") {
      const sliderValue = typeof value === "number" ? value : field.min ?? 0;
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-semibold">{sliderValue}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={([next]) => updateFormResponse(field.id, next)}
            min={field.min ?? 0}
            max={field.max ?? 10}
            step={1}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => updateFormResponse(field.id, next)} disabled={locked}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "multiple_choice") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={(next) => updateFormResponse(field.id, next)}>
            {(field.options ?? []).map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <RadioGroupItem value={option.id} id={`${field.id}_${option.id}`} disabled={locked} />
                <Label htmlFor={`${field.id}_${option.id}`}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }

    if (field.type === "checklist") {
      const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="space-y-2">
            {(field.options ?? []).map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}_${option.id}`}
                  checked={selectedValues.includes(option.id)}
                  disabled={locked}
                  onCheckedChange={(checked) => {
                    const next = checked === true
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((item) => item !== option.id);
                    updateFormResponse(field.id, next);
                  }}
                />
                <Label htmlFor={`${field.id}_${option.id}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "section_selector") {
      const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      return (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="space-y-3">
            {(field.options ?? []).map((option) => (
              <div key={option.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="font-medium text-sm">{option.label}</p>
                  {option.description && <p className="text-xs text-muted-foreground mt-1">{option.description}</p>}
                </div>
                <Switch
                  checked={selectedValues.includes(option.id)}
                  disabled={locked}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((item) => item !== option.id);
                    updateFormResponse(field.id, next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderTemplateLayout = (layout: ReturnType<typeof buildTemplateLayout>) => (
    <div className="space-y-4">
      {layout.map((item) => {
        if (item.type === "field") {
          return renderDynamicField(item.field);
        }

        if (item.type === "horizontal_section") {
          return (
            <Card key={item.field.id}>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="mt-1 text-sm text-muted-foreground">{item.field.helpText}</p>}
                </div>
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-4 pb-4">
                    {item.items.map((child) => (
                      <div key={child.field.id} className="min-w-[280px] flex-1 whitespace-normal rounded-lg border bg-muted/10 p-4">
                        {child.type === "field" ? renderDynamicField(child.field) : renderTemplateLayout([child])}
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          );
        }

        return (
          <Accordion key={item.field.id} type="multiple" defaultValue={[item.field.id]} className="rounded-lg border px-4">
            <AccordionItem value={item.field.id} className="border-none">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="text-left">
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="text-sm text-muted-foreground mt-1">{item.field.helpText}</p>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {renderTemplateLayout(item.items)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );

  const renderBaseSliderSection = (mode: "edit" | "view") => {
    if (visibleBaseSliderFields.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleBaseSliderFields.map((field) => {
            const value = readBaseSliderValue(field);

            return (
              <div key={field.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div>
                  <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
                </div>
                {mode === "view" ? (
                  <ScaleIndicator score={value} min={field.min ?? 0} max={field.max ?? 10} />
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">{value}/{field.max ?? 10}</div>
                    <Slider
                      value={[value]}
                      onValueChange={([next]) => updateBaseSliderValue(field, next)}
                      min={field.min ?? 0}
                      max={field.max ?? 10}
                      step={1}
                      disabled={locked}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

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
      className="mx-auto w-full max-w-5xl space-y-6"
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
        {(isNew || isEditing) && !locked && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            <span>Salvar</span>
          </Button>
        )}
        {!isNew && canEditSavedDraft && !isEditing && (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            <span>Editar</span>
          </Button>
        )}
        {!isNew && canDeleteDraft && !isEditing && (
          <Button size="sm" variant="outline" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Excluir</span>
          </Button>
        )}
        {!isNew && (
          <Button size="sm" variant="outline" onClick={handleStartFromThis} disabled={startingFromThis}>
            {startingFromThis ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            <span>Iniciar Novo Atendimento a Partir Deste</span>
          </Button>
        )}
        {(isNew || isEditing) && (
          <>
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
            {anamnesisTemplates.length > 0 && (
              <Select
                value={anamnesisTemplateId || "none"}
                onValueChange={(value) => {
                  setAnamnesisTemplateId(value === "none" ? null : value);
                  setAnamnesisFormResponse({});
                }}
                disabled={locked}
              >
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder="Ficha de anamnese" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem ficha extra</SelectItem>
                  {anamnesisTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        {!isNew && !isEditing && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => void handleShareDocument("anamnesis")}>Anamnese</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleShareDocument("treatment")}>Tratamento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleShareDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handlePrintDocument("anamnesis")}>Anamnese</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintDocument("treatment")}>Tratamento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {locked && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Este atendimento está com status final e não pode mais ser editado. Use "Iniciar novo atendimento a partir deste"
          para abrir um novo rascunho com todos os campos já preenchidos.
        </div>
      )}

      {!isNew && !isEditing ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-1 font-medium">{status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Grupo</p>
                <p className="mt-1 font-medium">{groups.find((group) => group.id === groupId)?.name || "Sem grupo"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ficha complementar</p>
                <p className="mt-1 font-medium">{activeTemplate?.name || "Sem ficha extra"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Criado por</p>
                <p className="mt-1 font-medium">{getSessionPersonLabel(creatorProfile)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sessionCreatedAt ? formatSessionAuditDateTime(sessionCreatedAt) : "Ainda não salvo"}
                </p>
                {editHistoryView.length > 0 && (
                  <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="mt-1 h-auto px-0 text-xs text-muted-foreground">
                        Ver edições ({editHistoryView.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Histórico de edições</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        {editHistoryView.map((entry) => (
                          <div key={entry.id} className="rounded-lg border p-3">
                            <p className="text-sm font-medium">{entry.editorName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entry.editedAtLabel}</p>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>

          {renderBaseSliderSection("view")}

          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold">Anamnese</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {sessionSummary || "Nenhuma anamnese registrada."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Tratamento</h2>
                <Badge variant="outline">{treatmentBlocks.length} bloco(s)</Badge>
              </div>
              {treatmentBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum bloco de tratamento registrado.</p>
              ) : (
                <div className="space-y-4">
                  {treatmentBlocks.map((block, index) => (
                    <div key={block.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">Bloco {index + 1}</p>
                        <span className="text-sm text-muted-foreground">{block.name || "Sem nome"}</span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Frequência</p>
                          <p className="mt-1 text-sm">{block.frequency || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Duração</p>
                          <p className="mt-1 text-sm">{block.duration || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Séries</p>
                          <p className="mt-1 text-sm">{block.series || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Repetições</p>
                          <p className="mt-1 text-sm">{block.repetitions || "—"}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Instruções adicionais</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{block.instructions || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Orientações gerais e observações</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {treatmentGeneralGuidance || "Nenhuma orientação geral registrada."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">Anotações rápidas</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {notes || "Nenhuma anotação rápida registrada."}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
      <>
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
          {renderBaseSliderSection("edit")}

          <Card>
            <CardContent className="p-6 space-y-5">
              {renderTemplateLayout(baseLayout)}

              {baseTemplateSchema.length > 0 && (
                <div className="space-y-4 rounded-lg border border-dashed p-4">
                  <div>
                    <p className="font-medium text-sm">Ficha complementar</p>
                    {activeTemplate ? (
                      <p className="text-sm text-muted-foreground mt-1">{activeTemplate.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selecione uma ficha extra para complementar a anamnese padrão.
                      </p>
                    )}
                  </div>
                  {activeTemplate ? renderTemplateLayout(extraLayout) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tratamento" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-medium">Receituário de tratamento</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione blocos com o nome do tratamento, frequência, duração e instruções específicas.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addTreatmentBlock} disabled={locked}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar bloco
                </Button>
              </div>

              {treatmentBlocks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum bloco de tratamento adicionado. Use o botão "+" para montar o receituário.
                </div>
              ) : (
                <div className="space-y-4">
                  {treatmentBlocks.map((block, index) => (
                    <div key={block.id} className="rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Bloco {index + 1}</p>
                          <p className="text-sm text-muted-foreground">Tratamento com frequência, duração e instruções.</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTreatmentBlock(block.id)}
                          disabled={locked}
                          aria-label="Remover bloco"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nome do tratamento</Label>
                          <Input
                            value={block.name}
                            onChange={(event) => updateTreatmentBlock(block.id, { name: event.target.value })}
                            placeholder="Ex: Alongamento lombar"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>De quanto em quanto tempo</Label>
                          <Input
                            value={block.frequency}
                            onChange={(event) => updateTreatmentBlock(block.id, { frequency: event.target.value })}
                            placeholder="Ex: a cada 8h"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Por quanto tempo</Label>
                          <Input
                            value={block.duration}
                            onChange={(event) => updateTreatmentBlock(block.id, { duration: event.target.value })}
                            placeholder="Ex: por 15 dias"
                            disabled={locked}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Quantidade de séries</Label>
                            <Input
                              value={block.series}
                              onChange={(event) => updateTreatmentBlock(block.id, { series: event.target.value })}
                              placeholder="Opcional"
                              disabled={locked}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade de repetições</Label>
                            <Input
                              value={block.repetitions}
                              onChange={(event) => updateTreatmentBlock(block.id, { repetitions: event.target.value })}
                              placeholder="Opcional"
                              disabled={locked}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Instruções adicionais</Label>
                        <Textarea
                          value={block.instructions}
                          onChange={(event) => updateTreatmentBlock(block.id, { instructions: event.target.value })}
                          placeholder="Descreva detalhes do bloco de tratamento..."
                          rows={3}
                          disabled={locked}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label htmlFor="treatment-general-guidance" className="text-sm font-medium">
                  Orientações gerais e observações
                </Label>
                <Textarea
                  id="treatment-general-guidance"
                  value={treatmentGeneralGuidance}
                  onChange={(event) => setTreatmentGeneralGuidance(event.target.value)}
                  placeholder="Registre orientações gerais do receituário, alertas e observações importantes..."
                  className="mt-1.5"
                  rows={5}
                  disabled={locked}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
    </motion.div>
  );
};

export default SessaoDetalhe;
