import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Calendar, CheckCircle2, Clock, FileText, Printer, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { fetchPersonalPortfolioSessionDetail } from "@/services/clinicalPortfolioService";
import type { ClinicalPortfolioSessionDetail } from "@/types/clinicalPortfolio";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";
import { getSessionPreviewIndicators } from "@/lib/session-preview";
import { SessionPrintDocumentsModal } from "@/components/sessions/SessionPrintDocumentsModal";
import { printSessionDocument, type SessionDocumentKind, type SessionDocumentData } from "@/lib/session-documents";

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  concluido: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, i) => (
          <div key={i} className={`w-2.5 h-4 rounded-xs ${i < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{score}/{max}</span>
    </div>
  );
};

export const PersonalPortfolioSessionView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ClinicalPortfolioSessionDetail | null>(null);
  const [activeTab, setActiveTab] = useState("evolucao");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [pendingPrintKind, setPendingPrintKind] = useState<SessionDocumentKind | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchPersonalPortfolioSessionDetail(sessionId);
        if (!isMounted) return;

        if (!data) {
          toast({
            title: "Atendimento não encontrado",
            description: "Este atendimento não faz parte do seu acervo técnico ou foi removido.",
            variant: "destructive",
          });
          navigate("/espacopessoal", { replace: true });
          return;
        }

        setSession(data);
      } catch (err) {
        if (!isMounted) return;
        toast({
          title: "Erro ao carregar atendimento",
          description: "Não foi possível consultar os detalhes do atendimento.",
          variant: "destructive",
        });
        navigate("/espacopessoal", { replace: true });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [sessionId, navigate]);

  const previewIndicators = useMemo(() => {
    if (!session) return [];
    return getSessionPreviewIndicators(
      {
        anamnesis_form_response: session.anamnesisFormResponse,
        complexity_score: session.complexityScore ?? undefined,
        pain_score: session.painScore ?? undefined,
      },
      session.anamnesisBaseSchema as any
    );
  }, [session]);

  const formattedDate = useMemo(() => {
    if (!session?.sessionDate) return "";
    try {
      return new Date(session.sessionDate).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return session.sessionDate;
    }
  }, [session?.sessionDate]);

  const handleBackToPortfolio = () => {
    navigate("/espacopessoal");
  };

  const handleOpenPrintModal = (kind: SessionDocumentKind = "combined") => {
    setPendingPrintKind(kind);
    setIsPrintModalOpen(true);
  };

  const handleConfirmPrint = async () => {
    if (!session || !pendingPrintKind) return;
    setIsPrintModalOpen(false);

    try {
      const docData: SessionDocumentData = {
        anamnesisIndicators: previewIndicators.map((ind) => ({
          label: ind.label,
          min: ind.min ?? 0,
          max: ind.max ?? 10,
          score: typeof ind.score === "number" ? ind.score : 0,
        })),
        anamnesisSummary: session.notesSanitized || "",
        appName: "Pluri-Health",
        clinic: {
          address: "",
          businessHours: "",
          cnpj: null,
          email: null,
          legalName: null,
          logoUrl: session.clinicLogoUrl || null,
          name: session.clinicName,
          phone: null,
        },
        generatedAt: new Date().toLocaleString("pt-BR"),
        patientName: session.patientName || session.patientPseudonym,
        provider: {
          email: user?.email ?? null,
          fullName: user?.user_metadata?.full_name || "Profissional Responsável",
          jobTitle: null,
          phone: null,
          professionalLicense: null,
          specialty: null,
        },
        quickNotes: session.notesSanitized || "",
        sessionDate: formattedDate,
        treatmentDetails: undefined,
        treatmentSummary: session.treatmentSanitized || "",
      };

      await printSessionDocument(pendingPrintKind, docData);
    } catch (err) {
      toast({
        title: "Não foi possível imprimir o documento",
        description: err instanceof Error ? err.message : "Erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setPendingPrintKind(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Carregando acervo técnico...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToPortfolio}
              className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Voltar para o Meu Portfólio"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Meu Portfólio</span>
            </Button>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                Acervo Técnico do Atendimento
              </h1>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-[11px] px-2 py-0.5 font-medium ${
                statusColors[session.sessionStatus.toLowerCase()] || "bg-muted text-muted-foreground"
              }`}
            >
              {session.sessionStatus}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenPrintModal("combined")}
              className="gap-1.5 text-xs font-medium border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Imprimir Registro</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {/* Compliance Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h2 className="font-semibold text-foreground">Visualização de Acervo Técnico Profissional (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Este registro é uma cópia técnica imutável dos atendimentos prestados sob sua responsabilidade profissional.
              Os dados comerciais, financeiros e configurações internas da clínica são estritamente isolados.
            </p>
          </div>
        </div>

        {/* Patient & Clinic Info Header Card */}
        <Card className="shadow-xs">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              {/* Patient Demographics */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Paciente</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-base sm:text-lg font-bold text-foreground">
                    {session.patientName || session.patientPseudonym}
                  </span>
                  {session.patientRef && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {session.patientRef}
                    </Badge>
                  )}
                </div>
                {session.patientDemographics && (
                  <p className="text-xs text-muted-foreground">{session.patientDemographics}</p>
                )}
              </div>

              {/* Clinic of Attendance */}
              <div className="sm:text-right space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Local de Atendimento</span>
                <div className="flex items-center sm:justify-end gap-1.5 text-sm font-semibold text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{session.clinicName}</span>
                </div>
              </div>
            </div>

            {/* Tags / Care Lines */}
            {session.careLines.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground">Linhas de Cuidado & Tags:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {session.careLines.map((tag) => {
                    const tagColor = getLegacyGroupHex(tag.color);
                    const isDarkText = getReadableTextColor(tagColor) === "#111827";
                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs px-2 py-0.5 font-medium gap-1.5"
                        style={{
                          borderColor: tagColor,
                          backgroundColor: `${tagColor}18`,
                          color: isDarkText ? "#111827" : undefined,
                        }}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tagColor }} />
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clinical Preview Indicators (Pain, Complexity, Custom Scales) */}
            {previewIndicators.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-[11px] font-medium text-muted-foreground block mb-3">Indicadores Clínicos:</span>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {previewIndicators.map((indicator) => (
                    <div key={indicator.id} className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">{indicator.label}</span>
                      {typeof indicator.score === "number" ? (
                        <ScaleIndicator
                          score={indicator.score}
                          min={indicator.min ?? 0}
                          max={indicator.max ?? 10}
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{String(indicator.score ?? "-")}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Evolution & Notes Section */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span>Registro Clínico e Conduta</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid h-auto w-full grid-cols-2 sm:w-80">
                <TabsTrigger value="evolucao" className="text-xs py-1.5">
                  Queixa & Observações
                </TabsTrigger>
                <TabsTrigger value="tratamento" className="text-xs py-1.5">
                  Tratamento & Conduta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="evolucao" className="mt-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
                {session.notesSanitized ? (
                  <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {session.notesSanitized}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhuma observação ou queixa registrada para este atendimento.</p>
                )}
              </TabsContent>

              <TabsContent value="tratamento" className="mt-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
                {session.treatmentSanitized ? (
                  <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {session.treatmentSanitized}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum plano de tratamento registrado para este atendimento.</p>
                )}
              </TabsContent>
            </Tabs>

            {/* Custom Form Fields Response if present */}
            {session.anamnesisFormResponse &&
              typeof session.anamnesisFormResponse === "object" &&
              Object.keys(session.anamnesisFormResponse).length > 0 && (
                <div className="mt-6 pt-4 border-t space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>Respostas da Avaliação / Ficha Complementar</span>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(session.anamnesisFormResponse).map(([key, val]) => (
                      <div key={key} className="rounded-lg border bg-card p-3 space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">{key}</span>
                        <p className="text-xs font-medium text-foreground whitespace-pre-line break-words">
                          {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "-")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </main>

      {/* Print Document Modal */}
      <SessionPrintDocumentsModal
        isOpen={isPrintModalOpen}
        pendingPrintKind={pendingPrintKind}
        onConfirm={handleConfirmPrint}
        onCancel={() => {
          setIsPrintModalOpen(false);
          setPendingPrintKind(null);
        }}
      />
    </div>
  );
};

export default PersonalPortfolioSessionView;
