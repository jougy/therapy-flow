import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  ShieldCheck, 
  Sparkles, 
  QrCode, 
  Receipt, 
  CreditCard, 
  Tag, 
  UserRound, 
  Building2,
  Globe,
  Briefcase,
  Calendar,
  Clock,
  MessageSquare,
  Send,
  BellRing,
  PhoneForwarded,
  Video,
  CalendarDays,
  Link,
  Coffee,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Copy,
  Download,
  Layers,
  ExternalLink
} from "lucide-react";
import { featureFlagsCatalog } from "@/lib/feature-flags-catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { HelpersConfigModal } from "@/components/tutorial/HelpersConfigModal";
import { FormEditorConfigModal } from "@/components/forms/FormEditorConfigModal";

// JSON estático memoizado do WhatsApp Flow para evitar JSON.stringify custoso a cada re-render
const SAMPLE_WHATSAPP_FLOW_JSON = JSON.stringify({
  version: "3.1",
  data_api_version: "3.0",
  routing_model: {
    TRIAGE_SCREEN: ["PREFERENCES_SCREEN"],
    PREFERENCES_SCREEN: []
  },
  screens: [
    {
      id: "TRIAGE_SCREEN",
      title: "Triagem & Agendamento Clínico",
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "TextInput",
                name: "full_name",
                label: "Nome Completo",
                required: true
              },
              {
                type: "RadioButtonsGroup",
                name: "appointment_type",
                label: "Tipo de Atendimento",
                required: true,
                "data-source": [
                  { id: "primeira_consulta", title: "Primeira Consulta / Avaliação" },
                  { id: "retorno_sessao", title: "Sessão de Acompanhamento" },
                  { id: "orientacao_online", title: "Teleconsulta Online" }
                ]
              },
              {
                type: "Footer",
                label: "Continuar",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "PREFERENCES_SCREEN"
                  },
                  payload: {
                    full_name: "${form.full_name}",
                    appointment_type: "${form.appointment_type}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "PREFERENCES_SCREEN",
      title: "Preferência de Horário",
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "DatePicker",
                name: "preferred_date",
                label: "Data Desejada",
                required: true
              },
              {
                type: "Footer",
                label: "Concluir Triagem",
                "on-click-action": {
                  name: "complete",
                  payload: {
                    preferred_date: "${form.preferred_date}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}, null, 2);

export interface FeatureConfigModalProps {
  featureKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (payload: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
  scope?: "global" | "tag" | "clinic";
  tagId?: string;
  clinicId?: string;
}

export function FeatureConfigModal({ featureKey, isOpen, onClose, onSave, initialData, scope = "global", tagId, clinicId }: FeatureConfigModalProps) {
  const feature = featureFlagsCatalog.find(f => f.key === featureKey);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData((initialData as Record<string, unknown>) || {});
    }
  }, [isOpen, initialData]);

  if (featureKey === "system_helpers") {
    return (
      <HelpersConfigModal
        isOpen={isOpen}
        onClose={onClose}
        initialData={initialData}
        onSave={onSave}
        scope={scope}
        tagId={tagId}
        clinicId={clinicId}
      />
    );
  }

  if (featureKey === "forms_editor") {
    return (
      <FormEditorConfigModal
        isOpen={isOpen}
        onClose={onClose}
        initialData={initialData}
        onSave={onSave}
        scope={scope}
        tagId={tagId}
        clinicId={clinicId}
      />
    );
  }

  if (!feature) {
    return null;
  }

  const isValid = () => {
    if (feature?.category === "Storage/Arquivos") {
      if (formData.maxSizeMb && Number(formData.maxSizeMb) <= 0) return false;
    }
    if (feature?.category === "Notificações") {
      if (formData.retentionDays !== undefined && Number(formData.retentionDays) <= 0) return false;
    }
    if (feature?.category === "Formulários") {
      if (formData.publicLinkValidityHours && Number(formData.publicLinkValidityHours) <= 0) return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!featureKey) return;
    if (!isValid()) {
      toast({ title: "Validação", description: "Preencha todos os campos obrigatórios com valores válidos.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    try {
      // 1. Obter o dado atual para merge
      let matchQuery = supabase.from("feature_flags").select("value").eq("key", featureKey).eq("scope", scope);
      if (scope === "tag" && tagId) matchQuery = matchQuery.eq("tag_id", tagId);
      if (scope === "clinic" && clinicId) matchQuery = matchQuery.eq("clinic_id", clinicId);
      if (scope === "global") matchQuery = matchQuery.is("tag_id", null).is("clinic_id", null);

      const { data: existingData } = await matchQuery.maybeSingle();
      
      let currentValue = {};
      if (existingData && existingData.value && typeof existingData.value === 'object') {
        currentValue = existingData.value;
      }

      // Sanitizar texto
      const sanitizedData = { ...formData };
      if (sanitizedData.allowedExtensions && typeof sanitizedData.allowedExtensions === 'string') {
        sanitizedData.allowedExtensions = sanitizedData.allowedExtensions.split(',').map((s: string) => s.trim()).filter(Boolean).join(', ');
      }

      // 2. Fazer o merge
      const mergedPayload = {
        ...currentValue,
        ...sanitizedData
      };

      // 3. Salvar usando RPC upsert_feature_flag
      const { error: upsertError } = await supabase.rpc("upsert_feature_flag", {
        _key: featureKey,
        _scope: scope,
        _clinic_id: scope === "clinic" ? clinicId : undefined,
        _tag_id: scope === "tag" ? tagId : undefined,
        _value: mergedPayload,
        _description: feature?.description,
      });

      if (upsertError) throw upsertError;

      toast({ title: "Configurações salvas", description: "As configurações avançadas foram atualizadas com sucesso." });
      
      if (onSave) onSave(mergedPayload);
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao salvar";
      toast({ title: "Erro ao salvar", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStorageForm = () => {
    return (
      <div className="grid gap-6">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Armazenamento Seguro em Nuvem (Backblaze B2 / S3)</p>
          <p>
            As credenciais e endpoints de conexão do storage são gerenciados de forma segura e criptografada pelo servidor backend (Edge Functions), evitando qualquer exposição de chaves de infraestrutura no navegador.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Tamanho máximo por arquivo (MB)</Label>
            <Input 
              type="number"
              min="1"
              max="50"
              placeholder="50" 
              value={formData.maxSizeMb || ""}
              onChange={(e) => setFormData({ ...formData, maxSizeMb: Math.max(1, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Extensões permitidas</Label>
            <Input 
              placeholder=".pdf, .jpg, .png, .webp" 
              value={formData.allowedExtensions || ""}
              onChange={(e) => setFormData({ ...formData, allowedExtensions: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationsForm = () => {
    return (
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label className="text-base font-semibold">Canais de Envio</Label>
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="chan-inapp" 
                checked={formData.channelInApp ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, channelInApp: !!v })}
              />
              <Label htmlFor="chan-inapp" className="font-normal cursor-pointer">In-App (Plataforma)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="chan-email" 
                checked={formData.channelEmail ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, channelEmail: !!v })}
              />
              <Label htmlFor="chan-email" className="font-normal cursor-pointer">E-mail</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="chan-push" 
                checked={formData.channelPush ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, channelPush: !!v })}
              />
              <Label htmlFor="chan-push" className="font-normal cursor-pointer">Push Notification (Celular)</Label>
            </div>
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Agrupamento Diário</Label>
              <p className="text-sm text-muted-foreground">Enviar um resumo diário em vez de alertas avulsos.</p>
            </div>
            <Switch 
              checked={formData.dailySummary ?? false}
              onCheckedChange={(v) => setFormData({ ...formData, dailySummary: v })}
            />
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <Label>Retenção de Notificações</Label>
          <div className="flex items-center gap-3">
            <span className="text-sm">Deletar automaticamente após</span>
            <Input 
              type="number" 
              className="w-24" 
              placeholder="30" 
              min="1"
              value={formData.retentionDays || ""}
              onChange={(e) => setFormData({ ...formData, retentionDays: Number(e.target.value) })}
            />
            <span className="text-sm">dias.</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardsForm = () => {
    return (
      <div className="grid gap-8">
        <div className="grid gap-4">
          <Label className="text-base font-semibold border-b pb-2">Dashboard Geral da Clínica</Label>
          
          <div className="grid gap-2">
            <Label>Período padrão de visualização</Label>
            <Select 
              value={formData.defaultPeriod || "this_week"} 
              onValueChange={(val) => setFormData({ ...formData, defaultPeriod: val })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">Esta semana</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 mt-2">
            <Label>Métricas visíveis</Label>
            <div className="flex flex-col gap-2 mt-1">
              {['Atendimentos Realizados', 'Faturamento Estimado', 'Pacientes Ativos', 'Taxa de Retorno'].map((metric, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`metric-${idx}`} 
                    checked={formData[`metric_${idx}`] ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, [`metric_${idx}`]: !!v })}
                  />
                  <Label htmlFor={`metric-${idx}`} className="font-normal cursor-pointer">{metric}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 pt-4 border-t">
          <Label className="text-base font-semibold border-b pb-2">Dashboard do Paciente</Label>
          
          <div className="grid gap-2">
            <Label>Módulos visíveis (Abas do paciente)</Label>
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="mod-faturas" 
                  checked={formData.modFaturas ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, modFaturas: !!v })}
                />
                <Label htmlFor="mod-faturas" className="font-normal cursor-pointer">Faturas e Cobranças</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="mod-arquivos" 
                  checked={formData.modArquivos ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, modArquivos: !!v })}
                />
                <Label htmlFor="mod-arquivos" className="font-normal cursor-pointer">Arquivos e Documentos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="mod-prescricoes" 
                  checked={formData.modPrescricoes ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, modPrescricoes: !!v })}
                />
                <Label htmlFor="mod-prescricoes" className="font-normal cursor-pointer">Prescrições Ativas</Label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFormsConfig = () => {
    return (
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label className="text-base font-semibold">Links Públicos</Label>
          <div className="flex items-center gap-3">
            <span className="text-sm">Validade do link</span>
            <Input 
              type="number" 
              className="w-24" 
              placeholder="48" 
              min="1"
              value={formData.publicLinkValidityHours || ""}
              onChange={(e) => setFormData({ ...formData, publicLinkValidityHours: Number(e.target.value) })}
            />
            <span className="text-sm">horas.</span>
          </div>
        </div>

        <div className="grid gap-4 pt-4 border-t">
          <Label className="text-base font-semibold">Recursos Avançados</Label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sw-assinatura" className="font-normal cursor-pointer">Assinatura digital exigida</Label>
              <Switch 
                id="sw-assinatura"
                checked={formData.requireDigitalSignature ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, requireDigitalSignature: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sw-upload" className="font-normal cursor-pointer">Upload assíncrono pelo paciente</Label>
              <Switch 
                id="sw-upload"
                checked={formData.asyncPatientUpload ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, asyncPatientUpload: v })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMedicalRecordConfig = () => {
    return (
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label className="text-base font-semibold">Blocos do Resumo Rápido</Label>
          <div className="flex flex-col gap-3 mt-1">
            {['Queixa Principal', 'Sinais Vitais', 'Evolução', 'Prescrições'].map((block, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox 
                  id={`block-${idx}`} 
                  checked={formData[`summaryBlock_${idx}`] ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, [`summaryBlock_${idx}`]: !!v })}
                />
                <Label htmlFor={`block-${idx}`} className="font-normal cursor-pointer">{block}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 pt-4 border-t">
          <Label className="text-base font-semibold">Impressão em PDF</Label>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-header" className="font-normal cursor-pointer">Cabeçalho oficial da clínica</Label>
              <Switch 
                id="pdf-header"
                checked={formData.pdfClinicHeader ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, pdfClinicHeader: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-signature" className="font-normal cursor-pointer">Espaço para assinatura do profissional</Label>
              <Switch 
                id="pdf-signature"
                checked={formData.pdfProfessionalSignature ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, pdfProfessionalSignature: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-datetime" className="font-normal cursor-pointer">Exibir data/hora exata no rodapé</Label>
              <Switch 
                id="pdf-datetime"
                checked={formData.pdfExactDateTime ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, pdfExactDateTime: v })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClinicSessionsListConfig = () => {
    return (
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label className="text-base font-semibold">Configurações da Lista</Label>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-selection" className="font-normal cursor-pointer">Ativar Seleção em Lote (Bulk Actions)</Label>
              <Switch 
                id="bulk-selection"
                checked={formData.bulk_selection ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, bulk_selection: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-financials" className="font-normal cursor-pointer">Exibir Valores Financeiros na Lista</Label>
              <Switch 
                id="show-financials"
                checked={formData.show_financials ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, show_financials: v })}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <Label className="text-base font-semibold">Ações em Lote Permitidas</Label>
          <div className="flex flex-col gap-3 mt-1">
            {['Alterar Status', 'Mover para Grupo', 'Excluir Atendimentos'].map((action, idx) => {
              const key = `allowAction_${idx}`;
              return (
                <div key={idx} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`action-${idx}`} 
                    checked={formData[key] ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, [key]: !!v })}
                  />
                  <Label htmlFor={`action-${idx}`} className="font-normal cursor-pointer">{action}</Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <Label className="text-base font-semibold">Filtro Padrão de Dias</Label>
          <Select 
            value={formData.default_filter_days || "30"} 
            onValueChange={(val) => setFormData({ ...formData, default_filter_days: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o filtro padrão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="current_month">Mês Atual</SelectItem>
              <SelectItem value="all">Todos (Pode causar lentidão)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderUIConfig = () => {
    return (
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label>Nível de animação</Label>
          <Select 
            value={formData.animationLevel || "fluido"} 
            onValueChange={(val) => setFormData({ ...formData, animationLevel: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desligado">Desligado</SelectItem>
              <SelectItem value="basico">Básico</SelectItem>
              <SelectItem value="fluido">Fluido (Padrão)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Densidade da UI</Label>
          <Select 
            value={formData.density || "confortavel"} 
            onValueChange={(val) => setFormData({ ...formData, density: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compacto">Compacto</SelectItem>
              <SelectItem value="confortavel">Confortável</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Forçar Tema</Label>
          <Select 
            value={formData.forceTheme || "user"} 
            onValueChange={(val) => setFormData({ ...formData, forceTheme: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claro">Claro (Light)</SelectItem>
              <SelectItem value="escuro">Escuro (Dark)</SelectItem>
              <SelectItem value="user">Escolha do Usuário (Sistema)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderClinicalPortfolioConfig = () => {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-primary font-semibold text-sm">
            <Briefcase className="w-4 h-4" />
            Portfólio Clínico Profissional (Acervo Pessoal)
          </div>
          <p>
            Configurações do acervo técnico e histórico de atendimentos realizados sob a responsabilidade técnica do profissional, acessível no Espaço Pessoal (/espacopessoal).
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="show-lgpd-banner" className="font-semibold text-sm cursor-pointer">
                Banner de Conformidade LGPD
              </Label>
              <p className="text-xs text-muted-foreground">
                Exibe banner institucional de conformidade jurídica com a LGPD e sigilo profissional no topo do portfólio.
              </p>
            </div>
            <Switch
              id="show-lgpd-banner"
              checked={formData.show_lgpd_banner ?? true}
              onCheckedChange={(val) => setFormData({ ...formData, show_lgpd_banner: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="allow-clinic-filter" className="font-semibold text-sm cursor-pointer">
                Busca e Filtragem por Clínica
              </Label>
              <p className="text-xs text-muted-foreground">
                Permite ao profissional filtrar seus atendimentos e pacientes por clínica no portfólio pessoal.
              </p>
            </div>
            <Switch
              id="allow-clinic-filter"
              checked={formData.allow_clinic_filter ?? true}
              onCheckedChange={(val) => setFormData({ ...formData, allow_clinic_filter: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="allow-clinic-redirect" className="font-semibold text-sm cursor-pointer">
                Atalho de Redirecionamento para Prontuário
              </Label>
              <p className="text-xs text-muted-foreground">
                Permite abrir diretamente o prontuário completo da clínica quando o profissional ainda for membro ativo.
              </p>
            </div>
            <Switch
              id="allow-clinic-redirect"
              checked={formData.allow_clinic_redirect ?? true}
              onCheckedChange={(val) => setFormData({ ...formData, allow_clinic_redirect: val })}
            />
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="maintenance-message" className="text-sm font-semibold">
              Mensagem de Manutenção (Opcional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Se preenchida, será exibida aos profissionais como aviso especial ou comunicado de manutenção temporária no Espaço Pessoal.
            </p>
            <Textarea
              id="maintenance-message"
              placeholder="Ex: O acervo de atendimentos está passando por sincronização programada..."
              value={(formData.maintenance_message as string) || ""}
              onChange={(e) => setFormData({ ...formData, maintenance_message: e.target.value })}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderAgendaConfig = () => {
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
  };

  const renderSubscriptionsConfig = () => {
    if (feature.key === "subscription_free_trial_enabled") {
      return (
        <div className="grid gap-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              Teste Gratuito (7 dias) (Trial Volumétrico / Free Tier)
            </div>
            <p>
              Permite que novos profissionais e clínicas experimentem a plataforma sem fornecer cartão de crédito durante o onboarding.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Duração do Teste Gratuito (Dias)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                placeholder="30"
                value={formData.trialDurationDays !== undefined ? String(formData.trialDurationDays) : "30"}
                onChange={(e) => setFormData({ ...formData, trialDurationDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Cota Inicial de Atendimentos</Label>
              <Input
                type="number"
                min={0}
                placeholder="0 (Ilimitado)"
                value={formData.trialMaxSessions !== undefined ? String(formData.trialMaxSessions) : "0"}
                onChange={(e) => setFormData({ ...formData, trialMaxSessions: Number(e.target.value) })}
              />
              <span className="text-[11px] text-muted-foreground">0 = sem limite de atendimentos durante os dias de teste.</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold">Comportamento ao Expirar o Período</Label>
            <Select
              value={(formData.expiredBehavior as string) || "read_only"}
              onValueChange={(val) => setFormData({ ...formData, expiredBehavior: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o comportamento..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read_only">Modo Somente Leitura (Bloqueia escrita mantendo prontuários acessíveis)</SelectItem>
                <SelectItem value="block_all">Bloqueio Total com Redirecionamento para Pagamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (feature.key === "subscription_payment_methods") {
      return (
        <div className="grid gap-6">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Métodos de Pagamento Habilitados</Label>
            <p className="text-xs text-muted-foreground">
              Selecione as formas de pagamento disponíveis no checkout e defina regras de desconto e parcelamento.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  PIX Instantâneo
                </Label>
                <p className="text-xs text-muted-foreground">Geração de QR Code dinâmico e chave Copia e Cola via Asaas.</p>
              </div>
              <Switch
                checked={formData.allowPix !== false}
                onCheckedChange={(v) => setFormData({ ...formData, allowPix: v })}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Cartão de Crédito
                </Label>
                <p className="text-xs text-muted-foreground">Processamento online com validação de algoritmo de Luhn e bandeira.</p>
              </div>
              <Switch
                checked={formData.allowCreditCard !== false}
                onCheckedChange={(v) => setFormData({ ...formData, allowCreditCard: v })}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Boleto Bancário
                </Label>
                <p className="text-xs text-muted-foreground">Emissão de boleto registrado com link direto gerado pelo Asaas.</p>
              </div>
              <Switch
                checked={formData.allowBoleto !== false}
                onCheckedChange={(v) => setFormData({ ...formData, allowBoleto: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Desconto Automático no PIX (%)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={formData.pixDiscountPercent !== undefined ? String(formData.pixDiscountPercent) : "5"}
                onChange={(e) => setFormData({ ...formData, pixDiscountPercent: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Parcelamento Máximo no Cartão Sem Juros</Label>
              <Select
                value={formData.maxCardInstallments !== undefined ? String(formData.maxCardInstallments) : "12"}
                onValueChange={(val) => setFormData({ ...formData, maxCardInstallments: Number(val) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o parcelamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x (À vista)</SelectItem>
                  <SelectItem value="3">Até 3x (Ciclo Trimestral)</SelectItem>
                  <SelectItem value="6">Até 6x</SelectItem>
                  <SelectItem value="12">Até 12x (Ciclo Anual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    }

    if (feature.key === "subscription_coupons_enabled") {
      return (
        <div className="grid gap-6">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Políticas de Cupons Promocionais</Label>
            <p className="text-xs text-muted-foreground">
              Gerencie a validação e aplicabilidade de cupons de desconto no fluxo de compra.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-500" />
                  Habilitar Campo de Cupom no Checkout
                </Label>
                <p className="text-xs text-muted-foreground">Exibe o input de cupom promocional durante o checkout.</p>
              </div>
              <Switch
                checked={formData.showCouponInCheckout !== false}
                onCheckedChange={(v) => setFormData({ ...formData, showCouponInCheckout: v })}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer">
                  Acumular Cupom com Desconto PIX (5%)
                </Label>
                <p className="text-xs text-muted-foreground">Aplica o desconto do cupom e calcula os 5% do PIX sobre o saldo restante.</p>
              </div>
              <Switch
                checked={formData.allowCumulativePix !== false}
                onCheckedChange={(v) => setFormData({ ...formData, allowCumulativePix: v })}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <Label className="font-semibold text-sm cursor-pointer">
                  Permitir Cupons em Planos com Desconto de Ciclo (Trimestral/Anual)
                </Label>
                <p className="text-xs text-muted-foreground">Permite aplicar cupom mesmo em planos anuais (-25%) e trimestrais (-10%).</p>
              </div>
              <Switch
                checked={formData.allowOnDiscountedCycles !== false}
                onCheckedChange={(v) => setFormData({ ...formData, allowOnDiscountedCycles: v })}
              />
            </div>
          </div>
        </div>
      );
    }

    // Default: subscriptions_module (Ambiente Asaas, Matriz Oficial de Preços e Visão Geral)
    const currentAsaasEnv = (formData.asaas_environment as string) || "production";
    const isProduction = currentAsaasEnv === "production";

    return (
      <div className="grid gap-6">
        {/* Seletor de Ambiente: Produção Oficial vs Sandbox */}
        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Globe className={`w-4 h-4 ${isProduction ? "text-emerald-500" : "text-amber-500"}`} />
                <Label className="text-sm font-bold">
                  Ambiente do Gateway Asaas: {isProduction ? "Oficial (Produção)" : "Sandbox (Testes)"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {isProduction
                  ? "Cobranças bancárias e cartões reais processados na API de produção (https://api.asaas.com/v3)."
                  : "Transações simuladas e sem valor monetário real na API de testes (https://sandbox.asaas.com/api/v3)."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                isProduction ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              }`}>
                {isProduction ? "PRODUÇÃO" : "SANDBOX"}
              </span>
              <Switch
                checked={isProduction}
                onCheckedChange={(checked) => setFormData({ ...formData, asaas_environment: checked ? "production" : "sandbox" })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div
              onClick={() => setFormData({ ...formData, asaas_environment: "sandbox" })}
              className={`cursor-pointer rounded-xl p-3 border transition-all ${
                !isProduction
                  ? "border-amber-500 bg-amber-500/10 shadow-sm"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-foreground">🟡 Sandbox (Testes)</span>
                {!isProduction && <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded">Ativo</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gera QR Codes fictícios e valida fluxos de checkout sem cobrança monetária real.
              </p>
            </div>

            <div
              onClick={() => setFormData({ ...formData, asaas_environment: "production" })}
              className={`cursor-pointer rounded-xl p-3 border transition-all ${
                isProduction
                  ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-foreground">🟢 Oficial (Produção)</span>
                {isProduction && <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded">Ativo</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Processamento oficial com emissão de PIX real, cartão e compensação bancária.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            Ambiente Seguro & Proteção de Credenciais
          </div>
          <p className="leading-relaxed">
            As chaves de API (<code className="font-mono text-emerald-800 dark:text-emerald-300">ASAAS_API_KEY</code> para Produção Oficial e <code className="font-mono text-emerald-800 dark:text-emerald-300">ASAAS_SANDBOX_API_KEY</code> para Sandbox) e tokens de webhook são mantidos de forma estritamente segura nas Edge Functions Deno do Supabase. O front-end apenas sinaliza qual ambiente deve processar a requisição.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-base font-semibold">Tabela de Preços e Ciclos Oficiais (Matriz Canônica)</Label>
          <p className="text-xs text-muted-foreground">
            Valores base sincronizados com a calculadora oficial da plataforma (<code className="font-mono text-[11px]">subscriptionPricing.ts</code>).
          </p>
        </div>

        {/* Grupo 1: Planos Profissionais (Individuais & Apoio) */}
        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2">
              <UserRound className="w-4 h-4 text-emerald-600" />
              <Label className="font-bold text-sm">Grupo 1: Planos Profissionais (Individuais & Apoio)</Label>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              Profissionais
            </span>
          </div>

          <div className="space-y-3">
            {/* Profissional Básico */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Básico</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(1 acesso, 1 formulário customizado)</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">Entrada</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 57,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-17%)</span>
                  <span className="font-bold text-foreground">R$ 47,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 141,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-35%)</span>
                  <span className="font-bold text-foreground">R$ 37,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 444,00</span>
                </div>
              </div>
            </div>

            {/* Profissional Médio */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Médio</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(1 acesso, formulários ilimitados)</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded w-fit">Mais Popular</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 87,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-23%)</span>
                  <span className="font-bold text-foreground">R$ 67,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 201,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-34%)</span>
                  <span className="font-bold text-foreground">R$ 57,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 684,00</span>
                </div>
              </div>
            </div>

            {/* Profissional Top */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Top</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(2 acessos: Dono + 1 Apoio, formulários ilimitados)</span>
                </div>
                <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded w-fit">Dono + Apoio</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 127,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-15%)</span>
                  <span className="font-bold text-foreground">R$ 107,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 321,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-31%)</span>
                  <span className="font-bold text-foreground">R$ 87,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.044,00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grupo 2: Planos para Clínicas & Equipes (Colaboradores Ilimitados no Cadastro) */}
        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <Label className="font-bold text-sm">Grupo 2: Planos para Clínicas & Equipes (Colaboradores Ilimitados no Cadastro)</Label>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
              Equipes & Clínicas
            </span>
          </div>

          <div className="space-y-3">
            {/* Clínica Básico */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Básico</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(2 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">2 Acessos Base</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 147,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-13%)</span>
                  <span className="font-bold text-foreground">R$ 127,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 381,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-34%)</span>
                  <span className="font-bold text-foreground">R$ 97,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.164,00</span>
                </div>
              </div>
            </div>

            {/* Clínica Médio */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Médio</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(4 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded w-fit">4 Acessos Base</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 267,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-15%)</span>
                  <span className="font-bold text-foreground">R$ 227,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 681,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-33%)</span>
                  <span className="font-bold text-foreground">R$ 177,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 2.124,00</span>
                </div>
              </div>
            </div>

            {/* Clínica Top */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Top</span>
                  <span className="text-[11px] text-muted-foreground ml-2">(8 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
                </div>
                <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded w-fit">8 Acessos Base</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Mensal</span>
                  <span className="font-bold text-foreground">R$ 447,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Trimestral (-13%)</span>
                  <span className="font-bold text-foreground">R$ 387,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.161,00</span>
                </div>
                <div className="p-2 rounded border bg-muted/20">
                  <span className="text-muted-foreground block text-[11px]">Anual (-33%)</span>
                  <span className="font-bold text-foreground">R$ 297,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 3.564,00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAntiPrintConfig = () => {
    const availableRoutes = [
      { path: "/pacientes", label: "/pacientes (Fichas e Prontuários)", defaultChecked: true },
      { path: "/sessoes", label: "/sessoes (Atendimentos e Evoluções)", defaultChecked: true },
      { path: "/formularios", label: "/formularios (Respostas de Formulários)", defaultChecked: true },
      { path: "/configuracoes/equipe", label: "/configuracoes/equipe (Dados de Colaboradores)", defaultChecked: true },
      { path: "/dashboard", label: "/dashboard (Painel Geral da Clínica)", defaultChecked: false },
      { path: "/configuracoes/clinica", label: "/configuracoes/clinica (Configurações Gerais)", defaultChecked: false },
    ];

    const currentRoutes: string[] = Array.isArray(formData.protectedRoutes)
      ? (formData.protectedRoutes as string[])
      : availableRoutes.filter(r => r.defaultChecked).map(r => r.path);

    const toggleRoute = (path: string, checked: boolean) => {
      let updated: string[];
      if (checked) {
        updated = Array.from(new Set([...currentRoutes, path]));
      } else {
        updated = currentRoutes.filter(r => r !== path);
      }
      setFormData({ ...formData, protectedRoutes: updated });
    };

    return (
      <div className="grid gap-6">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Checklist de Páginas Protegidas</Label>
          <p className="text-xs text-muted-foreground">
            Selecione quais páginas da aplicação ativam o desfoque imediato, alerta visual e log de auditoria ao tentar tirar captura de tela.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 bg-neutral-50/50">
          {availableRoutes.map((route) => {
            const isChecked = currentRoutes.includes(route.path);
            return (
              <div key={route.path} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white transition-colors">
                <Checkbox
                  id={`route-${route.path}`}
                  checked={isChecked}
                  onCheckedChange={(v) => toggleRoute(route.path, !!v)}
                />
                <Label htmlFor={`route-${route.path}`} className="font-medium text-sm cursor-pointer text-neutral-800">
                  {route.label}
                </Label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWhatsAppOnboardingConfig = () => {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <MessageSquare className="w-4 h-4" />
            WhatsApp: Boas-Vindas & Onboarding Automático
          </div>
          <p>
            Envia automaticamente mensagem receptiva com instruções e link de primeiro acesso quando um novo usuário ou clínica é cadastrado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wa-onboarding-phone" className="text-xs font-semibold">Número do Bot (Com DDI)</Label>
            <Input
              id="wa-onboarding-phone"
              placeholder="5511980113936"
              value={(formData.botPhoneNumber as string) || "5511980113936"}
              onChange={(e) => setFormData({ ...formData, botPhoneNumber: e.target.value })}
            />
            <span className="text-[11px] text-muted-foreground">Número de WhatsApp oficial que enviará os disparos.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-onboarding-delay" className="text-xs font-semibold">Delay do Disparo (Segundos)</Label>
            <Input
              id="wa-onboarding-delay"
              type="number"
              min={0}
              max={300}
              placeholder="15"
              value={formData.delaySeconds !== undefined ? String(formData.delaySeconds) : "15"}
              onChange={(e) => setFormData({ ...formData, delaySeconds: Number(e.target.value) })}
            />
            <span className="text-[11px] text-muted-foreground">Tempo de espera antes de engatilhar a mensagem.</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-onboarding-template" className="text-xs font-semibold">Texto da Mensagem de Boas-Vindas</Label>
          <Textarea
            id="wa-onboarding-template"
            rows={3}
            placeholder="Olá {{nome}}! Seja muito bem-vindo(a) ao Pluri Health..."
            value={(formData.welcomeMessageTemplate as string) || "Olá {{nome}}! Seja muito bem-vindo(a) ao Pluri Health. Seu espaço clínico seguro já está pronto para uso: {{link_acesso}}"}
            onChange={(e) => setFormData({ ...formData, welcomeMessageTemplate: e.target.value })}
            className="text-xs"
          />
          <span className="text-[11px] text-muted-foreground">Variáveis disponíveis: <code>{"{{nome}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{link_acesso}}"}</code>.</span>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-send-first-link" className="font-semibold text-xs cursor-pointer">
                Incluir Link Seguro de Primeiro Acesso
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Gera token temporário seguro para definição rápida de senha.
              </p>
            </div>
            <Switch
              id="wa-send-first-link"
              checked={formData.sendFirstAccessLink !== false}
              onCheckedChange={(val) => setFormData({ ...formData, sendFirstAccessLink: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-weekend" className="font-semibold text-xs cursor-pointer">
                Disparar nos Finais de Semana
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Se desligado, cadastros feitos no sábado/domingo recebem mensagem na segunda-feira às 08h.
              </p>
            </div>
            <Switch
              id="wa-notify-weekend"
              checked={Boolean(formData.notifyOnWeekend ?? false)}
              onCheckedChange={(val) => setFormData({ ...formData, notifyOnWeekend: val })}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderWhatsAppTransbordoConfig = () => {
    const alertTypes = (formData.alertTypes as Record<string, boolean>) || {
      suporte: true,
      novos_agendamentos: true,
      duvidas_planos: true,
      reclamacoes: true,
    };

    const toggleAlertType = (type: string, checked: boolean) => {
      setFormData({
        ...formData,
        alertTypes: {
          ...alertTypes,
          [type]: checked,
        },
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-blue-700 dark:text-blue-400 font-semibold text-sm">
            <PhoneForwarded className="w-4 h-4" />
            Transbordo para Atendimento Comercial Humano
          </div>
          <p>
            Redireciona conversas complexas, suporte e dúvidas de contratação do bot direto para o WhatsApp oficial do time comercial.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transbordo-dest-number" className="text-xs font-semibold">Número de Destino do Transbordo Comercial</Label>
          <Input
            id="transbordo-dest-number"
            placeholder="5511980113936"
            value={(formData.destinationPhoneNumber as string) || "5511980113936"}
            onChange={(e) => setFormData({ ...formData, destinationPhoneNumber: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">Número comercial oficial: <strong>5511980113936</strong></span>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Tipos de Alerta & Transbordo</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-suporte"
                checked={alertTypes.suporte !== false}
                onCheckedChange={(v) => toggleAlertType("suporte", !!v)}
              />
              <Label htmlFor="alert-suporte" className="text-xs cursor-pointer">Suporte Técnico</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-agendamentos"
                checked={alertTypes.novos_agendamentos !== false}
                onCheckedChange={(v) => toggleAlertType("novos_agendamentos", !!v)}
              />
              <Label htmlFor="alert-agendamentos" className="text-xs cursor-pointer">Novos Agendamentos</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-planos"
                checked={alertTypes.duvidas_planos !== false}
                onCheckedChange={(v) => toggleAlertType("duvidas_planos", !!v)}
              />
              <Label htmlFor="alert-planos" className="text-xs cursor-pointer">Dúvidas de Planos / Vendas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-reclamacoes"
                checked={alertTypes.reclamacoes !== false}
                onCheckedChange={(v) => toggleAlertType("reclamacoes", !!v)}
              />
              <Label htmlFor="alert-reclamacoes" className="text-xs cursor-pointer">Reclamações & Cancelamento</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transbordo-fallback-msg" className="text-xs font-semibold">Mensagem de Fallback / Transferência</Label>
          <Textarea
            id="transbordo-fallback-msg"
            rows={2}
            placeholder="Entendido! Estou transferindo seu atendimento para o nosso especialista humano..."
            value={(formData.fallbackMessage as string) || "Entendido! Estou transferindo seu atendimento para o nosso especialista humano. Em instantes você será atendido."}
            onChange={(e) => setFormData({ ...formData, fallbackMessage: e.target.value })}
            className="text-xs"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="transbordo-office-hours" className="font-semibold text-xs cursor-pointer">
              Transbordar Apenas no Horário Comercial
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Fora do horário, avisa o lead que a equipe entrará em contato na manhã seguinte.
            </p>
          </div>
          <Switch
            id="transbordo-office-hours"
            checked={Boolean(formData.officeHoursOnly ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, officeHoursOnly: val })}
          />
        </div>
      </div>
    );
  };

  const renderWhatsAppBillingConfig = () => {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <Receipt className="w-4 h-4" />
            WhatsApp: Confirmação de Assinaturas & Upgrade (Asaas)
          </div>
          <p>
            Disparos automáticos pós-aprovação de pagamento pelo gateway Asaas (Cartão, PIX ou Boleto) confirmando liberação de planos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-billing-thanks" className="text-xs font-semibold">Texto de Agradecimento e Boas-Vindas ao Plano</Label>
          <Textarea
            id="wa-billing-thanks"
            rows={3}
            placeholder="Olá {{nome}}, confirmamos com sucesso a sua assinatura..."
            value={(formData.thankYouMessageTemplate as string) || "Olá {{nome}}, confirmamos com sucesso a sua assinatura do plano {{plano}} via Asaas! Obrigado por confiar no Pluri Health."}
            onChange={(e) => setFormData({ ...formData, thankYouMessageTemplate: e.target.value })}
            className="text-xs"
          />
          <span className="text-[11px] text-muted-foreground">Variáveis suportadas: <code>{"{{nome}}"}</code>, <code>{"{{plano}}"}</code>, <code>{"{{valor}}"}</code>.</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-billing-link" className="text-xs font-semibold">Link Direto de Login no Sistema</Label>
          <Input
            id="wa-billing-link"
            placeholder="https://plurihealth.com.br/login"
            value={(formData.systemLoginLink as string) || "https://plurihealth.com.br/login"}
            onChange={(e) => setFormData({ ...formData, systemLoginLink: e.target.value })}
          />
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-upgrade" className="font-semibold text-xs cursor-pointer">
                Disparar Alerta em Upgrades de Plano
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Envia parabéns e resumo das novas capacidades liberadas na clínica.
              </p>
            </div>
            <Switch
              id="wa-notify-upgrade"
              checked={formData.notifyUpgrade !== false}
              onCheckedChange={(val) => setFormData({ ...formData, notifyUpgrade: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-failed" className="font-semibold text-xs cursor-pointer">
                Aviso de Falha ou Recusa de Cobrança
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Notifica o gestor amigavelmente com link para atualizar a forma de pagamento.
              </p>
            </div>
            <Switch
              id="wa-notify-failed"
              checked={formData.notifyPaymentFailed !== false}
              onCheckedChange={(val) => setFormData({ ...formData, notifyPaymentFailed: val })}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderTelegramAdminConfig = () => {
    const events = (formData.events as Record<string, boolean>) || {
      newRegistrations: true,
      newBookings: true,
      asaasPayments: true,
      errorAlerts: true,
    };

    const toggleEvent = (eventKey: string, checked: boolean) => {
      setFormData({
        ...formData,
        events: {
          ...events,
          [eventKey]: checked,
        },
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-sky-700 dark:text-sky-400 font-semibold text-sm">
            <Send className="w-4 h-4" />
            Telegram: Alertas em Tempo Real do Administrador
          </div>
          <p>
            Transmissão de telemetria e eventos estratégicos diretamente no grupo ou chat dos administradores do sistema.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram-chat-id" className="text-xs font-semibold">Chat ID do Grupo / Administrador</Label>
          <Input
            id="telegram-chat-id"
            placeholder="-100234567890"
            value={(formData.chatId as string) || "-100234567890"}
            onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">ID numérico do chat no Telegram (ex: canal, supergrupo ou ID pessoal).</span>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Eventos Monitorados</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-reg"
                checked={events.newRegistrations !== false}
                onCheckedChange={(v) => toggleEvent("newRegistrations", !!v)}
              />
              <Label htmlFor="event-reg" className="text-xs cursor-pointer">Novos Cadastros de Clínicas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-bookings"
                checked={events.newBookings !== false}
                onCheckedChange={(v) => toggleEvent("newBookings", !!v)}
              />
              <Label htmlFor="event-bookings" className="text-xs cursor-pointer">Novos Agendamentos de Onboarding</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-payments"
                checked={events.asaasPayments !== false}
                onCheckedChange={(v) => toggleEvent("asaasPayments", !!v)}
              />
              <Label htmlFor="event-payments" className="text-xs cursor-pointer">Pagamentos Confirmados Asaas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-errors"
                checked={events.errorAlerts !== false}
                onCheckedChange={(v) => toggleEvent("errorAlerts", !!v)}
              />
              <Label htmlFor="event-errors" className="text-xs cursor-pointer">Alertas de Erros Críticos (Sentry/Logs)</Label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="tg-silent" className="font-semibold text-xs cursor-pointer">
              Notificações Silenciosas
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Envia as mensagens sem emitir som ou vibração no celular do administrador.
            </p>
          </div>
          <Switch
            id="tg-silent"
            checked={Boolean(formData.silentNotifications ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, silentNotifications: val })}
          />
        </div>
      </div>
    );
  };

  const renderPatientRemindersConfig = () => {
    const channels = (formData.channels as Record<string, boolean>) || {
      whatsapp: true,
      sms: false,
      email: true,
    };

    const toggleChannel = (channelKey: string, checked: boolean) => {
      setFormData({
        ...formData,
        channels: {
          ...channels,
          [channelKey]: checked,
        },
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-violet-700 dark:text-violet-400 font-semibold text-sm">
            <BellRing className="w-4 h-4" />
            Lembretes de Consultas e Atendimentos (WhatsApp/SMS)
          </div>
          <p>
            Redução proativa de faltas com envio automático de confirmação prévia e lembretes multicanal aos pacientes.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Canais de Disparo Habilitados</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="chan-rem-wa"
                checked={channels.whatsapp !== false}
                onCheckedChange={(v) => toggleChannel("whatsapp", !!v)}
              />
              <Label htmlFor="chan-rem-wa" className="text-xs cursor-pointer">WhatsApp</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="chan-rem-sms"
                checked={Boolean(channels.sms ?? false)}
                onCheckedChange={(v) => toggleChannel("sms", !!v)}
              />
              <Label htmlFor="chan-rem-sms" className="text-xs cursor-pointer">SMS Direto</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="chan-rem-email"
                checked={channels.email !== false}
                onCheckedChange={(v) => toggleChannel("email", !!v)}
              />
              <Label htmlFor="chan-rem-email" className="text-xs cursor-pointer">E-mail</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Janelas de Antecedência</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="rem-24h" className="text-xs font-medium cursor-pointer">Lembrete com 24 Horas de Antecedência</Label>
                <p className="text-[10px] text-muted-foreground">Disparado no dia anterior à sessão.</p>
              </div>
              <Switch
                id="rem-24h"
                checked={formData.remind24hBefore !== false}
                onCheckedChange={(val) => setFormData({ ...formData, remind24hBefore: val })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="rem-2h" className="text-xs font-medium cursor-pointer">Lembrete com 2 Horas de Antecedência</Label>
                <p className="text-[10px] text-muted-foreground">Alerta final antes do atendimento.</p>
              </div>
              <Switch
                id="rem-2h"
                checked={formData.remind2hBefore !== false}
                onCheckedChange={(val) => setFormData({ ...formData, remind2hBefore: val })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rem-template" className="text-xs font-semibold">Template da Mensagem de Lembrete</Label>
          <Textarea
            id="rem-template"
            rows={3}
            placeholder="Olá {{paciente}}, lembramos de sua consulta..."
            value={(formData.reminderMessageTemplate as string) || "Olá {{paciente}}, lembramos de sua consulta agendada para {{data_hora}} com {{profissional}}. Responda 1 para confirmar ou 2 para remarcar."}
            onChange={(e) => setFormData({ ...formData, reminderMessageTemplate: e.target.value })}
            className="text-xs"
          />
          <span className="text-[11px] text-muted-foreground">Variáveis: <code>{"{{paciente}}"}</code>, <code>{"{{data_hora}}"}</code>, <code>{"{{profissional}}"}</code>.</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="rem-allow-confirm" className="font-semibold text-xs cursor-pointer">
              Permitir Confirmação Interativa do Paciente (1/2)
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Atualiza automaticamente o status do agendamento para confirmado na agenda.
            </p>
          </div>
          <Switch
            id="rem-allow-confirm"
            checked={formData.allowPatientConfirmation !== false}
            onCheckedChange={(val) => setFormData({ ...formData, allowPatientConfirmation: val })}
          />
        </div>
      </div>
    );
  };

  const renderWhatsAppFlowsConfig = () => {
    const handleCopyFlowJson = () => {
      navigator.clipboard.writeText(SAMPLE_WHATSAPP_FLOW_JSON);
      toast({
        title: "JSON do Flow Copiado!",
        description: "Estrutura do Flow copiada para a área de transferência. Cole no Flow Builder da Meta.",
      });
    };

    const handleDownloadFlowJson = () => {
      const blob = new Blob([SAMPLE_WHATSAPP_FLOW_JSON], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp-flow-${(formData.flow_id as string) || "pluri-triage"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download Concluído",
        description: "Arquivo JSON gerado e pronto para upload no Gerenciador do WhatsApp.",
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            WhatsApp Flows (Formulários Nativos Deslizantes)
          </div>
          <p>
            Permite que os pacientes preencham triagens, dados cadastrais e preferências de consulta diretamente em formulários nativos com gavetas deslizantes dentro do WhatsApp, sem precisar sair do app ou abrir navegadores externos.
          </p>
        </div>

        {/* Ativação Geral */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="wa-flows-enabled" className="font-semibold text-sm cursor-pointer">
              Ativação Geral do WhatsApp Flows
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando habilitado, o sistema envia formulários interativos nativos deslizantes em vez de menus de texto fixos.
            </p>
          </div>
          <Switch
            id="wa-flows-enabled"
            checked={Boolean(formData.enabled ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, enabled: val })}
          />
        </div>

        {/* Campo Meta Flow ID */}
        <div className="space-y-2">
          <Label htmlFor="wa-flows-id" className="text-xs font-semibold">
            Meta Flow ID (Gerenciador do WhatsApp)
          </Label>
          <Input
            id="wa-flows-id"
            placeholder="Ex: 1234567890123456"
            value={(formData.flow_id as string) || ""}
            onChange={(e) => setFormData({ ...formData, flow_id: e.target.value })}
            className="font-mono text-xs"
          />
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Onde encontrar:</strong> Acesse o <em>Meta Business Suite</em> &gt; <em>Gerenciador do WhatsApp</em> &gt; <em>Ferramentas de Conta</em> &gt; <strong>Flows</strong>. Copie o ID numérico gerado após criar seu Flow.
              </span>
            </div>
          </div>
        </div>

        {/* Seletor de Modo: Draft vs Published */}
        <div className="space-y-2">
          <Label htmlFor="wa-flows-mode" className="text-xs font-semibold">
            Modo de Operação do Flow
          </Label>
          <Select
            value={(formData.mode as string) || "draft"}
            onValueChange={(val: "draft" | "published") => setFormData({ ...formData, mode: val })}
          >
            <SelectTrigger id="wa-flows-mode">
              <SelectValue placeholder="Selecione o modo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Rascunho / Teste (Draft) - Apenas números de teste e desenvolvedores</span>
                </span>
              </SelectItem>
              <SelectItem value="published">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Publicado / Produção (Published) - Disponível para todos os pacientes</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            No modo Rascunho, a Meta permite testar o Flow sem exigir publicação oficial da conta de WhatsApp Business.
          </span>
        </div>

        {/* Switch de Fallback Automático */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="wa-flows-fallback" className="font-semibold text-xs cursor-pointer">
              Fallback Automático para Chat Conversacional
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Permitir preenchimento conversacional no chat caso o aparelho do paciente não suporte WhatsApp Flows (versões antigas do WhatsApp ou WhatsApp Web/Desktop sem suporte).
            </p>
          </div>
          <Switch
            id="wa-flows-fallback"
            checked={formData.fallback_to_chat !== false}
            onCheckedChange={(val) => setFormData({ ...formData, fallback_to_chat: val })}
          />
        </div>

        {/* Template JSON auxiliar e Botões de Ação */}
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/10 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Especificação JSON do Flow (Meta Flow Builder)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyFlowJson}
                className="h-7 text-xs gap-1"
              >
                <Copy className="w-3 h-3" />
                Copiar JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadFlowJson}
                className="h-7 text-xs gap-1"
              >
                <Download className="w-3 h-3" />
                Baixar .json
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Utilize este esquema JSON pré-formatado de triagem clínica para importar diretamente no editor de Flows da Meta ou testar no Endpoint interativo.
          </p>
        </div>
      </div>
    );
  };

  const renderAgendaMasterConfig = () => {
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
  };

  const renderAgendaWhatsAppBookingConfig = () => {
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
  };

  const renderAgendaGoogleCalendarSyncConfig = () => {
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
  };

  const renderAgendaSmartBlocksBuffersConfig = () => {
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
  };

  const renderFormContent = () => {
    // Novas Flags de Notificações
    if (feature.key === "whatsapp_flows_enabled") return renderWhatsAppFlowsConfig();
    if (feature.key === "notifications_whatsapp_onboarding") return renderWhatsAppOnboardingConfig();
    if (feature.key === "notifications_whatsapp_transbordo") return renderWhatsAppTransbordoConfig();
    if (feature.key === "notifications_whatsapp_billing") return renderWhatsAppBillingConfig();
    if (feature.key === "notifications_telegram_admin") return renderTelegramAdminConfig();
    if (feature.key === "notifications_patient_reminders") return renderPatientRemindersConfig();

    // Novas Flags de Agenda
    if (feature.key === "agenda_master_onboarding") return renderAgendaMasterConfig();
    if (feature.key === "agenda_whatsapp_booking_flow") return renderAgendaWhatsAppBookingConfig();
    if (feature.key === "agenda_google_calendar_sync") return renderAgendaGoogleCalendarSyncConfig();
    if (feature.key === "agenda_smart_blocks_buffers") return renderAgendaSmartBlocksBuffersConfig();

    if (feature.key === "anti_print_protection") return renderAntiPrintConfig();
    if (feature.category === "Assinaturas") return renderSubscriptionsConfig();
    if (feature.category === "Storage/Arquivos") return renderStorageForm();
    if (feature.category === "Notificações") return renderNotificationsForm();
    if (feature.category === "Dashboards") return renderDashboardsForm();
    if (feature.category === "Formulários") return renderFormsConfig();
    if (feature.category === "Prontuário/Atendimentos") {
      if (feature.key === "clinic_sessions_list") return renderClinicSessionsListConfig();
      return renderMedicalRecordConfig();
    }
    if (feature.key === "clinical_portfolio_enabled") return renderClinicalPortfolioConfig();
    if (feature.category === "Agenda") return renderAgendaConfig();
    if (feature.category === "UI/Experiência") return renderUIConfig();
    
    return (
      <div className="py-8 text-center text-neutral-500">
        <p>O formulário dinâmico para <strong>{feature.category}</strong> será renderizado aqui.</p>
        <p className="text-sm mt-2 font-mono bg-neutral-100 p-2 rounded-md inline-block">{feature.key}</p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90vh]">
        
        {/* Cabeçalho fixo */}
        <DialogHeader className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            Configurar: {feature.label}
          </DialogTitle>
          <DialogDescription>
            {feature.description}
          </DialogDescription>
        </DialogHeader>

        {/* Área de conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {renderFormContent()}
        </div>

        {/* Rodapé fixo */}
        <DialogFooter className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 shrink-0 flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
