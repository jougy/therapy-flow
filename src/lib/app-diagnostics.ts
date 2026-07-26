export type AppDiagnosticSeverity = "error" | "warning" | "info";

export type AppDiagnosticStage =
  | "Processar arquivo"
  | "Preparar upload"
  | "Enviar para storage"
  | "Confirmar upload"
  | "Descartar arquivo"
  | "Baixar arquivo"
  | "Erro técnico";

export type AppDiagnosticContext = Record<string, string | number | boolean | null | undefined>;

export interface AppDiagnosticError {
  category: "edge_function" | "storage" | "processing" | "network" | "unknown";
  context: AppDiagnosticContext;
  environment: {
    appUrl: string;
    userAgent: string;
  };
  functionName?: string;
  humanSummary: string;
  originalMessage: string;
  probableCause: string;
  safeContext: AppDiagnosticContext;
  severity: AppDiagnosticSeverity;
  stack?: string;
  stage: AppDiagnosticStage;
  status?: number;
  technicalDetails?: string;
  timestamp: string;
  title: string;
}

type DiagnosticInput = {
  category?: AppDiagnosticError["category"];
  context?: AppDiagnosticContext;
  error: unknown;
  functionName?: string;
  probableCause?: string;
  stage?: AppDiagnosticStage;
  status?: number;
  technicalDetails?: unknown;
  title?: string;
};

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const longTokenPattern = /\b[A-Za-z0-9_-]{28,}\b/g;
const signedUrlPattern = /https?:\/\/[^\s"'`]+/g;

export const maskUuid = (value: string) =>
  value.replace(uuidPattern, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`);

export const sanitizeFilenameForDiagnostic = (value: string) => {
  const filename = value.split(/[\\/]/).pop()?.trim() || "arquivo";
  const extensionMatch = filename.match(/(\.[a-z0-9]{1,8})$/i);
  const extension = extensionMatch?.[1] ?? "";
  const basename = extension ? filename.slice(0, -extension.length) : filename;
  if (basename.length <= 18) return filename;
  return `${basename.slice(0, 10)}...${basename.slice(-4)}${extension}`;
};

export const maskSensitiveDiagnosticText = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return String(text ?? "")
    .replace(signedUrlPattern, (url) => {
      if (/X-Amz-|token=|apikey=|authorization=/i.test(url)) {
        try {
          const parsed = new URL(url);
          return `${parsed.origin}${parsed.pathname}?[signed-url-redacted]`;
        } catch {
          return "[signed-url-redacted]";
        }
      }
      return url;
    })
    .replace(uuidPattern, (match) => `${match.slice(0, 4)}...${match.slice(-4)}`)
    .replace(longTokenPattern, (match) => {
      if (match.includes("...")) return match;
      return `${match.slice(0, 6)}...[redacted]`;
    });
};

export const maskDiagnosticContext = (context: AppDiagnosticContext = {}) =>
  Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
        return [key, value];
      }

      const text = String(value);
      if (/file(name)?/i.test(key)) return [key, sanitizeFilenameForDiagnostic(text)];
      if (/id$/i.test(key) || key.toLowerCase().includes("id")) return [key, maskUuid(text)];
      return [key, maskSensitiveDiagnosticText(text)];
    }),
  );

const getOriginalMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message);
  return "Erro técnico sem mensagem detalhada.";
};

const getStack = (error: unknown) => (error instanceof Error && error.stack ? maskSensitiveDiagnosticText(error.stack) : undefined);

const titleForStage = (stage: AppDiagnosticStage, functionName?: string) => {
  if (functionName) return `Falha na Edge Function ${functionName}`;
  if (stage === "Enviar para storage") return "Backblaze recusou o envio";
  if (stage === "Processar arquivo") return "Falha ao otimizar o arquivo";
  if (stage === "Descartar arquivo") return "Falha ao descartar o arquivo";
  return "Falha técnica no envio do arquivo";
};

const summaryForStage = (stage: AppDiagnosticStage) => {
  if (stage === "Preparar upload") return "O app não conseguiu preparar uma URL segura para enviar o arquivo.";
  if (stage === "Enviar para storage") return "A URL foi gerada, mas o envio do binário para o storage não terminou com sucesso.";
  if (stage === "Confirmar upload") return "O arquivo pode ter chegado ao storage, mas a confirmação no sistema falhou.";
  if (stage === "Processar arquivo") return "O navegador não conseguiu otimizar ou ler o arquivo antes do upload.";
  if (stage === "Descartar arquivo") return "O app não conseguiu remover o arquivo do storage privado.";
  return "O fluxo encontrou uma falha técnica que precisa de investigação.";
};

const probableCauseFor = (input: DiagnosticInput) => {
  if (input.probableCause) return input.probableCause;
  if (input.category === "edge_function") return "A função pode estar sem secret, com erro interno, sem permissão ou retornando uma resposta inesperada.";
  if (input.category === "storage") return "Pode haver problema de CORS, assinatura da URL, permissão do bucket ou instabilidade de rede.";
  if (input.category === "processing") return "O arquivo pode estar corrompido, grande demais, em formato incomum ou o navegador pode não suportar a etapa de otimização.";
  return "A causa ainda não está clara; use os detalhes técnicos copiados para investigar.";
};

export const createAppDiagnosticError = (input: DiagnosticInput): AppDiagnosticError => {
  const stage = input.stage ?? "Erro técnico";
  const originalMessage = getOriginalMessage(input.error);

  return {
    category: input.category ?? "unknown",
    context: input.context ?? {},
    environment: {
      appUrl: typeof window === "undefined" ? "unknown" : window.location.href,
      userAgent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    },
    functionName: input.functionName,
    humanSummary: summaryForStage(stage),
    originalMessage: maskSensitiveDiagnosticText(originalMessage),
    probableCause: probableCauseFor(input),
    safeContext: maskDiagnosticContext(input.context),
    severity: "error",
    stack: getStack(input.error),
    stage,
    status: input.status,
    technicalDetails: input.technicalDetails ? maskSensitiveDiagnosticText(input.technicalDetails) : undefined,
    timestamp: new Date().toISOString(),
    title: input.title ?? titleForStage(stage, input.functionName),
  };
};

export const formatDiagnosticForPrompt = (diagnostic: AppDiagnosticError) => {
  const contextLines = Object.entries(diagnostic.safeContext)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n") || "- Sem contexto adicional seguro.";

  return [
    "# Pedido de ajuda para depurar erro técnico",
    "",
    "## Objetivo do usuário",
    "Resolver uma falha no upload de arquivo clínico na plataforma Therapy-flow/Pluri-Health.",
    "",
    "## Fluxo afetado",
    "- Área: Arquivos do paciente/atendimento",
    `- Etapa: ${diagnostic.stage}`,
    diagnostic.functionName ? `- Edge Function: ${diagnostic.functionName}` : null,
    diagnostic.status ? `- Status HTTP: ${diagnostic.status}` : null,
    "",
    "## Mensagem humanizada",
    diagnostic.humanSummary,
    "",
    "## Possível causa",
    diagnostic.probableCause,
    "",
    "## Erro técnico",
    `- Título: ${diagnostic.title}`,
    `- Mensagem original: ${diagnostic.originalMessage}`,
    diagnostic.technicalDetails ? `- Detalhes: ${diagnostic.technicalDetails}` : null,
    diagnostic.stack ? `- Stack: ${diagnostic.stack}` : null,
    "",
    "## Ambiente",
    `- URL: ${maskSensitiveDiagnosticText(diagnostic.environment.appUrl)}`,
    `- User agent: ${diagnostic.environment.userAgent}`,
    `- Timestamp: ${diagnostic.timestamp}`,
    "",
    "## Contexto mascarado",
    contextLines,
    "",
    "## Arquivos prováveis para investigar",
    "- `src/lib/patient-file-upload-queue.ts`",
    "- `src/components/PatientFilesPanel.tsx`",
    "- `supabase/functions/b2-upload-url/index.ts`",
    "- `supabase/functions/b2-confirm-upload/index.ts`",
    "- `supabase/functions/b2-delete-upload/index.ts`",
  ].filter(Boolean).join("\n");
};
