import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  CheckCircle2,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileCheck,
  Download,
  FileText,
  FileCode,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DocTypeDef, TermsDocItem } from "./types";
import { ExportableTermDoc, downloadSingleTermDoc } from "@/lib/termsExport";
import { toast } from "@/hooks/use-toast";

interface TermsDocCardProps {
  docDef: DocTypeDef;
  customDoc?: TermsDocItem;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  onFileUpload: (file: File) => void;
  onRemoveDoc: () => void;
}

export function TermsDocCard({
  docDef,
  customDoc,
  isPreviewOpen,
  onTogglePreview,
  onFileUpload,
  onRemoveDoc,
}: TermsDocCardProps) {
  const Icon = docDef.icon;
  const defaultFallback = docDef.defaultFallback;
  const hasCustomDoc = !!customDoc;
  const isUsingFallback = !hasCustomDoc && !!defaultFallback;
  const activeDocContent = customDoc?.content || defaultFallback?.content;

  const handleDownload = async (format: "md" | "docx") => {
    if (!activeDocContent) {
      toast({
        title: "Nenhum conteúdo para download",
        description: "Este termo ainda não possui arquivo customizado nem texto padrão cadastrado.",
        variant: "destructive",
      });
      return;
    }

    const filename = customDoc?.filename || defaultFallback?.filename || `${docDef.key}.md`;
    const exportable: ExportableTermDoc = {
      key: docDef.key,
      label: docDef.label,
      filename,
      content: activeDocContent,
    };

    try {
      await downloadSingleTermDoc(exportable, format);
      toast({
        title: "Download iniciado",
        description: `O arquivo "${exportable.label}" foi baixado em .${format}.`,
      });
    } catch (err) {
      console.error("Erro no download:", err);
      toast({
        title: "Erro ao gerar arquivo",
        description: "Não foi possível realizar o download do termo.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col border rounded-xl p-4 bg-card shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground text-sm truncate">{docDef.label}</h4>
            <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground mt-0.5">
              {docDef.badge}
            </span>
          </div>
        </div>

        {hasCustomDoc ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-1 rounded-md shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Customizado
          </span>
        ) : isUsingFallback ? (
          <span className="flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 px-2 py-1 rounded-md shrink-0">
            <FileCheck className="w-3.5 h-3.5" /> Padrão Ativo
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{docDef.description}</p>

      {hasCustomDoc ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-mono text-muted-foreground">
            <span className="truncate max-w-[200px] font-semibold text-foreground">{customDoc.filename}</span>
            <span>{new Date(customDoc.updatedAt).toLocaleDateString("pt-BR")}</span>
          </div>

          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-primary hover:text-primary"
              onClick={onTogglePreview}
            >
              <Eye className="w-3 h-3 mr-1" />
              {isPreviewOpen ? "Ocultar Prévia" : "Visualizar Texto"}
              {isPreviewOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2 gap-1 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Download className="w-3 h-3" />
                  Baixar
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => void handleDownload("md")} className="text-xs cursor-pointer gap-2">
                  <FileCode className="w-3.5 h-3.5 text-blue-500" /> Baixar em .md
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDownload("docx")} className="text-xs cursor-pointer gap-2">
                  <FileText className="w-3.5 h-3.5 text-sky-600" /> Baixar em .docx
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <label className="cursor-pointer ml-auto">
              <input
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file);
                }}
              />
              <span className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground underline">
                Substituir
              </span>
            </label>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemoveDoc}
              title="Remover documento customizado"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remover
            </Button>
          </div>

          {isPreviewOpen && activeDocContent && (
            <div className="mt-2 p-3 bg-background rounded border max-h-48 overflow-y-auto text-xs prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <ReactMarkdown>{activeDocContent}</ReactMarkdown>
            </div>
          )}
        </div>
      ) : isUsingFallback && defaultFallback ? (
        <div className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="truncate max-w-[220px] font-medium text-foreground">{defaultFallback.filename}</span>
            <span className="text-[11px] text-sky-600 dark:text-sky-400">Embarcado</span>
          </div>

          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-sky-700 dark:text-sky-300 hover:text-sky-800"
              onClick={onTogglePreview}
            >
              <Eye className="w-3 h-3 mr-1" />
              {isPreviewOpen ? "Ocultar Prévia" : "Visualizar Padrão"}
              {isPreviewOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2 gap-1 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                >
                  <Download className="w-3 h-3" />
                  Baixar
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => void handleDownload("md")} className="text-xs cursor-pointer gap-2">
                  <FileCode className="w-3.5 h-3.5 text-blue-500" /> Baixar em .md
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDownload("docx")} className="text-xs cursor-pointer gap-2">
                  <FileText className="w-3.5 h-3.5 text-sky-600" /> Baixar em .docx
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <label className="cursor-pointer ml-auto">
              <input
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file);
                }}
              />
              <span className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                <Upload className="w-3 h-3 mr-1" /> Customizar com .md
              </span>
            </label>
          </div>

          {isPreviewOpen && activeDocContent && (
            <div className="mt-2 p-3 bg-background rounded border max-h-48 overflow-y-auto text-xs prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <ReactMarkdown>{activeDocContent}</ReactMarkdown>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeDocContent && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Baixar Termo
                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => void handleDownload("md")} className="text-xs cursor-pointer gap-2">
                    <FileCode className="w-3.5 h-3.5 text-blue-500" /> Baixar em .md
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleDownload("docx")} className="text-xs cursor-pointer gap-2">
                    <FileText className="w-3.5 h-3.5 text-sky-600" /> Baixar em .docx
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="file"
              accept=".md,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileUpload(file);
              }}
            />
            <Upload className="w-6 h-6 text-muted-foreground mb-1" />
            <span className="text-xs font-medium text-foreground">Upload de arquivo .md ou .txt</span>
            <span className="text-[11px] text-muted-foreground">Clique para selecionar</span>
          </label>
        </div>
      )}
    </div>
  );
}
