import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  ShieldCheck, 
  Sparkles, 
  QrCode, 
  Receipt, 
  CreditCard, 
  Tag, 
  UserRound, 
  Building2,
  Globe 
} from "lucide-react";
import { featureFlagsCatalog } from "@/lib/feature-flags-catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { HelpersConfigModal } from "@/components/tutorial/HelpersConfigModal";

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

  if (!feature) {
    return null;
  }

  const isValid = () => {
    if (feature?.category === "Storage/Arquivos") {
      if (formData.maxSizeMb && Number(formData.maxSizeMb) <= 0) return false;
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

  const renderSubscriptionsConfig = () => {
    if (feature.key === "subscription_free_trial_enabled") {
      return (
        <div className="grid gap-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              Degustação Gratuita (Trial Volumétrico / Free Tier)
            </div>
            <p>
              Permite que novos profissionais e clínicas experimentem a plataforma sem fornecer cartão de crédito durante o onboarding.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Duração da Degustação (Dias)</Label>
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

        {/* Matriz Solo */}
        <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <UserRound className="w-4 h-4 text-emerald-600" />
              <Label className="font-bold text-sm">Plano Profissional Solo (1 Profissional / 1 Acesso)</Label>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Individual</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Mensal (1 mês)</span>
              <span className="font-bold text-sm text-foreground">R$ 52,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-muted-foreground block">Total: R$ 52,00</span>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Trimestral (-10%)</span>
              <span className="font-bold text-sm text-foreground">R$ 48,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 144,00</span>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Anual (-25%)</span>
              <span className="font-bold text-sm text-foreground">R$ 40,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 480,00</span>
            </div>
          </div>
        </div>

        {/* Matriz Clínica */}
        <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <Label className="font-bold text-sm">Plano Clínica com Equipe (Colaboradores Ilimitados)</Label>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">Equipe</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Mensal (1 mês)</span>
              <span className="font-bold text-sm text-foreground">R$ 78,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-muted-foreground block">+R$ 13/acesso extra</span>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Trimestral (-10%)</span>
              <span className="font-bold text-sm text-foreground">R$ 72,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">+R$ 12/acesso extra</span>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <span className="text-muted-foreground block">Anual (-25%)</span>
              <span className="font-bold text-sm text-foreground">R$ 60,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">+R$ 10/acesso extra</span>
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
