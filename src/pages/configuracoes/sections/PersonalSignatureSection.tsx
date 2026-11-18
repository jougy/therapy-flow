import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSignature,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatByteSize } from "@/lib/image-processing";
import { processSignatureImage } from "@/lib/signatureImageProcessor";
import { generateGlobalUserId } from "@/lib/user-identity";

const ACCEPTED_SIGNATURE_FORMATS =
  ".jpg,.jpeg,.png,.svg,.webp,image/jpeg,image/png,image/svg+xml,image/webp";

interface ProcessedMeta {
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
}

export const PersonalSignatureSection = () => {
  const { user, profile, refreshAuthState } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  const [previewSignatureUrl, setPreviewSignatureUrl] = useState<string | null>(null);
  const [processedMeta, setProcessedMeta] = useState<ProcessedMeta | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const globalUserId = useMemo(
    () =>
      generateGlobalUserId({
        userId: user?.id,
        publicCode: profile?.public_code,
        email: user?.email,
      }),
    [user?.id, user?.email, profile?.public_code]
  );

  useEffect(() => {
    let active = true;
    const loadSignature = async () => {
      const profileRecord = profile as Record<string, unknown> | null;
      const fromContext =
        typeof profileRecord?.signature_webp_url === "string"
          ? profileRecord.signature_webp_url
          : null;

      if (fromContext) {
        if (active) {
          setSavedSignatureUrl(fromContext);
          setPreviewSignatureUrl(fromContext);
          setLoadingSignature(false);
        }
        return;
      }

      if (!user?.id) {
        if (active) setLoadingSignature(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("signature_webp_url" as never)
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;
        if (!error && data && typeof data === "object" && "signature_webp_url" in data) {
          const url = (data as { signature_webp_url?: string | null }).signature_webp_url || null;
          setSavedSignatureUrl(url);
          setPreviewSignatureUrl(url);
        }
      } catch {
        // Campo pode ainda não estar disponível antes de aplicar migration
      } finally {
        if (active) setLoadingSignature(false);
      }
    };

    void loadSignature();
    return () => {
      active = false;
    };
  }, [user?.id, profile]);

  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    try {
      const result = await processSignatureImage(file);
      setPreviewSignatureUrl(result.dataUrl);
      setProcessedMeta({
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        reductionPercent: result.reductionPercent,
      });
      toast({
        title: "Assinatura processada em WebP",
        description: `Fundo claro removido e imagem otimizada para ${formatByteSize(result.compressedSize)}.`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível processar a imagem.";
      toast({
        title: "Erro ao processar assinatura",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const handleSaveSignature = async (nextUrl: string | null) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          signature_webp_url: nextUrl,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", user.id);

      if (error) throw error;

      setSavedSignatureUrl(nextUrl);
      setPreviewSignatureUrl(nextUrl);
      if (!nextUrl) {
        setProcessedMeta(null);
      }

      toast({
        title: nextUrl
          ? "Assinatura digital salva!"
          : "Assinatura digital removida!",
        description: nextUrl
          ? "Sua assinatura .webp sem fundo será utilizada nos carimbos eletrônicos dos documentos."
          : "A imagem da assinatura foi removida do seu perfil.",
      });

      await refreshAuthState();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar assinatura.";
      toast({
        title: "Erro ao salvar assinatura",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = previewSignatureUrl !== savedSignatureUrl;

  return (
    <Card className="overflow-hidden min-w-0 w-full max-w-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
              <FileSignature className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">Assinatura Digital Pessoal</CardTitle>
              <CardDescription className="text-xs">
                Envie uma foto ou arquivo da sua assinatura. O sistema remove o fundo claro e converte para .webp transparente de alta compressão.
              </CardDescription>
            </div>
          </div>

          {savedSignatureUrl && (
            <Badge
              variant="outline"
              className="self-start sm:self-center shrink-0 gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Assinatura ativa
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 min-w-0">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_SIGNATURE_FORMATS}
          className="hidden"
          aria-label="Selecionar arquivo de assinatura"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {/* Área de Upload / Dropzone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => !processing && !saving && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !processing && !saving) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !processing && !saving) {
              void handleFile(file);
            }
          }}
          className={`w-full rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer min-h-[44px] flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/35"
          }`}
        >
          {processing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium text-foreground">
                Removendo fundo claro e otimizando para .webp...
              </p>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Clique ou arraste sua assinatura aqui
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Formatos aceitos: .jpg, .jpeg, .png, .svg e .webp (fundo branco removido automaticamente)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Preview em WebP sem fundo */}
        {loadingSignature ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando assinatura salva...</span>
          </div>
        ) : previewSignatureUrl ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Preview (.webp transparente)
                </span>
                {processedMeta && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {processedMeta.width}x{processedMeta.height}px •{" "}
                    {formatByteSize(processedMeta.originalSize)} →{" "}
                    {formatByteSize(processedMeta.compressedSize)}
                    {processedMeta.reductionPercent > 0
                      ? ` (-${processedMeta.reductionPercent}%)`
                      : ""}
                  </span>
                )}
              </div>

              {/* Padrão xadrez sutil para evidenciar transparência */}
              <div
                className="w-full min-h-[112px] rounded-lg border flex items-center justify-center p-4 overflow-hidden"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, rgba(148,163,184,0.14) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.14) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.14) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.14) 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                }}
              >
                <img
                  src={previewSignatureUrl}
                  alt="Preview da assinatura digital sem fundo"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>

              {/* Simulação do Carimbo Eletrônico estilo Gov.br */}
              <div className="rounded-lg border border-emerald-600/30 border-l-4 border-l-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Prévia do Carimbo Eletrônico (Documento assinado virtualmente)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong>{profile?.full_name || user?.email || "Profissional"}</strong>
                  {profile?.professional_license ? ` • ${profile.council_name || "Conselho"} ${profile.professional_license}` : ""}
                  {" • "}
                  <span className="font-mono">ID Global: {globalUserId}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing || saving}
                  className="min-h-[44px] text-xs gap-1.5"
                >
                  <Upload className="h-4 w-4" />
                  Trocar imagem
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (savedSignatureUrl) {
                      void handleSaveSignature(null);
                    } else {
                      setPreviewSignatureUrl(null);
                      setProcessedMeta(null);
                    }
                  }}
                  disabled={processing || saving}
                  className="min-h-[44px] text-xs gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover assinatura
                </Button>
              </div>

              <Button
                type="button"
                onClick={() => void handleSaveSignature(previewSignatureUrl)}
                disabled={processing || saving || (!hasUnsavedChanges && Boolean(savedSignatureUrl))}
                className="min-h-[44px] text-xs gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {hasUnsavedChanges ? "Salvar assinatura no perfil" : "Assinatura salva"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
