import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { SettingsLayout } from "./SettingsLayout";
import { ClinicProfileSection } from "./sections/ClinicProfileSection";
import { ClinicTeamSection } from "./sections/ClinicTeamSection";
import { ClinicSecuritySection } from "./sections/ClinicSecuritySection";
import { ClinicBillingSection } from "./sections/ClinicBillingSection";
import { ClinicTreasurySection } from "./sections/ClinicTreasurySection";
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
  ClinicTreasurySection,
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

  const basePath = clinicKey ? `/clinica/${clinicKey}/configuracoes` : "/configuracoes";

  // Mapeamento de compatibilidade de URLs antigas ?secao=...
  if (secao === "clinic" || secao === "profile") {
    return <Navigate to={`${basePath}/perfil`} replace />;
  }
  if (secao === "team" || secao === "colaboradores") {
    return <Navigate to={`${basePath}/equipe`} replace />;
  }
  if (secao === "clinic-security" || secao === "security") {
    return <Navigate to={`${basePath}/seguranca`} replace />;
  }
  if (secao === "billing") {
    return <Navigate to={`${basePath}/assinatura`} replace />;
  }
  if (secao === "treasury") {
    return <Navigate to={`${basePath}/tesouraria`} replace />;
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
  if (secao === "support") {
    return <Navigate to={`${basePath}/suporte`} replace />;
  }

  return <Navigate to={`${basePath}/perfil`} replace />;
};
