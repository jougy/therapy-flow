import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformDirectoryPage } from "@/pages/platform/PlatformDirectoryPage";
import { PlatformMarketingPage } from "@/pages/platform/PlatformMarketingPage";
import { PlatformClinicDetailPage } from "@/pages/platform/PlatformClinicDetailPage";
import { PlatformPersonDetailPage } from "@/pages/platform/PlatformPersonDetailPage";
import { PlatformFeedbacksManager } from "@/components/PlatformFeedbacksManager";
import { PlatformFormLibraryManager } from "@/components/PlatformFormLibraryManager";
import { FormTemplateDetailPage } from "@/pages/FormTemplateDetailPage";
import { PlatformReleaseNotesManager } from "@/components/PlatformReleaseNotesManager";
import { PlatformClinicTags } from "@/components/PlatformClinicTags";
import { PlatformFeatureFlags } from "@/components/PlatformFeatureFlags";
import { PlatformGovernanceSettings } from "@/components/PlatformGovernanceSettings";
import { PlatformBillingMaster } from "@/components/PlatformBillingMaster";
import { PlatformErrorsLogsPage } from "@/pages/platform/PlatformErrorsLogsPage";
import { PlatformAgendaMaster } from "@/pages/platform/PlatformAgendaMaster";
import FormularioEditor from "@/pages/FormularioEditor";
import { readStoredPlatformClinicKey } from "@/components/platform/platform-api";
import { useAuth } from "@/hooks/useAuth";
import {
  checkPlatformFlagFromAuth,
  getFirstAllowedPlatformPath,
  type PlatformFeatureFlagKey,
} from "@/lib/platform-feature-flags";

const ClinicDetailRoute = () => {
  const { clinicId } = useParams();
  const location = useLocation();
  const locationState = location.state as { clinicKey?: string } | null;
  const clinicKey =
    clinicId === "detalhes"
      ? locationState?.clinicKey || readStoredPlatformClinicKey()
      : clinicId;

  if (!clinicKey) {
    return <Navigate to="/platform/diretorio" replace />;
  }

  return (
    <PlatformLayout title="Detalhes da Clínica" subtitle="Administração master da clínica" showNav={false}>
      <PlatformClinicDetailPage clinicKey={clinicKey} shouldMaskUrl={clinicId !== "detalhes"} />
    </PlatformLayout>
  );
};

const PersonDetailRoute = ({ itemType }: { itemType: "account" | "patient" }) => {
  const params = useParams();
  const itemId = params.userId || params.patientId || params["*"]?.split("/")[0];

  if (!itemId) {
    return <Navigate to="/platform/diretorio" replace />;
  }

  const title = itemType === "account" ? "Detalhe do Usuário" : "Detalhe do Paciente";
  const subtitle = itemType === "account" ? "Administração master da conta de usuário" : "Administração master do paciente";

  return (
    <PlatformLayout title={title} subtitle={subtitle} showNav={false}>
      <PlatformPersonDetailPage itemType={itemType} itemId={itemId} />
    </PlatformLayout>
  );
};

const RequirePlatformFlag = ({
  flag,
  fallbackPath,
  children,
}: {
  flag: PlatformFeatureFlagKey;
  fallbackPath: string;
  children: ReactNode;
}) => {
  const auth = useAuth();
  if (!checkPlatformFlagFromAuth(auth, flag)) {
    return <Navigate to={fallbackPath} replace />;
  }
  return <>{children}</>;
};

const PlatformAdmin = () => {
  const auth = useAuth();
  const firstAllowedPath = getFirstAllowedPlatformPath(auth);
  const wrapFlag = (flag: PlatformFeatureFlagKey, element: ReactNode) => (
    <RequirePlatformFlag flag={flag} fallbackPath={firstAllowedPath}>
      {element}
    </RequirePlatformFlag>
  );

  return (
    <Routes>
      <Route index element={<Navigate to={firstAllowedPath} replace />} />
      <Route
        path="diretorio"
        element={wrapFlag(
          "directory",
          <PlatformLayout>
            <PlatformDirectoryPage />
          </PlatformLayout>
        )}
      />
      <Route
        path="marketing"
        element={wrapFlag(
          "marketing",
          <PlatformLayout
            title="Marketing & Auto-Lead"
            subtitle="Gestão de afiliados, captura automática de leads (Apify + Lindy AI) e integração tripla de agendas"
          >
            <PlatformMarketingPage />
          </PlatformLayout>
        )}
      />
      <Route
        path="afiliados"
        element={wrapFlag(
          "marketing",
          <PlatformLayout
            title="Marketing & Auto-Lead"
            subtitle="Gestão de afiliados, captura automática de leads (Apify + Lindy AI) e integração tripla de agendas"
          >
            <PlatformMarketingPage />
          </PlatformLayout>
        )}
      />
      <Route
        path="agenda"
        element={wrapFlag(
          "agenda",
          <PlatformLayout
            title="Agenda Master"
            subtitle="Gestão centralizada de reuniões de onboarding, demonstrações e chamadas com clínicas"
          >
            <PlatformAgendaMaster />
          </PlatformLayout>
        )}
      />
      <Route
        path="formularios"
        element={wrapFlag(
          "forms",
          <PlatformLayout title="Biblioteca de Formulários" subtitle="Moderação global, controle de destaques editoriais e gestão de modelos da comunidade">
            <PlatformFormLibraryManager />
          </PlatformLayout>
        )}
      />
      <Route
        path="formularios/editor/:templateId"
        element={wrapFlag("forms", <FormularioEditor />)}
      />
      <Route
        path="formularios/:templateId"
        element={wrapFlag(
          "forms",
          <PlatformLayout title="Detalhes do Modelo" subtitle="Visualização detalhada, moderação e comentários do formulário" showNav={false}>
            <FormTemplateDetailPage />
          </PlatformLayout>
        )}
      />
      <Route
        path="feedbacks"
        element={wrapFlag(
          "feedbacks",
          <PlatformLayout title="Feedbacks & Avaliações" subtitle="Gestão centralizada de avaliações, feedbacks e NPS da plataforma">
            <PlatformFeedbacksManager />
          </PlatformLayout>
        )}
      />
      <Route
        path="novidades"
        element={wrapFlag(
          "releases",
          <PlatformLayout title="Notas de Novidades" subtitle="Publicação e gerenciamento do changelog e atualizações para as clínicas">
            <PlatformReleaseNotesManager standalone />
          </PlatformLayout>
        )}
      />
      <Route
        path="tags"
        element={wrapFlag(
          "tags",
          <PlatformLayout title="Gestão de Tags" subtitle="Criação e padronização de tags para organização e filtragem de clínicas">
            <PlatformClinicTags />
          </PlatformLayout>
        )}
      />
      <Route
        path="flags"
        element={wrapFlag(
          "feature_flags",
          <PlatformLayout title="Feature Flags Globais" subtitle="Controle de ativação e rollout de funcionalidades em tempo real">
            <PlatformFeatureFlags />
          </PlatformLayout>
        )}
      />
      <Route
        path="governanca"
        element={wrapFlag(
          "governance",
          <PlatformLayout title="Governança & Segurança" subtitle="Políticas globais de segurança, auditoria e controles administrativos">
            <PlatformGovernanceSettings />
          </PlatformLayout>
        )}
      />
      <Route
        path="faturamento"
        element={wrapFlag(
          "billing",
          <PlatformLayout title="Faturamento & Webhooks" subtitle="Gestão master de cobranças, assinaturas Asaas e webhooks">
            <PlatformBillingMaster />
          </PlatformLayout>
        )}
      />
      <Route
        path="erros-logs"
        element={wrapFlag(
          "logs",
          <PlatformLayout
            title="Erros & Logs de Diagnóstico"
            subtitle="Monitoramento em tempo real de falhas de runtime, alertas do sistema e auditoria de erros"
          >
            <PlatformErrorsLogsPage />
          </PlatformLayout>
        )}
      />
      <Route path="clinicas/:clinicId" element={wrapFlag("directory", <ClinicDetailRoute />)} />
      <Route path="usuarios/:userId" element={wrapFlag("directory", <PersonDetailRoute itemType="account" />)} />
      <Route path="pacientes/:patientId" element={wrapFlag("directory", <PersonDetailRoute itemType="patient" />)} />
      <Route path="*" element={<Navigate to={firstAllowedPath} replace />} />
    </Routes>
  );
};

export default PlatformAdmin;
