import React from "react";
import { Sparkles, ArrowUpRight, Users, CalendarCheck, FileSpreadsheet, ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";

interface FreeTrialUsageBannerProps {
  clinicId?: string | null;
}

export function FreeTrialUsageBanner({ clinicId }: FreeTrialUsageBannerProps) {
  const navigate = useNavigate();
  const quota = useClinicPlanQuota(clinicId);

  if (quota.loading || !quota.isFreeTrial || !clinicId || quota.isTrialExpired || quota.isExpired) {
    return null;
  }

  const isLimitClose =
    quota.attendances.remaining <= 3 ||
    quota.patients.remaining <= 1 ||
    quota.attendances.isLimitReached ||
    quota.patients.isLimitReached;

  const isUrgent24h = quota.hoursRemaining !== null && quota.hoursRemaining <= 24 && quota.hoursRemaining > 0;
  const isUrgent2Days = (quota.daysRemaining !== null && quota.daysRemaining <= 2) || isUrgent24h;

  const isCriticalWarning = isUrgent2Days || isLimitClose;

  const timeWarningMessage = isUrgent24h
    ? `Resta menos de ${Math.max(1, quota.hoursRemaining!)}h de teste gratuito`
    : quota.daysRemaining !== null && quota.daysRemaining <= 2
    ? `Restam apenas ${quota.daysRemaining} dia${quota.daysRemaining === 1 ? "" : "s"} de teste gratuito`
    : null;

  return (
    <div
      role="alert"
      className={`w-full py-2.5 px-4 border-b text-xs flex flex-col md:flex-row items-center justify-between gap-3 transition-colors ${
        isUrgent2Days
          ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
          : isLimitClose
          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
          : "bg-blue-500/10 border-blue-500/20 text-neutral-300"
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          variant="outline"
          className={`font-semibold text-[10px] px-2 py-0.5 uppercase tracking-wider flex items-center gap-1 shrink-0 ${
            isUrgent2Days
              ? "border-amber-500/50 text-amber-300 bg-amber-500/20 animate-pulse"
              : isLimitClose
              ? "border-amber-500/40 text-amber-400 bg-amber-500/20"
              : "border-blue-500/40 text-blue-400 bg-blue-500/20"
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Teste Gratuito (7 Dias)
        </Badge>

        {/* Atendimentos - Limite de 20 atendimentos no teste gratuito */}
        <div className="flex items-center gap-1.5" title="Limite de 20 atendimentos no teste gratuito">
          <CalendarCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>
            Atendimentos:{" "}
            <strong className={quota.attendances.isLimitReached ? "text-red-400" : "text-white"}>
              {quota.attendances.current}/{quota.attendances.max}
            </strong>
            <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">(máx. 20)</span>
          </span>
        </div>

        <span className="text-neutral-600 hidden sm:inline">•</span>

        {/* Pacientes */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Pacientes:{" "}
            <strong className={quota.patients.isLimitReached ? "text-red-400" : "text-white"}>
              {quota.patients.current}/{quota.patients.max}
            </strong>
          </span>
        </div>

        <span className="text-neutral-600 hidden sm:inline">•</span>

        {/* Formulários */}
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>
            Formulários Ativos:{" "}
            <strong className={quota.forms.isLimitReached ? "text-amber-400" : "text-white"}>
              {quota.forms.current}/{quota.forms.max}
            </strong>
          </span>
        </div>

        {/* Aviso de proximidade do fim do prazo de 7 dias ou de cotas */}
        {timeWarningMessage ? (
          <span className="text-amber-400 font-semibold flex items-center gap-1 text-xs">
            <Clock className="w-3.5 h-3.5 shrink-0 animate-bounce" />
            {timeWarningMessage} — escolha seu plano antes do bloqueio em modo leitura!
          </span>
        ) : isLimitClose ? (
          <span className="text-amber-400 font-medium hidden lg:inline flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Limite próximo do fim
          </span>
        ) : null}
      </div>

      <Button
        size="sm"
        onClick={() => navigate(clinicId ? `/planos?clinicId=${clinicId}` : "/planos")}
        className={`h-7 px-3 text-xs font-semibold rounded-lg shrink-0 shadow-md flex items-center gap-1 transition-all ${
          isUrgent2Days
            ? "bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold hover:scale-[1.02]"
            : isCriticalWarning
            ? "bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        <span>
          {isUrgent2Days ? "Escolher Plano Antes do Bloqueio" : "Ativar Plano Ilimitado"}
        </span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
