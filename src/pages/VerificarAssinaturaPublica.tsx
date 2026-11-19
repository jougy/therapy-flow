import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getActiveBrand } from "@/hooks/useActiveBrand";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Loader2,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPatientCpf } from "@/lib/patient-registration";
import {
  getDocumentSignatureByToken,
  type PublicDocumentSignaturePayload,
} from "@/components/patients/generate-document";

const LEI_14063_URL =
  "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm";
const MP_2200_2_URL =
  "https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm";

function readMetaString(
  meta: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!meta || typeof meta !== "object") return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function formatSignedDateTime(
  signedAt: string | null | undefined,
  meta: Record<string, unknown> | null | undefined
): string {
  if (signedAt) {
    const parsed = new Date(signedAt);
    if (!Number.isNaN(parsed.getTime())) {
      const dateStr = parsed.toLocaleDateString("pt-BR");
      const timeStr = parsed.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${dateStr} • ${timeStr}`;
    }
    return signedAt;
  }

  const metaDate = readMetaString(meta, ["date"]);
  const metaTime = readMetaString(meta, ["time"]);
  if (metaDate && metaTime) return `${metaDate} • ${metaTime}`;
  if (metaDate) return metaDate;
  return "Não informado";
}

function getSignerRoleLabel(role: PublicDocumentSignaturePayload["signer_role"]): string | null {
  switch (role) {
    case "paciente":
      return "Paciente";
    case "responsavel":
      return "Responsável Legal";
    case "colaborador":
      return "Profissional / Colaborador";
    case "owner":
      return "Responsável pela Clínica";
    default:
      return null;
  }
}

export const VerificarAssinaturaPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const isPreviewMode = token === "preview";

  const [loading, setLoading] = useState(!isPreviewMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<PublicDocumentSignaturePayload | null>(null);

  useEffect(() => {
    let active = true;

    const loadVerification = async () => {
      if (isPreviewMode) {
        if (active) {
          setLoading(false);
          setLoadError(null);
          setDoc(null);
        }
        return;
      }

      if (!token) {
        if (active) {
          setLoadError("Código ou token de verificação não informado.");
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
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Não foi possível validar o registro desta assinatura."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadVerification();
    return () => {
      active = false;
    };
  }, [token, isPreviewMode]);

  const meta = doc?.signature_metadata ?? null;
  const isSigned = Boolean(
    doc &&
      (doc.already_signed ||
        doc.status === "signed_remote" ||
        doc.status === "signed_in_person")
  );

  const signerName = doc?.signer_name || doc?.patient_name || "Não informado";
  const rawCpf = doc?.signer_cpf || readMetaString(meta, ["signer_cpf", "cpf"]);
  const formattedCpf = (() => {
    if (!rawCpf) return "Não informado";
    if (rawCpf.includes("*")) return rawCpf;
    const digits = rawCpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    }
    return formatPatientCpf(rawCpf);
  })();
  const safeSignatureImageUrl =
    doc?.signature_image_url &&
    (/^data:image\/(webp|png|jpeg);base64,/i.test(doc.signature_image_url) ||
      /^https:\/\//i.test(doc.signature_image_url))
      ? doc.signature_image_url
      : null;
  const councilRegistration =
    doc?.council_registration ||
    readMetaString(meta, [
      "council_registration",
      "councilRegistration",
      "conselho_regional",
      "professional_license",
      "council",
    ]);
  const globalUserId =
    doc?.global_user_id ||
    readMetaString(meta, [
      "global_user_id",
      "globalUserId",
      "pluri_user_id",
      "id_global",
    ]);
  const signedDateTime = formatSignedDateTime(
    doc?.signed_at || readMetaString(meta, ["signed_at_iso", "server_signed_at"]),
    meta
  );
  const roleLabel = doc ? getSignerRoleLabel(doc.signer_role) : null;

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-gradient-to-b from-muted/35 to-background flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <main className="max-w-xl mx-auto w-full min-w-0 space-y-5">
        {/* Cabeçalho Institucional */}
        <header className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Verificação Pública • {getActiveBrand().name}</span>
          </div>
          {doc?.clinic_logo_url && (
            <img
              src={doc.clinic_logo_url}
              alt={doc.clinic_name}
              className="h-10 w-auto mx-auto object-contain rounded"
            />
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
            Autenticidade da Assinatura Eletrônica
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Consulte os dados de registro e conformidade legal do documento emitido na plataforma.
          </p>
        </header>

        {/* Estado de Carregamento */}
        {loading && (
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span>Consultando registro de assinatura...</span>
            </CardContent>
          </Card>
        )}

        {/* Modo Prévia (sem token persistido) */}
        {!loading && isPreviewMode && (
          <Card className="rounded-2xl border border-amber-500/35 bg-amber-500/5 shadow-sm">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Clock className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Prévia de Verificação</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Este QR Code representa uma pré-visualização antes do registro definitivo do documento. Após a assinatura, o código apontará para o comprovante autêntico com token único.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Estado de Erro / Token Inválido */}
        {!loading && !isPreviewMode && loadError && (
          <Card className="rounded-2xl border-destructive/40 bg-destructive/5 shadow-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Registro Não Encontrado</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{loadError}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Cartão de Verificação de Assinatura */}
        {!loading && !loadError && doc && (
          <Card className="rounded-2xl border border-emerald-500/30 bg-card shadow-sm overflow-hidden">
            <CardHeader
              className={`border-b pb-4 ${
                isSigned
                  ? "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-500/20"
                  : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-500/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSigned
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {isSigned ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg font-bold text-foreground break-words">
                      {isSigned
                        ? "Assinatura Eletrônica Registrada"
                        : "Assinatura Pendente de Confirmação"}
                    </CardTitle>
                    <CardDescription className="text-xs break-words">
                      {doc.template_title}
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={
                    isSigned
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-[11px]"
                      : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[11px]"
                  }
                >
                  {doc.status === "signed_in_person"
                    ? "Presencial na Clínica"
                    : doc.status === "signed_remote"
                    ? "Assinatura Remota"
                    : doc.status === "pending_physical"
                    ? "Pendente Física"
                    : "Pendente"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
              {safeSignatureImageUrl && (
                <div className="p-3 rounded-xl border bg-muted/20 flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Rubrica Digital Registrada
                  </span>
                  <img
                    src={safeSignatureImageUrl}
                    alt={`Assinatura de ${signerName}`}
                    className="max-h-20 max-w-full object-contain"
                  />
                </div>
              )}

              {/* Dados do Signatário / Profissional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Signatário</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground break-words">
                    {signerName}
                  </p>
                  {roleLabel && (
                    <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
                  )}
                </div>

                <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileCheck2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>CPF</span>
                  </div>
                  <p className="font-mono text-sm font-medium text-foreground break-all">
                    {formattedCpf}
                  </p>
                </div>

                {councilRegistration && (
                  <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Conselho Regional</span>
                    </div>
                    <p className="font-medium text-sm text-foreground break-words">
                      {councilRegistration}
                    </p>
                  </div>
                )}

                {globalUserId && (
                  <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Fingerprint className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>ID Global Pluri</span>
                    </div>
                    <p className="font-mono text-xs sm:text-sm font-medium text-foreground break-all">
                      {globalUserId}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Clínica</span>
                  </div>
                  <p className="font-medium text-sm text-foreground break-words">
                    {doc.clinic_name}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/15 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Data e Horário da Assinatura</span>
                  </div>
                  <p className="font-medium text-sm text-foreground">
                    {isSigned ? signedDateTime : "Aguardando conclusão"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border text-[11px] text-muted-foreground space-y-1">
                <p className="font-mono break-all">
                  <strong>ID do Registro:</strong> {doc.id}
                </p>
                {token && (
                  <p className="font-mono break-all">
                    <strong>Token de Verificação:</strong> {token}
                  </p>
                )}
              </div>

              {!isSigned && doc.status === "pending" && token && (
                <Button asChild className="w-full min-h-[44px] text-xs font-semibold">
                  <Link to={`/assinar-documento/${encodeURIComponent(token)}`}>
                    Ir para Assinatura do Documento
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Base Legal & Termos de Uso */}
        <Card className="rounded-2xl border bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <span>Validade Jurídica & Transparência</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Assinaturas eletrônicas avançadas registradas com trilha de auditoria conforme a legislação brasileira vigente e proteção de dados (LGPD).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={LEI_14063_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border bg-background hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs font-medium text-foreground"
              >
                <span>Lei nº 14.063/2020 (Assinatura Eletrônica)</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </a>
              <a
                href={MP_2200_2_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border bg-background hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs font-medium text-foreground"
              >
                <span>MP nº 2.200-2/2001 (ICP-Brasil)</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
              <Link
                to="/termos"
                className="inline-flex items-center min-h-[44px] px-3 text-primary font-medium hover:underline"
              >
                Termos de Uso da Plataforma
              </Link>
              <span className="text-muted-foreground" aria-hidden="true">
                •
              </span>
              <Link
                to="/privacidade"
                className="inline-flex items-center min-h-[44px] px-3 text-primary font-medium hover:underline"
              >
                Política de Privacidade (LGPD)
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="text-center text-[11px] text-muted-foreground py-4 border-t mt-8">
        {getActiveBrand().name} • Autenticação Eletrônica de Documentos Clínicos
      </footer>
    </div>
  );
};

export default VerificarAssinaturaPublica;
