import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { featureFlagsCatalog } from "@/lib/feature-flags-catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { HelpersConfigModal } from "@/components/tutorial/HelpersConfigModal";
import { FormEditorConfigModal } from "@/components/forms/FormEditorConfigModal";
import {
  type FeatureConfigModalProps,
  StorageConfigForm,
  NotificationsConfigForm,
  DashboardsConfigForm,
  FormsConfigForm,
  MedicalRecordConfigForm,
  UIExperienceConfigForm,
  ClinicalPortfolioConfigForm,
  SubscriptionsConfigForm,
  AntiPrintConfigForm,
  WhatsAppNotificationsConfigForm,
  AgendaConfigForm,
} from "./feature-config-modal";

export type { FeatureConfigModalProps };

export function FeatureConfigModal({ 
  featureKey, 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  scope = "global", 
  tagId, 
  clinicId 
}: FeatureConfigModalProps) {
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

  const renderFormContent = () => {
    // Novas Flags de Notificações
    if (
      feature.key === "whatsapp_flows_enabled" ||
      feature.key === "notifications_whatsapp_onboarding" ||
      feature.key === "notifications_whatsapp_transbordo" ||
      feature.key === "notifications_whatsapp_billing" ||
      feature.key === "notifications_telegram_admin" ||
      feature.key === "notifications_patient_reminders"
    ) {
      return <WhatsAppNotificationsConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    // Novas Flags de Agenda
    if (
      feature.key === "agenda_master_onboarding" ||
      feature.key === "agenda_whatsapp_booking_flow" ||
      feature.key === "agenda_google_calendar_sync" ||
      feature.key === "agenda_smart_blocks_buffers"
    ) {
      return <AgendaConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.key === "anti_print_protection") {
      return <AntiPrintConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Assinaturas") {
      return <SubscriptionsConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Storage/Arquivos") {
      return <StorageConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Notificações") {
      return <NotificationsConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Dashboards") {
      return <DashboardsConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Formulários") {
      return <FormsConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Prontuário/Atendimentos") {
      return <MedicalRecordConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.key === "clinical_portfolio_enabled") {
      return <ClinicalPortfolioConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "Agenda") {
      return <AgendaConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }

    if (feature.category === "UI/Experiência") {
      return <UIExperienceConfigForm formData={formData} setFormData={setFormData} feature={feature} />;
    }
    
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
