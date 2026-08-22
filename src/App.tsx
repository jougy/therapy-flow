import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/query-client";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Loader2 } from "lucide-react";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";


const Auth = lazy(() => import("./pages/Auth"));
const CadastroCompleto = lazy(() => import("./pages/CadastroCompleto"));
const CadastroContaAlfa = lazy(() => import("./pages/CadastroContaAlfa"));
const CadastroPacienteCompartilhado = lazy(() => import("./pages/CadastroPacienteCompartilhado"));
const ClinicDashboard = lazy(() => import("./pages/ClinicDashboard"));
import {
  SettingsLayout,
  ConfiguracoesLegacyRedirect,
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
} from "./pages/configuracoes/index";
const ContaConfirmada = lazy(() => import("./pages/ContaConfirmada"));
const ConviteClinica = lazy(() => import("./pages/ConviteClinica"));
const BibliotecaFormularios = lazy(() => import("./pages/BibliotecaFormularios"));
const FormTemplateDetailPage = lazy(() => import("./pages/FormTemplateDetailPage"));
const FormularioEditor = lazy(() => import("./pages/FormularioEditor"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoPaciente = lazy(() => import("./pages/NovoPaciente"));
const OnboardingClinica = lazy(() => import("./pages/OnboardingClinica"));
const PacienteAnamnesisDashboard = lazy(() => import("./pages/PacienteAnamnesisDashboard"));
const PacienteDetalhe = lazy(() => import("./pages/PacienteDetalhe"));
const PacienteResumo = lazy(() => import("./pages/PacienteResumo"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const SelecionarClinica = lazy(() => import("./pages/SelecionarClinica"));
const SessaoDetalhe = lazy(() => import("./pages/SessaoDetalhe"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const PlatformMfa = lazy(() => import("./pages/PlatformMfa"));
const PlanosAssinatura = lazy(() => import("./pages/PlanosAssinatura"));
const DesignLabApp = lazy(() => import("../designlab/DesignLabApp"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isPlatformOwner, loading, platformMfaVerified, session } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (isPlatformOwner && !platformMfaVerified) return <Navigate to="/platform/mfa" replace />;
  return <>{children}</>;
};

const ClinicRoute = ({ children }: { children: ReactNode }) => {
  const { accessibleClinics, clinic, isPlatformOwner, loading, platformAccess, platformMfaVerified, selectClinicByRouteKey, session } = useAuth();
  const { clinicKey } = useParams();
  const [deniedRouteKey, setDeniedRouteKey] = useState<string | null>(null);
  const [validatingRouteKey, setValidatingRouteKey] = useState(false);

  useEffect(() => {
    if (loading || !session || !clinicKey || clinic?.route_key === clinicKey || deniedRouteKey === clinicKey) {
      return;
    }

    if (isPlatformOwner && platformAccess?.clinic.route_key === clinicKey) {
      return;
    }

    const hasRouteKey = accessibleClinics.some((option) => option.clinic.route_key === clinicKey);
    if (!hasRouteKey) {
      setDeniedRouteKey(clinicKey);
      return;
    }

    setValidatingRouteKey(true);
    void selectClinicByRouteKey(clinicKey)
      .catch(() => setDeniedRouteKey(clinicKey))
      .finally(() => setValidatingRouteKey(false));
  }, [accessibleClinics, clinic?.route_key, clinicKey, deniedRouteKey, isPlatformOwner, loading, platformAccess?.clinic.route_key, selectClinicByRouteKey, session]);

  if (loading) {
    return <LoadingScreen />;
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (isPlatformOwner && !platformMfaVerified) return <Navigate to="/platform/mfa" replace />;
  if (!clinicKey || deniedRouteKey === clinicKey) return <Navigate to="/espacopessoal" replace />;
  if (validatingRouteKey || clinic?.route_key !== clinicKey) return <LoadingScreen />;
  return <>{children}</>;
};

const PlatformRoute = ({ children }: { children: ReactNode }) => {
  const { isPlatformOwner, loading, platformMfaVerified, session } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (!isPlatformOwner) return <Navigate to="/espacopessoal" replace />;
  if (!platformMfaVerified) return <Navigate to="/platform/mfa" replace />;
  return <>{children}</>;
};

const PlatformMfaRoute = ({ children }: { children: ReactNode }) => {
  const { isPlatformOwner, loading, platformMfaVerified, session } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (!isPlatformOwner) return <Navigate to="/espacopessoal" replace />;
  if (platformMfaVerified) return <Navigate to="/platform" replace />;
  return <>{children}</>;
};

const LegacyClinicRoute = () => {
  const { clinic, isPlatformOwner, loading, platformMfaVerified, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (isPlatformOwner && !platformMfaVerified) return <Navigate to="/platform/mfa" replace />;
  if (!clinic?.route_key) return <Navigate to="/espacopessoal" replace />;

  return <Navigate to={`/clinica/${clinic.route_key}${location.pathname}${location.search}`} replace />;
};

const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { isPlatformOwner, loading, platformMfaVerified, session } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (session && isPlatformOwner && !platformMfaVerified) return <Navigate to="/platform/mfa" replace />;
  if (session && isPlatformOwner && platformMfaVerified) return <Navigate to="/platform" replace />;
  if (session) return <Navigate to="/espacopessoal" replace />;
  return <>{children}</>;
};

const App = () => (
  <div className="notranslate" translate="no">
    <QueryClientProvider client={appQueryClient}>
      <AppErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="therapy-flow-theme">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <FeatureFlagsProvider>
                  <TutorialProvider>
                    <TutorialOverlay />
                    <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      <Route path="/designlab/*" element={<DesignLabApp />} />
                      <Route path="/designlabs/*" element={<DesignLabApp />} />
                      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                      <Route path="/auth/cadastro" element={<AuthRoute><CadastroContaAlfa /></AuthRoute>} />
                      <Route path="/auth/criar-conta" element={<Navigate to="/auth/cadastro" replace />} />
                      <Route path="/auth/cadastrousuario" element={<Navigate to="/auth/cadastro" replace />} />
                      <Route path="/auth/cadastro-usuario" element={<Navigate to="/auth/cadastro" replace />} />
                      <Route path="/auth/confirmado" element={<ContaConfirmada />} />
                      <Route path="/auth/redefinir-senha" element={<RedefinirSenha />} />
                      <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
                      <Route path="/convite/:token" element={<ConviteClinica />} />
                      <Route path="/cadastro" element={<Navigate to="/auth/cadastro" replace />} />
                      <Route path="/cadastro/conta-alfa" element={<Navigate to="/auth/cadastro" replace />} />
                      <Route path="/cadastro/paciente/:token" element={<CadastroPacienteCompartilhado />} />
                      <Route path="/espacopessoal" element={<ProtectedRoute><SelecionarClinica /></ProtectedRoute>} />
                      <Route path="/planos" element={<ProtectedRoute><PlanosAssinatura /></ProtectedRoute>} />
                      <Route path="/onboarding-clinica" element={<ProtectedRoute><OnboardingClinica /></ProtectedRoute>} />
                      <Route path="/clinicas" element={<ProtectedRoute><Navigate to="/espacopessoal" replace /></ProtectedRoute>} />
                      <Route path="/platform/mfa" element={<PlatformMfaRoute><PlatformMfa /></PlatformMfaRoute>} />
                      <Route path="/platform/*" element={<PlatformRoute><PlatformAdmin /></PlatformRoute>} />
                      <Route
                        path="/configuracoes"
                        element={
                          <ProtectedRoute>
                            <AppLayout>
                              <SettingsLayout />
                            </AppLayout>
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<ConfiguracoesLegacyRedirect />} />
                        <Route path="perfil" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="seguranca" element={<Navigate to="pessoal/seguranca" replace />} />
                        <Route path="notificacoes" element={<Navigate to="pessoal/notificacoes" replace />} />
                        <Route path="equipe" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="colaboradores" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="assinatura" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="tesouraria" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="formularios" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="pessoal/perfil" element={<PersonalProfileSection />} />
                        <Route path="pessoal/seguranca" element={<PersonalSecuritySection />} />
                        <Route path="pessoal/notificacoes" element={<PersonalNotificationsSection />} />
                        <Route path="suporte" element={<SupportSection />} />
                      </Route>
                      <Route
                        path="/configuracoes/*"
                        element={
                          <ProtectedRoute>
                            <AppLayout>
                              <SettingsLayout />
                            </AppLayout>
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<ConfiguracoesLegacyRedirect />} />
                        <Route path="perfil" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="seguranca" element={<Navigate to="pessoal/seguranca" replace />} />
                        <Route path="notificacoes" element={<Navigate to="pessoal/notificacoes" replace />} />
                        <Route path="equipe" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="colaboradores" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="assinatura" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="tesouraria" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="formularios" element={<Navigate to="pessoal/perfil" replace />} />
                        <Route path="pessoal/perfil" element={<PersonalProfileSection />} />
                        <Route path="pessoal/seguranca" element={<PersonalSecuritySection />} />
                        <Route path="pessoal/notificacoes" element={<PersonalNotificationsSection />} />
                        <Route path="suporte" element={<SupportSection />} />
                      </Route>
                      <Route path="/" element={<ProtectedRoute><Navigate to="/espacopessoal" replace /></ProtectedRoute>} />
                      <Route
                        path="/clinica/:clinicKey/*"
                        element={
                          <ClinicRoute>
                            <AppLayout>
                              <Routes>
                                <Route index element={<Index />} />
                                <Route path="dashboard" element={<ClinicDashboard />} />
                                <Route path="configuracoes" element={<SettingsLayout />}>
                                  <Route index element={<ConfiguracoesLegacyRedirect />} />
                                  <Route path="perfil" element={<ClinicProfileSection />} />
                                  <Route path="equipe" element={<ClinicTeamSection />} />
                                  <Route path="colaboradores" element={<Navigate to="../equipe" replace />} />
                                  <Route path="seguranca" element={<ClinicSecuritySection />} />
                                  <Route path="assinatura" element={<ClinicBillingSection />} />
                                  <Route path="tesouraria" element={<ClinicTreasurySection />} />
                                  <Route path="formularios" element={<ClinicFormsSection />} />
                                  <Route path="pessoal/perfil" element={<PersonalProfileSection />} />
                                  <Route path="pessoal/seguranca" element={<PersonalSecuritySection />} />
                                  <Route path="pessoal/notificacoes" element={<PersonalNotificationsSection />} />
                                  <Route path="suporte" element={<SupportSection />} />
                                </Route>
                                <Route path="configuracoes/*" element={<SettingsLayout />}>
                                  <Route index element={<ConfiguracoesLegacyRedirect />} />
                                  <Route path="perfil" element={<ClinicProfileSection />} />
                                  <Route path="equipe" element={<ClinicTeamSection />} />
                                  <Route path="colaboradores" element={<Navigate to="../equipe" replace />} />
                                  <Route path="seguranca" element={<ClinicSecuritySection />} />
                                  <Route path="assinatura" element={<ClinicBillingSection />} />
                                  <Route path="tesouraria" element={<ClinicTreasurySection />} />
                                  <Route path="formularios" element={<ClinicFormsSection />} />
                                  <Route path="pessoal/perfil" element={<PersonalProfileSection />} />
                                  <Route path="pessoal/seguranca" element={<PersonalSecuritySection />} />
                                  <Route path="pessoal/notificacoes" element={<PersonalNotificationsSection />} />
                                  <Route path="suporte" element={<SupportSection />} />
                                </Route>
                                <Route path="configuracoes/formularios/biblioteca/:templateId" element={<FormTemplateDetailPage />} />
                                <Route path="configuracoes/formularios/biblioteca" element={<BibliotecaFormularios />} />
                                <Route path="configuracoes/formularios/:templateId" element={<FormularioEditor />} />
                                <Route path="pacientes/novo" element={<NovoPaciente />} />
                                <Route path="pacientes/:id" element={<PacienteDetalhe />} />
                                <Route path="pacientes/:id/dashboard" element={<PacienteAnamnesisDashboard />} />
                                <Route path="pacientes/:id/resumo" element={<PacienteResumo />} />
                                <Route path="pacientes/:id/cadastro" element={<CadastroCompleto />} />
                                <Route path="pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </AppLayout>
                          </ClinicRoute>
                        }
                      />
                      <Route path="/*" element={<LegacyClinicRoute />} />
                    </Routes>
                  </Suspense>
                </TutorialProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  </div>
);

export default App;
