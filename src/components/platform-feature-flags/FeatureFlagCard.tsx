import React from "react";
import { FeatureFlagDefinition } from "@/lib/feature-flags-catalog";
import { FlagSourceInfo } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RotateCcw, Loader2, Settings, RefreshCw, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureFlagCardProps {
  feature: FeatureFlagDefinition;
  isOn: boolean;
  isModified: boolean;
  contextType: "global" | "tag" | "clinic";
  flagSource?: FlagSourceInfo;
  pendingRawFlags: Record<string, unknown>;
  resettingKey: string | null;
  onToggleDraft: (key: string) => void;
  onResetOverride: (key: string) => Promise<void>;
  onOpenTermsModal: () => void;
  onPublishTermsVersion: () => Promise<void>;
  onOpenConfigModal: (key: string) => void;
  onOpenJustificationModal: (key: string) => void;
}

export const FeatureFlagCard: React.FC<FeatureFlagCardProps> = ({
  feature,
  isOn,
  isModified,
  contextType,
  flagSource,
  pendingRawFlags,
  resettingKey,
  onToggleDraft,
  onResetOverride,
  onOpenTermsModal,
  onPublishTermsVersion,
  onOpenConfigModal,
  onOpenJustificationModal,
}) => {
  return (
    <div 
      className={cn(
        "flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-xl border transition-colors",
        isModified
          ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800"
          : "border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base">{feature.label}</h3>
          
          {typeof feature.completionPercentage === "number" && (
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700">
              <span className={cn(
                "font-semibold",
                feature.completionPercentage === 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : feature.completionPercentage > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-neutral-500"
              )}>
                {feature.completionPercentage}%
              </span>
              <div className="w-16 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    feature.completionPercentage === 100
                      ? "bg-emerald-500"
                      : feature.completionPercentage > 40
                      ? "bg-sky-500"
                      : feature.completionPercentage > 0
                      ? "bg-amber-500"
                      : "bg-transparent"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, feature.completionPercentage))}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {feature.completionPercentage === 100 ? "Concluído" : feature.completionPercentage > 0 ? "Em Progresso" : "Não Iniciado"}
              </span>
            </div>
          )}

          {feature.key === "terms_of_service_management" && (
            <>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {[
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.owner_br,
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.user_br,
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.owner_intl,
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.user_intl,
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.print_terms,
                  (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.minor_terms ||
                    (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.minor_consent,
                ].filter(Boolean).length}/6 docs customizados
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-300">
                {(pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.minor_terms ||
                (pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined)?.minor_consent
                  ? "Menor LGPD: Customizado"
                  : "Menor LGPD: Padrão Ativo"}
              </Badge>
            </>
          )}

          {isModified && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono">
              Alterado (Pendente)
            </Badge>
          )}

          {contextType !== "global" && flagSource && (
            <>
              {flagSource.type === "clinic" ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                  Sobrescrito nesta Clínica
                </Badge>
              ) : flagSource.type === "tag" ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 text-[10px]">
                  {flagSource.label}
                </Badge>
              ) : flagSource.type === "global" ? (
                <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 text-[10px]">
                  Herdado do Global
                </Badge>
              ) : (
                <Badge variant="outline" className="text-neutral-500 text-[10px]">
                  Padrão
                </Badge>
              )}
            </>
          )}
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          {feature.description}
        </p>
      </div>
      
      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
        {contextType !== "global" && flagSource?.type === "clinic" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={resettingKey === feature.key}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => void onResetOverride(feature.key)}
            title="Restaurar herança padrão (remover sobrescrita da clínica)"
          >
            {resettingKey === feature.key ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Restaurar Herança</span>
          </Button>
        )}

        {feature.key === "terms_of_service_management" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={onOpenTermsModal}
            >
              <Settings className="w-3.5 h-3.5 mr-2" /> Configurar Termos
            </Button>

            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => void onPublishTermsVersion()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Atualizar Versão
            </Button>
          </>
        ) : (
          <>
            {feature.hasConfiguration && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 px-3"
                onClick={() => onOpenConfigModal(feature.key)}
              >
                <Settings className="w-3.5 h-3.5 mr-2" /> Configurar
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-2 text-neutral-500 hover:text-primary"
              onClick={() => onOpenJustificationModal(feature.key)}
              title="Auditoria Avançada / Justificativa"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>

            {feature.hasToggle !== false && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                  isOn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                )}>
                  {isOn ? 'On' : 'Off'}
                </span>
                <Switch 
                  checked={isOn} 
                  onCheckedChange={() => onToggleDraft(feature.key)} 
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
