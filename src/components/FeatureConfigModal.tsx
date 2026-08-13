import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { featureFlagsCatalog } from "@/lib/feature-flags-catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

  if (!feature) {
    return null;
  }

  const isValid = () => {
    if (feature?.category === "Storage/Arquivos") {
      if (!formData.endpoint || !formData.region || !formData.bucketName || !formData.accessKey || !formData.secretKey) {
        return false;
      }
      if (formData.maxSizeMb <= 0) return false;
    }
    if (feature?.category === "Notificações") {
      if (formData.retentionDays <= 0) return false;
    }
    if (feature?.category === "Formulários") {
      if (formData.publicLinkValidityHours <= 0) return false;
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

      const { data: existingData, error: fetchError } = await matchQuery.single();
      
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

      // 3. Atualizar no banco
      let updateQuery = supabase.from("feature_flags").update({ value: mergedPayload }).eq("key", featureKey).eq("scope", scope);
      if (scope === "tag" && tagId) updateQuery = updateQuery.eq("tag_id", tagId);
      if (scope === "clinic" && clinicId) updateQuery = updateQuery.eq("clinic_id", clinicId);
      if (scope === "global") updateQuery = updateQuery.is("tag_id", null).is("clinic_id", null);

      const { error: updateError } = await updateQuery;
      if (updateError) throw updateError;

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
        <div className="grid gap-2">
          <Label>Provedor</Label>
          <Select 
            value={formData.provider || "s3"} 
            onValueChange={(val) => setFormData({ ...formData, provider: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o provedor externo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s3">AWS S3</SelectItem>
              <SelectItem value="minio">MinIO</SelectItem>
              <SelectItem value="backblaze">Backblaze B2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Endpoint URL <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="https://..." 
                  value={formData.endpoint || ""}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Região <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="us-east-1" 
                  value={formData.region || ""}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Nome do Bucket <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="meu-bucket-clinica" 
                value={formData.bucketName || ""}
                onChange={(e) => setFormData({ ...formData, bucketName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Access Key <span className="text-red-500">*</span></Label>
                <Input 
                  type="password"
                  placeholder="***" 
                  value={formData.accessKey || ""}
                  onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Secret Key <span className="text-red-500">*</span></Label>
                <Input 
                  type="password"
                  placeholder="***" 
                  value={formData.secretKey || ""}
                  onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                />
              </div>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
          <div className="grid gap-2">
            <Label>Tamanho máximo (MB) <span className="text-red-500">*</span></Label>
            <Input 
              type="number"
              min="1"
              placeholder="10" 
              value={formData.maxSizeMb || ""}
              onChange={(e) => setFormData({ ...formData, maxSizeMb: Math.max(1, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Extensões permitidas</Label>
            <Input 
              placeholder=".pdf, .jpg, .png" 
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

  const renderSubscriptionsConfig = () => {
    return (
      <div className="grid gap-6">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Customização de Tipos de Planos</Label>
          <p className="text-xs text-muted-foreground">
            Configure as regras de valores, cotas base e recursos oferecidos em cada tipo de plano da plataforma.
          </p>
        </div>

        {/* Plano Solo */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-neutral-50/50">
          <div className="flex justify-between items-center">
            <Label className="font-bold text-sm text-neutral-900">Plano Profissional Solo</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">1 Acesso / 0 Subcontas</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor Recorrente (R$/mês)</Label>
              <Input
                type="number"
                value={formData.soloPrice !== undefined ? String(formData.soloPrice) : "50"}
                onChange={(e) => setFormData({ ...formData, soloPrice: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acessos Simultâneos Inclusos</Label>
              <Input
                type="number"
                disabled
                value="1"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição / Benefícios</Label>
            <Input
              value={formData.soloDescription !== undefined ? String(formData.soloDescription) : "1 Profissional de saúde (titular), sem cobrança de subcontas, 1 acesso simultâneo por vez."}
              onChange={(e) => setFormData({ ...formData, soloDescription: e.target.value })}
            />
          </div>
        </div>

        {/* Plano Clínica */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-neutral-50/50">
          <div className="flex justify-between items-center">
            <Label className="font-bold text-sm text-neutral-900">Plano Clínica com Equipe</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Múltiplos Acessos</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mensalidade Base (R$/mês)</Label>
              <Input
                type="number"
                value={formData.clinicBasePrice !== undefined ? String(formData.clinicBasePrice) : "60"}
                onChange={(e) => setFormData({ ...formData, clinicBasePrice: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vagas de Colaboradores Inclusas</Label>
              <Input
                type="number"
                value={formData.clinicBaseSubaccountLimit !== undefined ? String(formData.clinicBaseSubaccountLimit) : "30"}
                onChange={(e) => setFormData({ ...formData, clinicBaseSubaccountLimit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Acessos Simultâneos Inclusos</Label>
              <Input
                type="number"
                value={formData.clinicBaseConcurrentLimit !== undefined ? String(formData.clinicBaseConcurrentLimit) : "2"}
                onChange={(e) => setFormData({ ...formData, clinicBaseConcurrentLimit: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço Acesso Extra (R$/mês)</Label>
              <Input
                type="number"
                value={formData.clinicExtraConcurrentPrice !== undefined ? String(formData.clinicExtraConcurrentPrice) : "10"}
                onChange={(e) => setFormData({ ...formData, clinicExtraConcurrentPrice: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço Vaga Avulsa de Colaborador (R$ único)</Label>
            <Input
              type="number"
              value={formData.clinicExtraSeatPrice !== undefined ? String(formData.clinicExtraSeatPrice) : "5"}
              onChange={(e) => setFormData({ ...formData, clinicExtraSeatPrice: Number(e.target.value) })}
            />
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

  const renderFormContent = () => {
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
