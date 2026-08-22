import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Check,
  Globe,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  COMMUNITY_FORM_CATEGORIES,
  type CommunityFormCategory,
  publishCommunityTemplate,
  type CommunityFormTemplate,
} from "@/lib/community-forms";
import { type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

export interface AvailableClinicTemplateOption {
  id: string;
  name: string;
  description: string | null;
  schema: AnamnesisTemplateSchema;
  kind: "template" | "base";
}

interface PublishFormTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTemplates: AvailableClinicTemplateOption[];
  preselectedTemplateId?: string | null;
  onSuccess?: (created: CommunityFormTemplate) => void;
}

export const PublishFormTemplateModal: React.FC<PublishFormTemplateModalProps> = ({
  open,
  onOpenChange,
  availableTemplates,
  preselectedTemplateId,
  onSuccess,
}) => {
  const { user, profile, clinic } = useAuth();

  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CommunityFormCategory>("Psicologia");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [includeClinicName, setIncludeClinicName] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or react to preselectedTemplateId or availableTemplates
  useEffect(() => {
    if (!open) return;

    const initialId =
      preselectedTemplateId && availableTemplates.some((t) => t.id === preselectedTemplateId)
        ? preselectedTemplateId
        : availableTemplates[0]?.id || "";

    setSelectedSourceId(initialId);

    const match = availableTemplates.find((t) => t.id === initialId);
    if (match) {
      setTitle(match.name);
      setDescription(match.description || "");
    }

    const defaultAuthor = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Profissional Pluri-Health";
    setAuthorName(defaultAuthor);
    setTags([]);
    setTagInput("");
  }, [open, preselectedTemplateId, availableTemplates, profile, user]);

  const handleSourceChange = (id: string) => {
    setSelectedSourceId(id);
    const match = availableTemplates.find((t) => t.id === id);
    if (match) {
      setTitle(match.name);
      setDescription(match.description || "");
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!clean) return;
    if (tags.includes(clean)) {
      setTagInput("");
      return;
    }
    if (tags.length >= 8) {
      toast({
        title: "Limite de tags",
        description: "Você pode adicionar até 8 tags por formulário.",
        variant: "destructive",
      });
      return;
    }
    setTags([...tags, clean]);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: "Não autenticado", description: "Faça login para publicar.", variant: "destructive" });
      return;
    }

    const selectedTemplate = availableTemplates.find((t) => t.id === selectedSourceId);
    if (!selectedTemplate) {
      toast({ title: "Selecione um formulário", description: "Escolha qual formulário da sua clínica deseja publicar.", variant: "destructive" });
      return;
    }

    if (!title.trim()) {
      toast({ title: "Título obrigatório", description: "Informe um título para o formulário na biblioteca.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await publishCommunityTemplate({
        title: title.trim(),
        description: description.trim() || null,
        category,
        tags,
        schema: selectedTemplate.schema,
        kind: selectedTemplate.kind,
        author_name: authorName.trim() || "Profissional Pluri-Health",
        clinic_name: includeClinicName ? clinic?.name || null : null,
        clinic_id: clinic?.id || null,
        user_id: user.id,
      });

      if (!res.success || !res.data) {
        throw new Error(res.error || "Erro ao publicar formulário.");
      }

      toast({
        title: "Formulário publicado com sucesso!",
        description: "Seu modelo agora está disponível na biblioteca comunitária para outros profissionais.",
      });

      onOpenChange(false);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      toast({
        title: "Erro ao publicar",
        description: err instanceof Error ? err.message : "Ocorreu um erro ao publicar o modelo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = availableTemplates.find((t) => t.id === selectedSourceId);
  const fieldsCount = selectedTemplate?.schema.filter(
    (f) => f.type !== "section" && f.type !== "horizontal_section" && f.type !== "section_selector"
  ).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Globe className="h-4 w-4" />
            Biblioteca Pública da Comunidade
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Publicar Modelo de Formulário
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Compartilhe a estrutura do seu formulário com outros profissionais de saúde da comunidade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Select Source Form */}
          <div className="space-y-1.5">
            <Label htmlFor="sourceForm" className="text-xs font-semibold">
              Formulário da sua clínica para publicar *
            </Label>
            <Select value={selectedSourceId} onValueChange={handleSourceChange}>
              <SelectTrigger id="sourceForm" className="w-full">
                <SelectValue placeholder="Selecione um formulário..." />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.kind === "base" ? "(Bloco Padrão Universal)" : "(Ficha Complementar)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-[11px] text-muted-foreground">
                Estrutura selecionada com <strong>{fieldsCount} campos</strong> e {selectedTemplate.schema.length} elementos.
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-semibold">
              Título público do modelo *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Anamnese Fisioterapêutica para Coluna Lombar"
              maxLength={120}
              required
            />
          </div>

          {/* Category & Specialty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-semibold">
                Área / Especialidade *
              </Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as CommunityFormCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_FORM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Author Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="authorName" className="text-xs font-semibold">
                Nome do autor(a) visível *
              </Label>
              <Input
                id="authorName"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ex: Dr. Roberto Silva ou Equipe Clínica"
                maxLength={80}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Descrição e instruções de uso (opcional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique para qual finalidade este formulário foi construído, protocolo clínico associado ou público-alvo."
              rows={3}
              maxLength={600}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-xs font-semibold">
              Tags de busca (pressione Enter para adicionar)
            </Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Ex: dor-lombar, tcc, infantil, tea, postura"
                maxLength={30}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-primary/70 hover:text-primary ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Clinic Name Checkbox */}
          {clinic?.name && (
            <div className="flex items-center space-x-2 rounded-lg border p-3 bg-muted/20">
              <Checkbox
                id="includeClinic"
                checked={includeClinicName}
                onCheckedChange={(checked) => setIncludeClinicName(Boolean(checked))}
              />
              <Label
                htmlFor="includeClinic"
                className="text-xs font-normal text-foreground cursor-pointer leading-tight"
              >
                Exibir o nome da minha clínica (<strong>{clinic.name}</strong>) como coautora na publicação.
              </Label>
            </div>
          )}

          {/* Security & Privacy Notice */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-900 p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p>
              <strong>Apenas a estrutura do formulário</strong> (títulos, perguntas, opções e seções) será compartilhada. Nenhum dado de paciente, resposta de atendimento ou prontuário é exposto.
            </p>
          </div>
        </form>

        <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !selectedSourceId}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publicar na Biblioteca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
