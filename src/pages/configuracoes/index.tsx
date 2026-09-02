import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { SettingsLayout } from "./SettingsLayout";
import { ClinicProfileSection } from "./sections/ClinicProfileSection";
import { ClinicTeamSection } from "./sections/ClinicTeamSection";
import { ClinicSecuritySection } from "./sections/ClinicSecuritySection";
import { ClinicBillingSection } from "./sections/ClinicBillingSection";
import { ClinicFormsSection } from "./sections/ClinicFormsSection";
import { PersonalProfileSection } from "./sections/PersonalProfileSection";
import { PersonalSecuritySection } from "./sections/PersonalSecuritySection";
import { PersonalNotificationsSection } from "./sections/PersonalNotificationsSection";
import { SupportSection } from "./sections/SupportSection";

export {
  SettingsLayout,
  ClinicProfileSection,
  ClinicTeamSection,
  ClinicSecuritySection,
  ClinicBillingSection,
  ClinicFormsSection,
  PersonalProfileSection,
  PersonalSecuritySection,
  PersonalNotificationsSection,
  SupportSection,
};

export const ConfiguracoesLegacyRedirect = () => {
  const { clinicKey } = useParams<{ clinicKey: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const secao = searchParams.get("secao");
  const origem = searchParams.get("origem");

  const basePath = clinicKey ? `/clinica/${clinicKey}/configuracoes` : "/configuracoes";

  // Se a origem é pessoal ou rota pessoal explícita
  if (origem === "pessoal" || secao === "personal" || secao === "personal-profile" || secao === "pessoal-perfil") {
    if (secao === "personal-security" || secao === "security") {
      return <Navigate to={`${basePath}/pessoal/seguranca`} replace />;
    }
    if (secao === "personal-notifications" || secao === "notifications") {
      return <Navigate to={`${basePath}/pessoal/notificacoes`} replace />;
    }
    return <Navigate to={`${basePath}/pessoal/perfil`} replace />;
  }

  // Mapeamento de compatibilidade de URLs antigas ?secao=...
  if (secao === "clinic") {
    return <Navigate to={`${basePath}/perfil`} replace />;
  }
  if (secao === "profile") {
    // Se estiver no escopo pessoal ou legado sem clinicKey, redireciona para perfil pessoal
    return <Navigate to={clinicKey ? `${basePath}/perfil` : `${basePath}/pessoal/perfil`} replace />;
  }
  if (secao === "team" || secao === "colaboradores") {
    return <Navigate to={`${basePath}/equipe`} replace />;
  }
  if (secao === "clinic-security") {
    return <Navigate to={`${basePath}/seguranca`} replace />;
  }
  if (secao === "security") {
    return <Navigate to={clinicKey ? `${basePath}/seguranca` : `${basePath}/pessoal/seguranca`} replace />;
  }
  if (secao === "billing") {
    return <Navigate to={`${basePath}/assinatura`} replace />;
  }
  if (secao === "treasury") {
    return <Navigate to={`${basePath}/perfil`} replace />;
  }
  if (secao === "forms") {
    return <Navigate to={`${basePath}/formularios`} replace />;
  }
  if (secao === "personal-security") {
    return <Navigate to={`${basePath}/pessoal/seguranca`} replace />;
  }
  if (secao === "personal-notifications" || secao === "notifications") {
    return <Navigate to={`${basePath}/pessoal/notificacoes`} replace />;
  }
  if (secao === "suporte" || secao === "support") {
    return <Navigate to={`${basePath}/suporte`} replace />;
  }

  return <Navigate to={clinicKey ? `${basePath}/perfil` : `${basePath}/pessoal/perfil`} replace />;
};
