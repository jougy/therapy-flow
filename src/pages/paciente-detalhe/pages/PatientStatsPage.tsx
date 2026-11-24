import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useAuth } from "@/hooks/useAuth";
import { PatientAnamnesisDashboardContent } from "@/pages/PacienteAnamnesisDashboard";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientStatsPage: FC = () => {
  const ws = usePatientWorkspace();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();

  if (!ws.patient) return null;

  if (!isFeatureEnabled("dashboards_patient")) {
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-dashed p-8 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Estatísticas indisponíveis</p>
        <p className="mt-1 text-xs text-muted-foreground">O painel de estatísticas do paciente não está habilitado no plano atual.</p>
      </div>
    );
  }

  const canPrintStats = can("system.print") && isFeatureEnabled("print_general");

  return (
    <div className="w-full max-w-full min-w-0 space-y-4">
      {ws.canManageForms && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canPrintStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => ws.setShowDashboardPrintModal(true)}
              className="gap-2 text-xs border-primary/40 text-primary hover:bg-primary/5 min-h-[36px]"
            >
              <Printer className="h-4 w-4" />
              Imprimir Estatísticas
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${ws.clinicHomePath}/configuracoes?secao=forms`)}
            className="gap-2 text-xs min-h-[36px]"
          >
            <ClipboardList className="h-4 w-4 text-primary" />
            Gerenciar Formulários
          </Button>
        </div>
      )}

      <PatientAnamnesisDashboardContent
        chartPreferences={ws.dashboardChartPreferences}
        dashboard={ws.anamnesisDashboard}
        onChartChange={ws.handleDashboardChartChange}
        onPrintRequest={canPrintStats ? () => ws.setShowDashboardPrintModal(true) : undefined}
        onSelectedTemplateIdChange={ws.setDashboardTemplateFilter}
        selectedTemplateId={ws.dashboardTemplateFilter}
      />
    </div>
  );
};

export default PatientStatsPage;
