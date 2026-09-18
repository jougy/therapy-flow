import React, { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  AlertTriangle,
  Eye,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  Loader2,
  ShieldCheck,
  Baby,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { scanAndCompressTermDocument } from "@/lib/termDocumentScanner";
import defaultAdultTermsMarkdown from "@/assets/adult-terms-of-consent.md?raw";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import type { TermsConfigPayload } from "@/components/TermsConfigModal";

export interface ClinicCustomTermsData {
  adult_terms?: {
    content: string;
    filename: string;
    updatedAt: string;
    originalSize?: number;
    compressedSize?: number;
    b2ObjectKey?: string;
  };
  minor_terms?: {
    content: string;
    filename: string;
    updatedAt: string;
    originalSize?: number;
    compressedSize?: number;
    b2ObjectKey?: string;
  };
}

export const ClinicTermsSection: React.FC = () => {
  const { clinicId, can, accountRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicTerms, setClinicTerms] = useState<ClinicCustomTermsData>({});
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null);

  // Permissão: capability clinic_terms.manage ou owner da clínica
  const canManageTerms = Boolean(accountRole === "account_owner" || (typeof can === "function" && can("clinic_terms.manage")));

  useEffect(() => {
    let isMounted = true;
    if (!clinicId) {
      setLoading(false);
      return;
    }

    const loadClinicTerms = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("custom_fields")
          .eq("id", clinicId)
          .single();

        if (error) {
          console.warn("Erro ao buscar termos personalizados da clínica:", error);
        }

        if (isMounted && data) {
          const custom = (data.custom_fields || {}) as Record<string, unknown>;
          const termsData = (custom.clinic_terms || {}) as ClinicCustomTermsData;
          setClinicTerms(termsData);
        }
      } catch (err) {
        console.error("Falha ao carregar termos da clínica:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadClinicTerms();

    return () => {
      isMounted = false;
    };
  }, [clinicId]);

  const handleFileUpload = async (type: "adult_terms" | "minor_terms", file: File) => {
    if (!canManageTerms) {
      toast({
        title: "Permissão necessária",
        description: "Você precisa da permissão 'Gerenciar termos da clínica' para fazer upload.",
        variant: "destructive",
      });
      return;
    }

    try {
      const scanned = await scanAndCompressTermDocument(file);

      if (scanned.hasRemovedImages) {
        toast({
          title: "Imagens detectadas e removidas",
          description: "Por conformidade jurídica e otimização de impressão, qualquer imagem presente no documento foi descartada automaticamente.",
          variant: "default",
        });
      }

      // Envio ao Backblaze B2 (com tratamento de fallback gracioso se não configurado localmente)
      let b2Key: string | null = null;
      try {
        const { data: b2Data, error: b2Error } = await supabase.functions.invoke("b2-upload-url", {
          body: {
            clinicId,
            category: "terms",
            termType: type === "adult_terms" ? "adult_consent" : "minor_consent",
            originalFilename: file.name,
            byteSize: scanned.compressedSize,
            originalByteSize: scanned.originalSize,
            storedByteSize: scanned.compressedSize,
            contentType: "application/gzip",
            storageEncoding: "gzip",
          },
        });

        if (!b2Error && b2Data?.uploadUrl && b2Data?.objectKey) {
          b2Key = b2Data.objectKey;
          await fetch(b2Data.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/gzip",
              "Content-Encoding": "gzip",
            },
            body: scanned.compressedBlob,
          });
        }
      } catch (b2Err) {
        console.warn("Upload B2 offline ou em ambiente sem credenciais B2. Prosseguindo com persistência resiliente.", b2Err);
      }

      const updatedTerms: ClinicCustomTermsData = {
        ...clinicTerms,
        [type]: {
          content: scanned.markdownText,
          filename: file.name,
          updatedAt: new Date().toISOString(),
          originalSize: scanned.originalSize,
          compressedSize: scanned.compressedSize,
        },
      };

      await persistClinicTerms(updatedTerms, {
        type,
        filename: file.name,
        content: scanned.markdownText,
        b2ObjectKey: b2Key || `clinics/${clinicId}/terms/${type}_${Date.now()}.md.gz`,
        originalSize: scanned.originalSize,
        compressedSize: scanned.compressedSize,
      });

      setClinicTerms(updatedTerms);

      toast({
        title: "Termo atualizado com sucesso",
        description: `O documento ${file.name} foi sanitizado, comprimido e vinculado à clínica.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao processar arquivo";
      toast({
        title: "Erro no escaneamento",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRestoreDefault = async (type: "adult_terms" | "minor_terms") => {
    if (!canManageTerms || !clinicId) return;

    const updated = { ...clinicTerms };
    delete updated[type];

    // Remove do banco clinic_terms se existir
    try {
      await supabase
        .from("clinic_terms")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("term_type", type === "adult_terms" ? "adult_consent" : "minor_consent");
    } catch (dbErr) {
      console.warn("Erro ao remover da tabela clinic_terms:", dbErr);
    }

    await persistClinicTerms(updated);
    setClinicTerms(updated);

    toast({
      title: "Padrão restaurado",
      description: "A clínica voltou a utilizar o termo padrão oficial homologado pelo Therapy-Flow.",
    });
  };

  const persistClinicTerms = async (
    termsPayload: ClinicCustomTermsData,
    dbRecord?: {
      type: "adult_terms" | "minor_terms";
      filename: string;
      content: string;
      b2ObjectKey: string;
      originalSize: number;
      compressedSize: number;
    }
  ) => {
    if (!clinicId) return;
    setSaving(true);
    try {
      // 1. Tenta salvar na tabela public.clinic_terms
      if (dbRecord) {
        try {
          await supabase.from("clinic_terms").upsert(
            {
              clinic_id: clinicId,
              term_type: dbRecord.type === "adult_terms" ? "adult_consent" : "minor_consent",
              original_filename: dbRecord.filename,
              content_markdown: dbRecord.content,
              b2_object_key: dbRecord.b2ObjectKey,
              byte_size: dbRecord.originalSize,
              compressed_byte_size: dbRecord.compressedSize,
              storage_encoding: "gzip",
              version: 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "clinic_id,term_type" }
          );
        } catch (tableErr) {
          console.warn("Tabela clinic_terms ainda não disponível ou erro de RLS. Continuando em custom_fields:", tableErr);
        }
      }

      // 2. Persiste em clinics.custom_fields (garantia de fallback imediato e offline)
      const { data: currentClinic } = await supabase
        .from("clinics")
        .select("custom_fields")
        .eq("id", clinicId)
        .single();

      const existingCustom = (currentClinic?.custom_fields || {}) as Record<string, unknown>;
      const newCustom = {
        ...existingCustom,
        clinic_terms: termsPayload,
      };

      const { error } = await supabase
        .from("clinics")
        .update({
          custom_fields: newCustom,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clinicId);

      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar termos no banco";
      toast({
        title: "Erro de salvamento",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Termos de Consentimento & Normas da Clínica
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Personalize os termos de consentimento livre e esclarecido (TCLE) e termos de menor de idade exigidos nos atendimentos clínicos.
          </p>
        </div>
      </div>

      {/* Alerta Visual de Restrição de Imagens & Scanner */}
      <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="font-semibold text-sm">
          Aviso Importante: Diretrizes de Conteúdo e Remoção Automática de Imagens
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed mt-1 text-amber-800/90 dark:text-amber-300/90">
          Recomendamos fortemente <strong>não incluir imagens, fotografias ou logotipos pesados</strong> nos arquivos dos termos. O Scanner de Documentos converterá o arquivo para texto Markdown otimizado e <strong>removerá forçadamente qualquer tag ou elemento de imagem</strong> (.png, .jpg, nós Word de desenho) para garantir a integridade dos relatórios, compressão leve e padronização A4.
        </AlertDescription>
      </Alert>

      {/* Grid com os 2 Termos Modulares */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Termo Adulto */}
        <Card className="border shadow-sm flex flex-col justify-between">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Termo de Consentimento (Adulto)</CardTitle>
              </div>
              {clinicTerms.adult_terms ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Customizado pela Clínica
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 text-[11px] gap-1">
                  <FileCheck className="w-3 h-3" /> Padrão Oficial Therapy-Flow
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Aplicado a pacientes adultos. Inclui consentimento LGPD (Arts. 7º e 11), retenção legal de 20 anos (CFM 1.821/2007) e normas da clínica.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {clinicTerms.adult_terms ? (
              <div className="p-3 bg-muted/40 rounded-xl border text-xs space-y-1">
                <p className="font-semibold text-foreground truncate">{clinicTerms.adult_terms.filename}</p>
                <p className="text-muted-foreground text-[11px]">
                  Atualizado em: {new Date(clinicTerms.adult_terms.updatedAt).toLocaleString("pt-BR")}
                </p>
                {clinicTerms.adult_terms.originalSize && (
                  <p className="text-muted-foreground text-[10px] font-mono">
                    Tamanho: {(clinicTerms.adult_terms.originalSize / 1024).toFixed(1)} KB (Gzip: {((clinicTerms.adult_terms.compressedSize || 0) / 1024).toFixed(1)} KB)
                  </p>
                )}
                {clinicTerms.adult_terms.b2ObjectKey && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Backblaze B2: Sincronizado
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-500/20 text-xs text-muted-foreground">
                Utilizando o arquivo oficial padrão da plataforma (<code>adult-terms-of-consent.md</code>).
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() =>
                  setPreviewDoc({
                    title: "Prévia: Termo de Consentimento para Adultos",
                    content: clinicTerms.adult_terms?.content || defaultAdultTermsMarkdown,
                  })
                }
              >
                <Eye className="w-3.5 h-3.5" /> Pré-visualizar redação
              </Button>

              {canManageTerms && (
                <>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".md,.txt,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload("adult_terms", f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="text-xs h-8 gap-1.5 pointer-events-none"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Fazer Upload
                    </Button>
                  </label>

                  {clinicTerms.adult_terms && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => void handleRestoreDefault("adult_terms")}
                      disabled={saving}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Permissão Menor */}
        <Card className="border shadow-sm flex flex-col justify-between">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Baby className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-base">Permissão dos Pais (Menor de Idade)</CardTitle>
              </div>
              {clinicTerms.minor_terms ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Customizado pela Clínica
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 text-[11px] gap-1">
                  <FileCheck className="w-3 h-3" /> Padrão Oficial Therapy-Flow
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Aplicado a crianças e adolescentes. Conformidade expressa com Art. 14 da LGPD para coleta de consentimento pelos responsáveis legais.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {clinicTerms.minor_terms ? (
              <div className="p-3 bg-muted/40 rounded-xl border text-xs space-y-1">
                <p className="font-semibold text-foreground truncate">{clinicTerms.minor_terms.filename}</p>
                <p className="text-muted-foreground text-[11px]">
                  Atualizado em: {new Date(clinicTerms.minor_terms.updatedAt).toLocaleString("pt-BR")}
                </p>
                {clinicTerms.minor_terms.originalSize && (
                  <p className="text-muted-foreground text-[10px] font-mono">
                    Tamanho: {(clinicTerms.minor_terms.originalSize / 1024).toFixed(1)} KB (Gzip: {((clinicTerms.minor_terms.compressedSize || 0) / 1024).toFixed(1)} KB)
                  </p>
                )}
                {clinicTerms.minor_terms.b2ObjectKey && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Backblaze B2: Sincronizado
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-500/20 text-xs text-muted-foreground">
                Utilizando o arquivo oficial padrão da plataforma (<code>minor-terms-of-responsibility.md</code>).
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() =>
                  setPreviewDoc({
                    title: "Prévia: Consentimento do Responsável (Menor de Idade)",
                    content: clinicTerms.minor_terms?.content || defaultMinorTermsMarkdown,
                  })
                }
              >
                <Eye className="w-3.5 h-3.5" /> Pré-visualizar redação
              </Button>

              {canManageTerms && (
                <>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".md,.txt,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload("minor_terms", f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="text-xs h-8 gap-1.5 pointer-events-none"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Fazer Upload
                    </Button>
                  </label>

                  {clinicTerms.minor_terms && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => void handleRestoreDefault("minor_terms")}
                      disabled={saving}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Pré-Visualização */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-xl">
          <DialogHeader className="p-5 border-b">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {previewDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Visualização da redação atual com formatação de texto e parágrafos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-5 overflow-y-auto bg-muted/20">
            <div className="bg-card p-6 rounded-xl border shadow-sm prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown>{previewDoc?.content || ""}</ReactMarkdown>
            </div>
          </div>

          <DialogFooter className="p-3 border-t bg-muted/10">
            <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
              Fechar Prévia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
