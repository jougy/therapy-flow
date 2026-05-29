import { lazy, Suspense, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
const CadastroPacienteCompartilhado = lazy(() => import("./pages/CadastroPacienteCompartilhado"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const FormularioEditor = lazy(() => import("./pages/FormularioEditor"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoPaciente = lazy(() => import("./pages/NovoPaciente"));
const PacienteDetalhe = lazy(() => import("./pages/PacienteDetalhe"));
const PacienteResumo = lazy(() => import("./pages/PacienteResumo"));
const SessaoDetalhe = lazy(() => import("./pages/SessaoDetalhe"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (session) return <Navigate to="/" replace />;
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
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/cadastro/paciente/:token" element={<CadastroPacienteCompartilhado />} />
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <AppLayout>
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/configuracoes" element={<Configuracoes />} />
                              <Route path="/configuracoes/formularios/:templateId" element={<FormularioEditor />} />
                              <Route path="/pacientes/novo" element={<NovoPaciente />} />
                              <Route path="/pacientes/:id" element={<PacienteDetalhe />} />
                              <Route path="/pacientes/:id/resumo" element={<PacienteResumo />} />
                              <Route path="/pacientes/:id/cadastro" element={<CadastroCompleto />} />
                              <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </AppLayout>
                        </ProtectedRoute>
                      }
                    />
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
