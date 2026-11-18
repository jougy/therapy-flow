import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  PenTool,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatPatientCpf } from "@/lib/patient-registration";
import { formatCurrentTimeHHMM, formatDateShortBr } from "@/lib/termVariables";
import {
  allowSignatureUrlTransform,
  ElectronicSignatureStampCard,
  getDocumentSignatureByToken,
  SignaturePadCanvas,
  submitDocumentSignatureByToken,
  type PublicDocumentSignaturePayload,
} from "@/components/patients/generate-document";

export const AssinarDocumentoPublico: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<PublicDocumentSignaturePayload | null>(null);

  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [justSignedData, setJustSignedData] = useState<{
    signerName: string;
    signerCpf: string | null;
    signatureImageUrl: string;
    signedAt: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      if (!token) {
        if (active) {
          setLoadError("Token de assinatura não informado.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const payload = await getDocumentSignatureByToken(token);
        if (!active) return;
        setDoc(payload);
        setSignerName(payload.signer_name || payload.patient_name || "");
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o documento para assinatura."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDocument();
    return () => {
      active = false;
    };
  }, [token]);

  const isAlreadySigned = Boolean(
    justSignedData ||
      doc?.already_signed ||
      doc?.status === "signed_remote" ||
      doc?.status === "signed_in_person"
  );

  const cpfDigits = signerCpf.replace(/\D/g, "");
  const isCpfInvalid = cpfDigits.length > 0 && cpfDigits.length !== 11;
  const canSubmit =
    Boolean(token && doc) &&
    !isAlreadySigned &&
    signerName.trim().length >= 2 &&
    !isCpfInvalid &&
    Boolean(signatureDataUrl) &&
    !submitting;

  const handleSubmitSignature = async () => {
    if (!token || !doc || !signatureDataUrl) return;

    if (signerName.trim().length < 2) {
      toast({
        title: "Nome incompleto",
        description: "Informe seu nome completo para assinar o documento.",
        variant: "destructive",
      });
      return;
    }

    if (isCpfInvalid) {
      toast({
        title: "CPF inválido",
        description: "Informe os 11 dígitos do CPF ou deixe em branco.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const result = await submitDocumentSignatureByToken({
        token,
        signerName: signerName.trim(),
        signerCpf: cpfDigits || null,
        signatureImageUrl: signatureDataUrl,
        metadata: {
          date: formatDateShortBr(now),
          time: formatCurrentTimeHHMM(now),
          signed_at_iso: now.toISOString(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });

      setJustSignedData({
        signerName: result.signer_name || signerName.trim(),
        signerCpf: cpfDigits || null,
        signatureImageUrl: signatureDataUrl,
        signedAt: result.signed_at || now.toISOString(),
      });

      toast({
        title: "Documento assinado com sucesso!",
        description: "Sua assinatura digital e o carimbo eletrônico foram registrados.",
      });
    } catch (err) {
      toast({
        title: "Erro ao assinar documento",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel =
    doc?.signer_role === "responsavel"
      ? "Responsável Legal"
      : doc?.signer_role === "paciente"
      ? "Paciente"
      : undefined;

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-gradient-to-b from-muted/30 to-background flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-5">
        {/* Cabeçalho */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Assinatura Eletrônica Segura • LGPD</span>
          </div>
          {doc?.clinic_logo_url && (
            <img
              src={doc.clinic_logo_url}
              alt={doc.clinic_name}
              className="h-10 w-auto mx-auto object-contain rounded"
            />
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
            {doc?.clinic_name || "Assinatura de Documento Clínico"}
          </h1>
          {doc?.template_title && (
            <p className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
              {doc.template_title}
              {doc.patient_name ? ` • Paciente: ${doc.patient_name}` : ""}
            </p>
          )}
        </div>

        {/* Estado de Carregamento */}
        {loading && (
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span>Carregando documento para assinatura...</span>
            </CardContent>
          </Card>
        )}

        {/* Estado de Erro / Token Inválido */}
        {!loading && loadError && (
          <Card className="rounded-2xl border-destructive/40 bg-destructive/5 shadow-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Link Indisponível</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{loadError}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Documento Já Assinado (Confirmação + Carimbo Eletrônico) */}
        {!loading && !loadError && doc && isAlreadySigned && (
          <div className="space-y-4">
            <Card className="rounded-2xl border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
              <CardHeader className="text-center pb-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl font-bold text-emerald-950 dark:text-emerald-100">
                  Documento Assinado com Sucesso!
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                  A assinatura de <strong>{doc.template_title}</strong> já foi validada e registrada no prontuário da clínica <strong>{doc.clinic_name}</strong>.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <ElectronicSignatureStampCard
                  signerName={
                    justSignedData?.signerName || doc.signer_name || doc.patient_name || "Assinante"
                  }
                  signerCpf={justSignedData?.signerCpf}
                  signerRoleLabel={roleLabel}
                  signedAt={
                    justSignedData?.signedAt || doc.signed_at || new Date().toISOString()
                  }
                  signatureImageUrl={justSignedData?.signatureImageUrl}
                  clinicName={doc.clinic_name}
                  methodLabel={
                    doc.status === "signed_in_person"
                      ? "Presencial na Clínica"
                      : "Assinatura Remota"
                  }
                  verificationCode={doc.id}
                  token={token}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full min-h-[44px] gap-2 text-xs font-semibold"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Salvar Comprovante em PDF
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Conteúdo do Documento Assinado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3.5 rounded-xl border bg-muted/20 text-xs leading-relaxed prose prose-xs sm:prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown urlTransform={allowSignatureUrlTransform}>
                    {doc.rendered_markdown}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Documento Pendente para Assinatura */}
        {!loading && !loadError && doc && !isAlreadySigned && (
          <div className="space-y-5">
            {/* Texto do Documento */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span>Leitura do Documento</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Leia atentamente todas as cláusulas antes de preencher seus dados e assinar abaixo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[52dvh] overflow-y-auto overscroll-contain p-3.5 sm:p-4 rounded-xl border bg-muted/20 text-xs sm:text-sm leading-relaxed prose prose-xs sm:prose-sm dark:prose-invert max-w-none prose-blockquote:border-l-4 prose-blockquote:border-l-emerald-600 prose-blockquote:bg-emerald-50/60 dark:prose-blockquote:bg-emerald-950/20 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic">
                  <ReactMarkdown urlTransform={allowSignatureUrlTransform}>
                    {doc.rendered_markdown}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Identificação + Lousa de Assinatura */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-primary shrink-0" />
                  <span>Dados e Assinatura do Assinante</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Confirme seu nome completo, informe seu CPF e rubrique na lousa digital.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="public-signer-name" className="text-xs font-medium">
                      Nome Completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="public-signer-name"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Digite seu nome completo"
                      className="h-11 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="public-signer-cpf" className="text-xs font-medium">
                      CPF do Assinante
                    </Label>
                    <Input
                      id="public-signer-cpf"
                      value={signerCpf}
                      onChange={(e) => setSignerCpf(formatPatientCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                      className="h-11 text-sm"
                    />
                    {isCpfInvalid && (
                      <p className="text-[11px] text-destructive">
                        Informe os 11 dígitos do CPF.
                      </p>
                    )}
                  </div>
                </div>

                <SignaturePadCanvas
                  onSignatureChange={setSignatureDataUrl}
                  disabled={submitting}
                />

                <Button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmitSignature}
                  className="w-full min-h-[48px] font-bold shadow-md gap-2 text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  Assinar Digitalmente
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <footer className="text-center text-[11px] text-muted-foreground py-4 border-t mt-8">
        Pluri-Health • Assinatura Eletrônica Segura em conformidade com a LGPD e Conselhos de Classe.
      </footer>
    </div>
  );
};

export default AssinarDocumentoPublico;
