import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Copy, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ANAMNESIS_FIELD_LIBRARY,
  buildTemplateLayout,
  createAnamnesisField,
  createDefaultTemplateSchema,
  getAssignableContainerFields,
  getSectionSelectorOptions,
  isContainerField,
  isAnamnesisTemplateSchema,
  normalizeOptions,
  type AnamnesisField,
  type TemplateLayoutItem,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";

type TemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
const FormularioEditor = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { can, clinicId, user } = useAuth();
  const isNew = templateId === "novo";
  const isBase = templateId === "base";
  const canManageForms = can("forms.manage");

  const [loading, setLoading] = useState(!isNew && !isBase);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateFields, setTemplateFields] = useState<AnamnesisTemplateSchema>(createDefaultTemplateSchema());
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [desktopMenuTop, setDesktopMenuTop] = useState(128);
  const [desktopMenuMaxHeight, setDesktopMenuMaxHeight] = useState(480);

  useEffect(() => {
    if (!canManageForms) {
      toast({ title: "Acesso restrito", description: "Seu perfil não pode gerenciar formulários.", variant: "destructive" });
      navigate("/configuracoes");
      return;
    }

    if (isBase) {
      const fetchClinic = async () => {
        if (!clinicId) return;

        const { data, error } = await supabase.from("clinics").select("*").eq("id", clinicId).single();

        if (error || !data) {
          toast({ title: "Clínica não encontrada", description: error?.message, variant: "destructive" });
          navigate("/configuracoes");
          return;
        }

        setTemplateName("Bloco padrão universal");
        setTemplateDescription("Primeira parte obrigatória aplicada em todas as fichas da clínica.");
        setTemplateFields(isAnamnesisTemplateSchema(data.anamnesis_base_schema) ? data.anamnesis_base_schema : createDefaultTemplateSchema());
        setLoading(false);
      };

      void fetchClinic();
      return;
    }

    if (isNew) {
      setLoading(false);
      return;
    }

    const fetchTemplate = async () => {
      if (!templateId) return;

      const { data, error } = await supabase
        .from("anamnesis_form_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error || !data) {
        toast({ title: "Formulário não encontrado", description: error?.message, variant: "destructive" });
        navigate("/configuracoes");
        return;
      }

      setTemplate(data);
      setTemplateName(data.name);
      setTemplateDescription(data.description ?? "");
      setTemplateFields(isAnamnesisTemplateSchema(data.schema) ? data.schema : createDefaultTemplateSchema());
      setLoading(false);
    };

    void fetchTemplate();
  }, [canManageForms, clinicId, isBase, isNew, navigate, templateId]);

  useEffect(() => {
    const updateDesktopMenuBounds = () => {
      if (typeof window === "undefined") return;

      const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 96;
      const topOffset = Math.max(Math.round(headerBottom + 16), 96);
      const maxHeight = Math.max(window.innerHeight - topOffset - 24, 240);

      setDesktopMenuTop(topOffset);
      setDesktopMenuMaxHeight(maxHeight);
    };

    updateDesktopMenuBounds();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && headerRef.current
        ? new ResizeObserver(() => updateDesktopMenuBounds())
        : null;

    if (headerRef.current && resizeObserver) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener("resize", updateDesktopMenuBounds);
    window.addEventListener("scroll", updateDesktopMenuBounds, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateDesktopMenuBounds);
      window.removeEventListener("scroll", updateDesktopMenuBounds);
    };
  }, []);

  const sectionOptions = useMemo(() => getSectionSelectorOptions(templateFields), [templateFields]);
  const groupedLayout = useMemo(() => buildTemplateLayout(templateFields), [templateFields]);

  const blockMenuContent = (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-base">Blocos disponíveis</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {ANAMNESIS_FIELD_LIBRARY.map((item) => (
          <Button
            key={item.type}
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => handleAddField(item.type)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {item.label}
          </Button>
        ))}
        {isBase && (
          <p className="text-xs text-muted-foreground mt-2">
            No bloco padrão universal, você pode manter os campos fixos, adicionar novos campos e escolher quais aparecem no bloco de atendimentos do paciente.
          </p>
        )}
      </CardContent>
    </Card>
  );

  const handleAddField = (type: AnamnesisField["type"]) => {
    setTemplateFields((current) => [...current, createAnamnesisField(type, current.length)]);
  };

  const updateField = (fieldId: string, changes: Partial<AnamnesisField>) => {
    setTemplateFields((current) => current.map((field) => (field.id === fieldId ? { ...field, ...changes } : field)));
  };

  const removeField = (fieldId: string) => {
    setTemplateFields((current) => current.filter((field) => field.id !== fieldId));
  };

  const duplicateField = (field: AnamnesisField) => {
    setTemplateFields((current) => [
      ...current,
      {
        ...field,
        id: `${field.id}_copy_${current.length}`,
        label: `${field.label} (cópia)`,
      },
    ]);
  };

  const moveField = (sourceId: string, targetId: string) => {
    setTemplateFields((current) => {
      const sourceIndex = current.findIndex((field) => field.id === sourceId);
      const targetIndex = current.findIndex((field) => field.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const assignFieldToSection = (fieldId: string, sectionId: string | null) => {
    setTemplateFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, groupKey: sectionId } : field))
    );
  };

  const handleSave = async () => {
    if (!clinicId || !user || !templateName.trim()) return;
    setSaving(true);

    if (isBase) {
      const { error } = await supabase
        .from("clinics")
        .update({ anamnesis_base_schema: templateFields })
        .eq("id", clinicId);

      if (error) {
        toast({ title: "Erro ao salvar bloco padrão", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      toast({ title: "Bloco padrão atualizado" });
      setSaving(false);
      navigate("/configuracoes");
      return;
    }

    const payload = {
      clinic_id: clinicId,
      description: templateDescription.trim() || null,
      is_active: true,
      is_system_default: false,
      name: templateName.trim(),
      schema: templateFields,
      user_id: user.id,
    };

    const query = isNew
      ? supabase.from("anamnesis_form_templates").insert(payload).select("id").single()
      : supabase.from("anamnesis_form_templates").update(payload).eq("id", templateId!).select("id").single();

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao salvar formulário", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: isNew ? "Formulário criado" : "Formulário atualizado" });
    setSaving(false);
    navigate(`/configuracoes/formularios/${data.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div ref={headerRef} className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")} aria-label="Voltar para configurações">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isBase ? "Bloco padrão universal" : isNew ? "Nova ficha" : template?.name || "Editar ficha"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isBase
                ? "Edite a primeira parte obrigatória da anamnese, aplicada automaticamente em todas as fichas da clínica."
                : "Monte a estrutura da ficha em uma página completa, com rolagem normal para formulários grandes."}
            </p>
          </div>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving || !templateName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar ficha
        </Button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed left-3 top-1/2 z-40 h-11 w-11 -translate-y-1/2 rounded-full shadow-lg lg:hidden"
        aria-label="Abrir blocos disponíveis"
        onClick={() => setMobileMenuOpen(true)}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[300px] overflow-y-auto sm:w-[340px]">
          <SheetHeader>
            <SheetTitle>Blocos disponíveis</SheetTitle>
          </SheetHeader>
          <div className="mt-6">{blockMenuContent}</div>
        </SheetContent>
      </Sheet>

      <div className="space-y-6 lg:relative">
        <div className="hidden lg:block lg:w-[260px]">
          <div
            className="fixed left-6 z-20 w-[260px] overflow-y-auto"
            style={{ top: `${desktopMenuTop}px`, maxHeight: `${desktopMenuMaxHeight}px` }}
          >
            {blockMenuContent}
          </div>
        </div>

        <div className="space-y-4 min-h-0 lg:pl-[284px]">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{isBase ? "Nome da estrutura" : "Nome da ficha"}</Label>
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Ex: Ficha ortopédica inicial"
                  disabled={isBase}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="Ex: triagem inicial para dor lombar"
                  disabled={isBase}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="space-y-3">
            {groupedLayout.map((layoutItem) => {
              const renderEditorItem = (item: TemplateLayoutItem, depth = 0): ReactNode => {
                const field = item.field;
                const assignableContainers = getAssignableContainerFields(templateFields, field.id);
                const isNested = depth > 0;
                const isContainer = isContainerField(field);

                return (
                  <Card
                    key={field.id}
                    draggable={!isNested}
                    onDragStart={() => !isNested && setDraggedFieldId(field.id)}
                    onDragOver={(event) => !isNested && event.preventDefault()}
                    onDrop={() => {
                      if (!draggedFieldId || isNested) return;

                      if (item.type !== "field" && draggedFieldId !== field.id) {
                        assignFieldToSection(draggedFieldId, field.id);
                      } else {
                        moveField(draggedFieldId, field.id);
                      }

                      setDraggedFieldId(null);
                    }}
                    className={isNested ? "border-dashed bg-muted/10" : undefined}
                  >
                    <CardContent className="p-5 space-y-4">
                      {isNested && (
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {item.type === "horizontal_section" ? "Seção horizontal interna" : item.type === "section" ? "Subseção" : "Campo dentro da seção"}
                        </p>
                      )}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{ANAMNESIS_FIELD_LIBRARY.find((entry) => entry.type === field.type)?.label || field.type}</p>
                              <p className="text-xs text-muted-foreground">{field.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isBase && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => duplicateField(field)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            {(!isBase || !field.systemKey) && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Rótulo</Label>
                            <Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Ajuda</Label>
                            <Input value={field.helpText ?? ""} onChange={(event) => updateField(field.id, { helpText: event.target.value })} />
                          </div>
                        </div>

                        {!isContainer && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Placeholder</Label>
                              <Input value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Agrupar no contêiner</Label>
                              <Select
                                value={field.groupKey ?? "none"}
                                onValueChange={(value) => assignFieldToSection(field.id, value === "none" ? null : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sem contêiner" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem contêiner</SelectItem>
                                  {assignableContainers.map((container) => (
                                    <SelectItem key={container.id} value={container.id}>{container.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {isContainer && (
                          <div className="space-y-2">
                            <Label>Inserir dentro de</Label>
                            <Select
                              value={field.groupKey ?? "none"}
                              onValueChange={(value) => assignFieldToSection(field.id, value === "none" ? null : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sem seção pai" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem seção pai</SelectItem>
                                {assignableContainers.map((container) => (
                                  <SelectItem key={container.id} value={container.id}>{container.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {!isContainer && field.type !== "section_selector" && (
                          <div className="space-y-2">
                            <Label>Vincular à seção condicional</Label>
                            <Select
                              value={field.sectionKey ?? "none"}
                              onValueChange={(value) => updateField(field.id, { sectionKey: value === "none" ? null : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sempre visível" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sempre visível</SelectItem>
                                {sectionOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {!isContainer && (
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`required_${field.id}`}
                              checked={field.required ?? false}
                              onCheckedChange={(checked) => updateField(field.id, { required: checked === true })}
                            />
                            <Label htmlFor={`required_${field.id}`}>Campo obrigatório</Label>
                          </div>
                        )}

                        {isBase && !isContainer && (
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`show_in_patient_list_${field.id}`}
                              checked={field.showInPatientList ?? false}
                              onCheckedChange={(checked) => updateField(field.id, { showInPatientList: checked === true })}
                            />
                            <Label htmlFor={`show_in_patient_list_${field.id}`}>
                              Exibir este campo na lista de atendimentos do paciente
                            </Label>
                          </div>
                        )}

                        {(field.type === "checklist" || field.type === "multiple_choice" || field.type === "select" || field.type === "section_selector") && (
                          <div className="space-y-2">
                            <Label>Opções</Label>
                            <Textarea
                              rows={4}
                              value={(field.options ?? []).map((option) => option.label).join("\n")}
                              onChange={(event) => updateField(field.id, { options: normalizeOptions(event.target.value) })}
                              placeholder="Uma opção por linha"
                            />
                          </div>
                        )}

                        {field.type === "slider" && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Mínimo</Label>
                              <Input
                                type="number"
                                value={field.min ?? 0}
                                onChange={(event) => updateField(field.id, { min: Number(event.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Máximo</Label>
                              <Input
                                type="number"
                                value={field.max ?? 10}
                                onChange={(event) => updateField(field.id, { max: Number(event.target.value) })}
                              />
                            </div>
                          </div>
                        )}

                        {field.type === "section" && (
                          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                            Você pode colocar campos, subseções e seções horizontais dentro desta seção.
                          </div>
                        )}

                        {field.type === "horizontal_section" && (
                          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                            Os itens desta seção serão exibidos lado a lado com rolagem horizontal. Seções não podem ser inseridas aqui.
                          </div>
                        )}

                        {item.type !== "field" && item.items.length > 0 && (
                          <div className={item.type === "horizontal_section" ? "flex gap-3 overflow-x-auto pb-2" : "space-y-3"}>
                            {item.items.map((child) => (
                              <div key={child.field.id} className={item.type === "horizontal_section" ? "min-w-[320px] flex-1" : undefined}>
                                {renderEditorItem(child, depth + 1)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              };

              return renderEditorItem(layoutItem);
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FormularioEditor;
