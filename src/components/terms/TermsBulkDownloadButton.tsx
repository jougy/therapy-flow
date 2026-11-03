import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ChevronDown, Download, FileCode, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DOC_TYPES, TermsConfigPayload } from "./types";
import { ExportableTermDoc, downloadAllTermsZip } from "@/lib/termsExport";

interface TermsBulkDownloadButtonProps {
  docs: TermsConfigPayload;
}

export function TermsBulkDownloadButton({ docs }: TermsBulkDownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleBulkDownload = async (format: "md" | "docx") => {
    setIsExporting(true);
    try {
      const exportableList: ExportableTermDoc[] = [];

      for (const def of DOC_TYPES) {
        const customDoc = docs[def.key];
        const defaultFallback = def.defaultFallback;
        const activeContent = customDoc?.content || defaultFallback?.content;

        if (activeContent) {
          const filename = customDoc?.filename || defaultFallback?.filename || `${def.key}.md`;
          exportableList.push({
            key: def.key,
            label: def.label,
            filename,
            content: activeContent,
          });
        }
      }

      if (exportableList.length === 0) {
        toast({
          title: "Nenhum documento disponível",
          description: "Não há documentos configurados ou padrões ativos para download.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      const zipFilename = `termos-plurihealth-${format}-${new Date().toISOString().slice(0, 10)}.zip`;
      await downloadAllTermsZip(exportableList, format, zipFilename);

      toast({
        title: "Download do arquivo .zip concluído",
        description: `Todos os ${exportableList.length} documentos foram compactados em formato .${format}.`,
      });
    } catch (err) {
      console.error("Erro ao gerar zip dos termos:", err);
      toast({
        title: "Falha na geração do .zip",
        description: "Ocorreu um erro ao compactar os documentos.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="h-9 px-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary shrink-0 font-medium"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Archive className="w-4 h-4 text-primary" />
          )}
          <span>Baixar Todos (.zip)</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => void handleBulkDownload("md")}
          className="text-xs cursor-pointer gap-2 py-2"
        >
          <FileCode className="w-4 h-4 text-blue-500" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">Compactar em .md</span>
            <span className="text-[10px] text-muted-foreground">Arquivos Markdown separados</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleBulkDownload("docx")}
          className="text-xs cursor-pointer gap-2 py-2"
        >
          <FileText className="w-4 h-4 text-sky-600" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">Compactar em .docx</span>
            <span className="text-[10px] text-muted-foreground">Documentos Word estruturados</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
