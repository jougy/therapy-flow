import React from "react";
import { Lock, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";

export interface TrialReadOnlyBannerProps {
  /** Identificador único da clínica ativa (UUID). */
  clinicId?: string | null;
  /** Callback opcional acionado ao clicar em upgrade para abrir modal contextual. Se omitido, navega para `/planos`. */
  onOpenUpgradeModal?: () => void;
}

/**
 * Banner Global Informativo de Modo Somente Leitura (Strict Read-Only Mode).
 *
 * Racional de Negócio & Salvaguarda Ética:
 * 1. Conformidade Regulamentar (CFM / CFP / LGPD):
 *    - Quando uma degustação atinge os limites volumétricos (20 atendimentos ou 5 pacientes)
 *      ou o prazo de 7 dias expira, a plataforma NÃO exclui dados clínicos nem bloqueia o acesso
 *      aos registros existentes.
 *    - Resolução CFM nº 1.821/2007: O prontuário médico deve ser preservado por no mínimo 20 anos.
 *    - Art. 16, inciso I da LGPD: Permite a conservação de dados para cumprimento de obrigação legal.
 * 2. Experiência de Usuário Não Punitiva:
 *    - Os profissionais conseguem consultar prontuários, evoluções e fichas de pacientes sem fricção,
 *      mas são informados de forma clara e amigável sobre a necessidade de assinar um plano
 *      pago para realizar novos registros clínicos.
 *
 * Complexidade Assintótica:
 * - Tempo: O(1)
 * - Espaço: O(1)
 */
export const TrialReadOnlyBanner: React.FC<TrialReadOnlyBannerProps> = React.memo(({
  clinicId,
  onOpenUpgradeModal,
}) => {
  const navigate = useNavigate();
  const quota = useClinicPlanQuota(clinicId);

  // Não renderiza nada se o hook estiver carregando ou não houver clínica definida
  if (quota.loading || !clinicId) {
    return null;
  }

  const isTrialExpired =
    quota.isTrialExpired ||
    quota.subscriptionStatus === "TRIAL_EXPIRED" ||
    (quota.isFreeTrial && (quota.attendances.isLimitReached || quota.patients.isLimitReached));

  const isGenericExpired = quota.isExpired || quota.subscriptionStatus === "EXPIRED";

  if (!isTrialExpired && !isGenericExpired) {
    return null;
  }

  const handleUpgradeClick = () => {
    if (onOpenUpgradeModal) {
      onOpenUpgradeModal();
    } else {
      navigate(clinicId ? `/planos?clinicId=${clinicId}` : "/planos");
    }
  };

  return (
    <div 
      role="alert"
      className="w-full py-2.5 px-4 bg-red-500/15 border-b border-red-500/30 text-red-200 text-xs flex flex-col md:flex-row items-center justify-between gap-3 transition-all z-30 shadow-xs backdrop-blur-md"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <Badge
          variant="outline"
          className="border-red-500/40 text-red-400 bg-red-500/20 font-bold text-[10px] px-2.5 py-0.5 uppercase tracking-wider flex items-center gap-1.5 shrink-0"
        >
          <Lock className="w-3 h-3 text-red-400" />
          Modo Leitura
        </Badge>
        
        <div className="flex items-center gap-1.5 text-foreground dark:text-neutral-200">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 hidden sm:inline" />
          <span>
            {isTrialExpired ? (
              <>
                <strong>Período de teste degustação encerrado.</strong> Seu espaço está no modo somente leitura. Todos os prontuários e pacientes continuam salvos e acessíveis.
              </>
            ) : (
              <>
                <strong>Assinatura expirada.</strong> O espaço está operando em modo somente leitura até a confirmação do pagamento.
              </>
            )}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleUpgradeClick}
        className="h-8 px-3.5 text-xs font-bold rounded-lg shrink-0 shadow-md flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white min-h-[32px] transition-transform active:scale-95"
      >
        <span>Assinar Plano / Reativar Escrita</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
});

TrialReadOnlyBanner.displayName = "TrialReadOnlyBanner";

export default TrialReadOnlyBanner;
