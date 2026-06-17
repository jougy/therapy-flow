import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();
const Auth = lazy(() => import("./pages/Auth"));
const CadastroCompleto = lazy(() => import("./pages/CadastroCompleto"));
const CadastroContaAlfa = lazy(() => import("./pages/CadastroContaAlfa"));
const CadastroPacienteCompartilhado = lazy(() => import("./pages/CadastroPacienteCompartilhado"));
const ClinicDashboard = lazy(() => import("./pages/ClinicDashboard"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const FormularioEditor = lazy(() => import("./pages/FormularioEditor"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoPaciente = lazy(() => import("./pages/NovoPaciente"));
const PacienteDetalhe = lazy(() => import("./pages/PacienteDetalhe"));
const PacienteResumo = lazy(() => import("./pages/PacienteResumo"));
const SelecionarClinica = lazy(() => import("./pages/SelecionarClinica"));
const SessaoDetalhe = lazy(() => import("./pages/SessaoDetalhe"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const PlatformMfa = lazy(() => import("./pages/PlatformMfa"));
const designLabModulePath = "/designlab/DesignLabApp.tsx";
const DesignLabApp = lazy(() =>
  import(/* @vite-ignore */ designLabModulePath).catch(() => import("./pages/NotFound"))
);

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
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="therapy-flow-theme">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/designlab/*" element={<DesignLabApp />} />
                    <Route path="/designlabs/*" element={<DesignLabApp />} />
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/cadastro/conta-alfa" element={<AuthRoute><CadastroContaAlfa /></AuthRoute>} />
                    <Route path="/cadastro/paciente/:token" element={<CadastroPacienteCompartilhado />} />
                    <Route path="/espacopessoal" element={<ProtectedRoute><SelecionarClinica /></ProtectedRoute>} />
                    <Route path="/clinicas" element={<ProtectedRoute><Navigate to="/espacopessoal" replace /></ProtectedRoute>} />
                    <Route path="/platform/mfa" element={<PlatformMfaRoute><PlatformMfa /></PlatformMfaRoute>} />
                    <Route path="/platform/*" element={<PlatformRoute><PlatformAdmin /></PlatformRoute>} />
                    <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
                    <Route path="/" element={<ProtectedRoute><Navigate to="/espacopessoal" replace /></ProtectedRoute>} />
                    <Route
                      path="/clinica/:clinicKey/*"
                      element={
                        <ClinicRoute>
                          <AppLayout>
                            <Routes>
                              <Route index element={<Index />} />
                              <Route path="dashboard" element={<ClinicDashboard />} />
                              <Route path="configuracoes" element={<Configuracoes />} />
                              <Route path="configuracoes/formularios/:templateId" element={<FormularioEditor />} />
                              <Route path="pacientes/novo" element={<NovoPaciente />} />
                              <Route path="pacientes/:id" element={<PacienteDetalhe />} />
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
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  </div>
);

export default App;
