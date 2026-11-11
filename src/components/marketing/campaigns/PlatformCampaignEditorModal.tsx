import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Calendar,
  DollarSign,
  Users,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  AffiliateCampaignConfig,
  DEFAULT_CAMPAIGN_CONFIG,
  DEFAULT_CAMPAIGN_RULES,
} from "./campaignTypes";
import { useAffiliateCampaignConfig } from "./useAffiliateCampaignConfig";

export interface PlatformCampaignEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: AffiliateCampaignConfig;
  onSave?: (newConfig: AffiliateCampaignConfig) => Promise<{ success: boolean; error?: unknown }>;
  onReset?: () => Promise<{ success: boolean; error?: unknown }>;
}

export function isoToDatetimeLocal(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export function datetimeLocalToIso(dtString: string): string {
  try {
    const d = new Date(dtString);
    if (isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export const PlatformCampaignEditorModal: React.FC<PlatformCampaignEditorModalProps> = ({
  open,
  onOpenChange,
  config: propConfig,
  onSave: propOnSave,
  onReset: propOnReset,
}) => {
  const hook = useAffiliateCampaignConfig();
  const activeSourceConfig = propConfig ?? hook.config;

  const [isActive, setIsActive] = useState<boolean>(activeSourceConfig.isActive);
  const [title, setTitle] = useState<string>(activeSourceConfig.title);
  const [description, setDescription] = useState<string>(activeSourceConfig.description);
  const [targetCount, setTargetCount] = useState<number>(activeSourceConfig.targetCount);
  const [bonusReais, setBonusReais] = useState<string>(
    String((activeSourceConfig.bonusValueCents || 0) / 100)
  );
  const [endDateLocal, setEndDateLocal] = useState<string>(
    isoToDatetimeLocal(activeSourceConfig.endDate)
  );
  const [badgeLabel, setBadgeLabel] = useState<string>(
    activeSourceConfig.badgeLabel ?? "Desafio Sazonal Ativo"
  );
  const [rules, setRules] = useState<string[]>(
    activeSourceConfig.rulesList && activeSourceConfig.rulesList.length > 0
      ? activeSourceConfig.rulesList
      : DEFAULT_CAMPAIGN_RULES
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sincroniza formulário sempre que abrir ou quando a configuração mudar
  useEffect(() => {
    if (open) {
      setIsActive(activeSourceConfig.isActive);
      setTitle(activeSourceConfig.title);
      setDescription(activeSourceConfig.description);
      setTargetCount(activeSourceConfig.targetCount);
      setBonusReais(String((activeSourceConfig.bonusValueCents || 0) / 100));
      setEndDateLocal(isoToDatetimeLocal(activeSourceConfig.endDate));
      setBadgeLabel(activeSourceConfig.badgeLabel ?? "Desafio Sazonal Ativo");
      setRules(
        activeSourceConfig.rulesList && activeSourceConfig.rulesList.length > 0
          ? activeSourceConfig.rulesList
          : DEFAULT_CAMPAIGN_RULES
      );
      setValidationError(null);
    }
  }, [open, activeSourceConfig]);

  const parsedBonusCents = useMemo(() => {
    const cleaned = bonusReais.replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) || num < 0 ? 0 : Math.round(num * 100);
  }, [bonusReais]);

  const formattedBonusPreview = useMemo(() => {
    return (parsedBonusCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, [parsedBonusCents]);

  const handleAddRule = useCallback(() => {
    setRules((prev) => [...prev, ""]);
  }, []);

  const handleUpdateRule = useCallback((index: number, val: string) => {
    setRules((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }, []);

  const handleRemoveRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRestoreDefaults = useCallback(() => {
    setIsActive(DEFAULT_CAMPAIGN_CONFIG.isActive);
    setTitle(DEFAULT_CAMPAIGN_CONFIG.title);
    setDescription(DEFAULT_CAMPAIGN_CONFIG.description);
    setTargetCount(DEFAULT_CAMPAIGN_CONFIG.targetCount);
    setBonusReais(String(DEFAULT_CAMPAIGN_CONFIG.bonusValueCents / 100));
    setEndDateLocal(isoToDatetimeLocal(DEFAULT_CAMPAIGN_CONFIG.endDate));
    setBadgeLabel(DEFAULT_CAMPAIGN_CONFIG.badgeLabel ?? "Desafio Sazonal Ativo");
    setRules(DEFAULT_CAMPAIGN_CONFIG.rulesList);
    setValidationError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("O título da campanha é obrigatório.");
      return;
    }

    if (targetCount < 1) {
      setValidationError("A meta deve ser de pelo menos 1 indicação.");
      return;
    }

    if (parsedBonusCents < 0) {
      setValidationError("O bônus não pode ser negativo.");
      return;
    }

    const cleanedRules = rules.map((r) => r.trim()).filter(Boolean);
    if (cleanedRules.length === 0) {
      setValidationError("Adicione ao menos uma regra ou condição para o desafio.");
      return;
    }

    const payload: AffiliateCampaignConfig = {
      isActive,
      title: title.trim(),
      description: description.trim(),
      targetCount: Math.max(1, Math.round(targetCount)),
      bonusValueCents: parsedBonusCents,
      endDate: datetimeLocalToIso(endDateLocal),
      badgeLabel: badgeLabel.trim() || undefined,
      rulesList: cleanedRules,
    };

    setIsSubmitting(true);
    try {
      if (propOnSave) {
        await propOnSave(payload);
      } else {
        await hook.saveConfig(payload);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl w-[95vw] max-w-full p-0 overflow-hidden flex flex-col max-h-[90dvh]"
        data-testid="platform-campaign-editor-modal"
      >
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                Editor Soberano de Metas & Campanhas
                {isActive ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                    Ativa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Inativa
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure os incentivos, bônus pontuais no Asaas e prazos do sprint para os afiliados.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
            {/* Erro de validação */}
            {validationError && (
              <div
                className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Switch de Ativação Soberana */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="campaign-active-switch" className="text-xs sm:text-sm font-semibold cursor-pointer">
                  Exibição da Campanha Sazonal Ativa
                </Label>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Quando desativada, o card de sprint é ocultado do portal dos afiliados e recolhido no backoffice.
                </p>
              </div>
              <Switch
                id="campaign-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="campaign-active-switch"
                className="min-h-[24px] min-w-[44px] touch-manipulation shrink-0"
              />
            </div>

            {/* Título & Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="campaign-title-input" className="text-xs font-semibold">
                  Título da Campanha / Desafio *
                </Label>
                <Input
                  id="campaign-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: 🏆 Sprint do Mês da Fisioterapia"
                  className="h-10 text-xs sm:text-sm"
                  data-testid="campaign-title-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campaign-badge-input" className="text-xs font-semibold">
                  Texto do Badge
                </Label>
                <Input
                  id="campaign-badge-input"
                  value={badgeLabel}
                  onChange={(e) => setBadgeLabel(e.target.value)}
                  placeholder="Desafio Sazonal Ativo"
                  className="h-10 text-xs sm:text-sm"
                  data-testid="campaign-badge-input"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="campaign-desc-input" className="text-xs font-semibold">
                Descrição & Chamada Motivacional
              </Label>
              <Textarea
                id="campaign-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Explique o objetivo e o ganho financeiro para incentivar os parceiros..."
                className="text-xs sm:text-sm resize-none"
                data-testid="campaign-desc-input"
              />
            </div>

            {/* Linha de Métricas: Meta de Clínicas, Bônus R$ e Data de Término */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Meta */}
              <div className="space-y-1.5">
                <Label htmlFor="campaign-target-input" className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Meta (Nº de Clínicas) *
                </Label>
                <Input
                  id="campaign-target-input"
                  type="number"
                  min={1}
                  step={1}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-10 text-xs sm:text-sm"
                  data-testid="campaign-target-input"
                  required
                />
              </div>

              {/* Bônus R$ */}
              <div className="space-y-1.5">
                <Label htmlFor="campaign-bonus-input" className="text-xs font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  Bônus Pontual (R$) *
                </Label>
                <Input
                  id="campaign-bonus-input"
                  type="text"
                  value={bonusReais}
                  onChange={(e) => setBonusReais(e.target.value)}
                  placeholder="300"
                  className="h-10 text-xs sm:text-sm"
                  data-testid="campaign-bonus-input"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Prévia: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formattedBonusPreview}</span>
                </p>
              </div>

              {/* Data Limite */}
              <div className="space-y-1.5">
                <Label htmlFor="campaign-enddate-input" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  Término do Desafio *
                </Label>
                <Input
                  id="campaign-enddate-input"
                  type="datetime-local"
                  value={endDateLocal}
                  onChange={(e) => setEndDateLocal(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                  data-testid="campaign-enddate-input"
                  required
                />
              </div>
            </div>

            {/* Lista Dinâmica de Regras & Condições */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Regras & Condições Oficiais do Desafio
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Exibidas no popup explicativo que o afiliado consulta ao clicar em &ldquo;Regras do Desafio&rdquo;.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRule}
                  className="h-8 text-xs gap-1 min-h-[36px] touch-manipulation border-primary/30 text-primary hover:bg-primary/5"
                  data-testid="campaign-add-rule-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Regra
                </Button>
              </div>

              <div className="space-y-2" data-testid="campaign-rules-list">
                {rules.map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex items-center justify-center h-9 w-6 shrink-0 text-xs font-bold text-muted-foreground">
                      {idx + 1}.
                    </div>
                    <Textarea
                      rows={2}
                      value={rule}
                      onChange={(e) => handleUpdateRule(idx, e.target.value)}
                      placeholder={`Condição ${idx + 1}...`}
                      className="text-xs resize-none flex-1"
                      data-testid={`campaign-rule-input-${idx}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRule(idx)}
                      disabled={rules.length <= 1}
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[44px] min-w-[44px] touch-manipulation"
                      aria-label={`Remover regra ${idx + 1}`}
                      data-testid={`campaign-remove-rule-btn-${idx}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-muted/20 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestoreDefaults}
              disabled={isSubmitting}
              className="text-xs h-10 min-h-[44px] gap-1.5 text-muted-foreground hover:text-foreground touch-manipulation"
              data-testid="campaign-restore-defaults-btn"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Padrões
            </Button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs h-10 min-h-[44px] touch-manipulation"
                data-testid="campaign-cancel-btn"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs h-10 min-h-[44px] font-semibold gap-1.5 touch-manipulation shadow-xs"
                data-testid="campaign-save-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gravando Configurações...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Salvar Campanha
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
