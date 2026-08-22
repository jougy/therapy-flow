import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformDirectoryPage } from "@/pages/platform/PlatformDirectoryPage";
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
import { readStoredPlatformClinicKey } from "@/components/platform/platform-api";

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

const PlatformAdmin = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="diretorio" replace />} />
      <Route
        path="diretorio"
        element={
          <PlatformLayout>
            <PlatformDirectoryPage />
          </PlatformLayout>
        }
      />
      <Route
        path="formularios"
        element={
          <PlatformLayout title="Biblioteca de Formulários" subtitle="Moderação global, controle de destaques editoriais e gestão de modelos da comunidade">
            <PlatformFormLibraryManager />
          </PlatformLayout>
        }
      />
      <Route
        path="formularios/:templateId"
        element={
          <PlatformLayout title="Detalhes do Modelo" subtitle="Visualização detalhada, moderação e comentários do formulário" showNav={false}>
            <FormTemplateDetailPage />
          </PlatformLayout>
        }
      />
      <Route
        path="feedbacks"
        element={
          <PlatformLayout title="Feedbacks & Avaliações" subtitle="Gestão centralizada de avaliações, feedbacks e NPS da plataforma">
            <PlatformFeedbacksManager />
          </PlatformLayout>
        }
      />
      <Route
        path="novidades"
        element={
          <PlatformLayout title="Notas de Novidades" subtitle="Publicação e gerenciamento do changelog e atualizações para as clínicas">
            <PlatformReleaseNotesManager standalone />
          </PlatformLayout>
        }
      />
      <Route
        path="tags"
        element={
          <PlatformLayout title="Gestão de Tags" subtitle="Criação e padronização de tags para organização e filtragem de clínicas">
            <PlatformClinicTags />
          </PlatformLayout>
        }
      />
      <Route
        path="flags"
        element={
          <PlatformLayout title="Feature Flags Globais" subtitle="Controle de ativação e rollout de funcionalidades em tempo real">
            <PlatformFeatureFlags />
          </PlatformLayout>
        }
      />
      <Route
        path="governanca"
        element={
          <PlatformLayout title="Governança & Segurança" subtitle="Políticas globais de segurança, auditoria e controles administrativos">
            <PlatformGovernanceSettings />
          </PlatformLayout>
        }
      />
      <Route
        path="faturamento"
        element={
          <PlatformLayout title="Faturamento & Webhooks" subtitle="Gestão master de cobranças, assinaturas Asaas e webhooks">
            <PlatformBillingMaster />
          </PlatformLayout>
        }
      />
      <Route path="clinicas/:clinicId" element={<ClinicDetailRoute />} />
      <Route path="usuarios/:userId" element={<PersonDetailRoute itemType="account" />} />
      <Route path="pacientes/:patientId" element={<PersonDetailRoute itemType="patient" />} />
      <Route path="*" element={<Navigate to="diretorio" replace />} />
    </Routes>
  );
};

export default PlatformAdmin;
