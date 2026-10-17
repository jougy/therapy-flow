import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateOfficialTemplate,
  deleteCommunityTemplate,
  fetchCommunityFormTemplateById,
  updateCommunityTemplateByAdmin,
} from "@/lib/community-forms";
import {
  compactAnamnesisTemplateSchema,
  createDefaultTemplateSchema,
  isAnamnesisTemplateSchema,
  sanitizeAnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import { castDesignLabSchema, type DesignLabTemplateSchema, type TemplateRow } from "../types";

export interface UseFormEditorPersistenceParams {
  clinicId: string | null | undefined;
  clinicSettingsPath: string;
  clinicFormsManagerPath: string;
  isPlatformMode: boolean;
  isNew: boolean;
  isBase: boolean;
  templateId: string | undefined;
  canManageForms: boolean;
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string };
  } | null;
  templateName: string;
  setTemplateName: (name: string) => void;
  templateDescription: string;
  setTemplateDescription: (desc: string) => void;
  templateFields: DesignLabTemplateSchema;
  setInitialTemplateFields: (fields: DesignLabTemplateSchema, initialName?: string, initialDesc?: string) => void;
  checkRecoverableDraft: (loadedFields: DesignLabTemplateSchema, loadedName: string, loadedDesc: string) => void;
  clearDraft: () => void;
  markCleanState: (name: string, description: string, fields: DesignLabTemplateSchema) => void;
  isDirty: boolean;
}

export function useFormEditorPersistence({
  clinicId,
  clinicSettingsPath,
  clinicFormsManagerPath,
  isPlatformMode,
  isNew,
  isBase,
  templateId,
  canManageForms,
  user,
  templateName,
  setTemplateName,
  templateDescription,
  setTemplateDescription,
  templateFields,
  setInitialTemplateFields,
  checkRecoverableDraft,
  clearDraft,
  markCleanState,
  isDirty,
}: UseFormEditorPersistenceParams) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew && !isBase);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const isSavingRef = useRef(false);

  // Load clinic & template data
  useEffect(() => {
    if (!canManageForms) {
      toast({ title: "Acesso restrito", description: "Seu perfil não pode gerenciar formulários.", variant: "destructive" });
      navigate(clinicFormsManagerPath);
      return;
    }

    if (isBase) {
      const fetchClinic = async () => {
        if (!clinicId) return;

        const { data, error } = await supabase.from("clinics").select("*").eq("id", clinicId).single();

        if (error || !data) {
          toast({ title: "Clínica não encontrada", description: error?.message, variant: "destructive" });
          navigate(clinicFormsManagerPath);
          return;
        }

        const baseName = "Bloco padrão universal";
        const baseDesc = "Primeira parte obrigatória aplicada em todas as fichas da clínica.";
        const baseFields = castDesignLabSchema(
          isAnamnesisTemplateSchema(data.anamnesis_base_schema)
            ? sanitizeAnamnesisTemplateSchema(data.anamnesis_base_schema)
            : createDefaultTemplateSchema()
        );
        setTemplateName(baseName);
        setTemplateDescription(baseDesc);
        setInitialTemplateFields(baseFields, baseName, baseDesc);
        checkRecoverableDraft(baseFields, baseName, baseDesc);
        setLoading(false);
      };

      void fetchClinic();
      return;
    }

    if (isPlatformMode) {
      if (isNew) {
        const fetchPlatformNew = async () => {
          const emptyFields: DesignLabTemplateSchema = [];
          const { count } = await supabase
            .from("community_form_templates")
            .select("id", { count: "exact", head: true });

          const formNum = (count ?? 0) + 1;
          const newName = `Novo modelo oficial ${formNum}`;
          const newDesc = "Descrição do modelo oficial da comunidade";
          setTemplateName(newName);
          setTemplateDescription(newDesc);
          setInitialTemplateFields(emptyFields, newName, newDesc);
          checkRecoverableDraft(emptyFields, newName, newDesc);
          setLoading(false);
        };

        void fetchPlatformNew();
        return;
      }

      const fetchPlatformTemplate = async () => {
        if (!templateId) return;

        const data = await fetchCommunityFormTemplateById(templateId, user?.id);

        if (!data) {
          toast({
            title: "Modelo da comunidade não encontrado",
            description: "Este formulário não existe ou foi removido.",
            variant: "destructive",
          });
          navigate(clinicFormsManagerPath);
          return;
        }

        const tName = sanitizeSingleLineInput(data.title, INPUT_LIMITS.formTemplateName).trim();
        const tDesc = sanitizeMultilineInput(data.description ?? "", INPUT_LIMITS.formDescription).trim();
        const tFields = castDesignLabSchema(
          isAnamnesisTemplateSchema(data.schema)
            ? sanitizeAnamnesisTemplateSchema(data.schema)
            : createDefaultTemplateSchema()
        );
        setTemplate(data);
        setTemplateName(tName);
        setTemplateDescription(tDesc);
        setInitialTemplateFields(tFields, tName, tDesc);
        checkRecoverableDraft(tFields, tName, tDesc);
        setLoading(false);
      };

      void fetchPlatformTemplate();
      return;
    }

    if (isNew) {
      const fetchCount = async () => {
        const emptyFields: DesignLabTemplateSchema = [];
        if (!clinicId) {
          const newName = "Novo formulário 1";
          const newDesc = "Adicione uma descrição";
          setTemplateName(newName);
          setTemplateDescription(newDesc);
          setInitialTemplateFields(emptyFields, newName, newDesc);
          checkRecoverableDraft(emptyFields, newName, newDesc);
          setLoading(false);
          return;
        }

        const { count } = await supabase
          .from("anamnesis_form_templates")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        const formNum = (count ?? 0) + 1;
        const newName = `Novo formulário ${formNum}`;
        const newDesc = "Adicione uma descrição";
        setTemplateName(newName);
        setTemplateDescription(newDesc);
        setInitialTemplateFields(emptyFields, newName, newDesc);
        checkRecoverableDraft(emptyFields, newName, newDesc);
        setLoading(false);
      };

      void fetchCount();
      return;
    }

    const fetchTemplate = async () => {
      if (!templateId) return;

      const { data, error } = await supabase.from("anamnesis_form_templates").select("*").eq("id", templateId).single();

      if (error || !data) {
        toast({ title: "Formulário não encontrado", description: error?.message, variant: "destructive" });
        navigate(clinicFormsManagerPath);
        return;
      }

      const tName = sanitizeSingleLineInput(data.name, INPUT_LIMITS.formTemplateName).trim();
      const tDesc = sanitizeMultilineInput(data.description ?? "", INPUT_LIMITS.formDescription).trim();
      const tFields = castDesignLabSchema(
        isAnamnesisTemplateSchema(data.schema)
          ? sanitizeAnamnesisTemplateSchema(data.schema)
          : createDefaultTemplateSchema()
      );
      setTemplate(data);
      setTemplateName(tName);
      setTemplateDescription(tDesc);
      setInitialTemplateFields(tFields, tName, tDesc);
      checkRecoverableDraft(tFields, tName, tDesc);
      setLoading(false);
    };

    void fetchTemplate();
  }, [canManageForms, checkRecoverableDraft, clinicFormsManagerPath, clinicId, isBase, isNew, isPlatformMode, navigate, setInitialTemplateFields, templateId, user?.id]);

  // Save template
  const handleSave = async () => {
    if (isSavingRef.current) return;

    const safeTemplateName = sanitizeSingleLineInput(templateName, INPUT_LIMITS.formTemplateName).trim();
    const safeTemplateDescription = sanitizeMultilineInput(templateDescription, INPUT_LIMITS.formDescription).trim();
    const safeTemplateFields = sanitizeAnamnesisTemplateSchema(templateFields);

    const isClinicSave = !isPlatformMode;
    if (isClinicSave && !clinicId) {
      toast({
        title: "Dados incompletos",
        description: "Clínica não identificada para salvar o formulário.",
        variant: "destructive",
      });
      return;
    }

    if (!user || !safeTemplateName || safeTemplateFields.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "O formulário deve ter um nome válido e conter ao menos um campo.",
        variant: "destructive",
      });
      return;
    }

    if (!isDirty && !isNew) {
      toast({
        title: "Nenhuma alteração pendente",
        description: "O formulário já está salvo na versão mais recente.",
      });
      return;
    }

    isSavingRef.current = true;
    setSaving(true);

    try {
      const compactedFields = compactAnamnesisTemplateSchema(safeTemplateFields);

      if (isPlatformMode) {
        const authorName =
          user.user_metadata?.full_name ||
          (user.email ? user.email.split("@")[0] : null) ||
          "Equipe Pluri-Health";

        if (isNew) {
          const res = await adminCreateOfficialTemplate({
            title: safeTemplateName,
            description: safeTemplateDescription || null,
            category: "Geral",
            tags: ["oficial", "padrao"],
            schema: safeTemplateFields,
            kind: "template",
            is_featured: true,
            author_name: authorName,
            clinic_name: "Comunidade Oficial",
            clinic_id: null,
            user_id: user.id,
          });

          if (!res.success || !res.data) {
            toast({
              title: "Erro ao publicar modelo oficial",
              description: res.error || "Não foi possível salvar o modelo.",
              variant: "destructive",
            });
            return;
          }

          markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
          clearDraft();
          toast({ title: "Modelo oficial publicado com sucesso!" });
          navigate(`/platform/formularios/editor/${res.data.id}`);
          return;
        } else {
          const res = await updateCommunityTemplateByAdmin(templateId!, {
            title: safeTemplateName,
            description: safeTemplateDescription || null,
            schema: safeTemplateFields,
          });

          if (!res.success || !res.data) {
            toast({
              title: "Erro ao atualizar modelo oficial",
              description: res.error || "Não foi possível salvar as alterações.",
              variant: "destructive",
            });
            return;
          }

          setTemplate(res.data);
          markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
          clearDraft();
          toast({ title: "Modelo oficial salvo com sucesso!" });
          return;
        }
      }

      if (isBase) {
        const { error } = await supabase
          .from("clinics")
          .update({ anamnesis_base_schema: compactedFields })
          .eq("id", clinicId!);

        if (error) {
          toast({ title: "Erro ao salvar bloco universal", description: error.message, variant: "destructive" });
          return;
        }

        markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
        clearDraft();
        toast({ title: "Bloco padrão universal salvo com sucesso!" });
        navigate(clinicFormsManagerPath);
        return;
      }

      const payload = {
        clinic_id: clinicId!,
        description: safeTemplateDescription || null,
        is_active: true,
        is_system_default: false,
        name: safeTemplateName,
        schema: compactedFields,
        user_id: user.id,
      };

      const query = isNew
        ? supabase.from("anamnesis_form_templates").insert(payload).select("id").single()
        : supabase
            .from("anamnesis_form_templates")
            .update(payload)
            .eq("id", templateId!)
            .eq("clinic_id", clinicId!)
            .select("id")
            .single();

      const { data, error } = await query;

      if (error) {
        toast({ title: "Erro ao salvar formulário", description: error.message, variant: "destructive" });
        return;
      }

      markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
      clearDraft();
      toast({ title: isNew ? "Formulário criado com sucesso!" : "Formulário atualizado com sucesso!" });
      navigate(`${clinicSettingsPath}/formularios/${data.id}`);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  // Delete entire template
  const handleDeleteTemplate = async () => {
    if (isBase || isNew || !templateId) return;
    if (!isPlatformMode && !clinicId) return;

    setDeletingTemplate(true);
    try {
      if (isPlatformMode) {
        const success = await deleteCommunityTemplate(templateId);
        if (!success) {
          toast({
            title: "Erro ao excluir modelo oficial",
            description: "Não foi possível remover o modelo da biblioteca comunitária.",
            variant: "destructive",
          });
          return;
        }

        clearDraft();

        toast({
          title: "Modelo oficial excluído",
          description: "O modelo foi removido com sucesso da biblioteca comunitária.",
        });
        navigate("/platform/formularios");
        return;
      }

      const { error } = await supabase
        .from("anamnesis_form_templates")
        .delete()
        .eq("id", templateId)
        .eq("clinic_id", clinicId!);

      if (error) {
        toast({
          title: "Erro ao excluir formulário",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      clearDraft();

      toast({
        title: "Formulário excluído",
        description: "O modelo foi removido com sucesso da clínica.",
      });
      navigate(clinicFormsManagerPath);
    } catch (error) {
      toast({
        title: "Erro ao excluir formulário",
        description: error instanceof Error ? error.message : "Erro inesperado ao excluir o modelo.",
        variant: "destructive",
      });
    } finally {
      setDeletingTemplate(false);
      setDeleteTemplateDialogOpen(false);
    }
  };

  return {
    loading,
    saving,
    template,
    setTemplate,
    deleteTemplateDialogOpen,
    setDeleteTemplateDialogOpen,
    deletingTemplate,
    handleSave,
    handleDeleteTemplate,
    isSavingRef,
  };
}
