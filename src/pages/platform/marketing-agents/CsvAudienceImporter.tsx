import React, { useMemo, useState } from "react";
import { FileSpreadsheet, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCsvOrTxtContacts, type ParsedContactsResult } from "./zapSuiteEngine";

interface CsvAudienceImporterProps {
  value?: ParsedContactsResult | null;
  onAudienceParsed: (result: ParsedContactsResult, listName?: string) => void;
  onInsertVariable?: (variableToken: string) => void;
}

const SAMPLE_CSV = `nome,telefone,clinica,cidade
Dra. Camila Souza,(11) 98765-4321,Clínica Movimento,São Paulo
Dr. Rafael Lima,11991234567,Fisio Vida,Campinas`;

export const CsvAudienceImporter: React.FC<CsvAudienceImporterProps> = ({
  value,
  onAudienceParsed,
  onInsertVariable,
}) => {
  const [listName, setListName] = useState("Lista Importada CSV");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (rawText.trim()) return parseCsvOrTxtContacts(rawText);
    return value || { contacts: [], detectedColumns: [], skippedCount: 0 };
  }, [rawText, value]);

  const handleTextChange = (nextText: string) => {
    setRawText(nextText);
    const result = parseCsvOrTxtContacts(nextText);
    onAudienceParsed(result, listName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const baseName = file.name.replace(/\.(csv|txt)$/i, "");
    setListName(baseName || "Lista Importada");
    setRawText(text);
    onAudienceParsed(parseCsvOrTxtContacts(text), baseName || listName);
  };

  const dynamicVars = useMemo(() => {
    const cols = new Set<string>(["primeiro_nome"]);
    for (const col of parsed.detectedColumns) {
      if (col && col !== "telefone" && col !== "phone" && col !== "whatsapp") {
        cols.add(col);
      }
    }
    return Array.from(cols);
  }, [parsed.detectedColumns]);

  const previewRows = parsed.contacts.slice(0, 5);

  return (
    <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3 w-full max-w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
          <span>Importar Audiência CSV / TXT</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[11px] gap-1">
            <Users className="h-3 w-3" />
            <span>{parsed.contacts.length} contato(s)</span>
          </Badge>
          {parsed.skippedCount > 0 && (
            <Badge variant="outline" className="text-[11px] text-amber-600 dark:text-amber-400">
              {parsed.skippedCount} ignorado(s)/inválido(s)
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="csv-list-name" className="text-xs">Nome da Lista</Label>
          <Input
            id="csv-list-name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="min-h-[44px] text-xs"
            placeholder="Ex: Fisioterapeutas SP"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="csv-file-upload" className="text-xs">Arquivo .csv ou .txt</Label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="csv-file-upload"
              className="flex-1 min-h-[44px] px-3 rounded-md border bg-background hover:bg-muted/50 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium"
            >
              <Upload className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{fileName || "Selecionar arquivo"}</span>
            </label>
            <input
              id="csv-file-upload"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => void handleFileChange(e)}
              className="sr-only"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleTextChange(SAMPLE_CSV)}
              className="min-h-[44px] text-xs shrink-0"
            >
              Exemplo
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="csv-raw-textarea" className="text-xs">
          Cole contatos (separados por vírgula, ponto-e-vírgula ou TAB)
        </Label>
        <Textarea
          id="csv-raw-textarea"
          rows={3}
          value={rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="nome,telefone,clinica,cidade&#10;Dra. Ana,(11) 99999-0000,FisioPlus,São Paulo"
          className="text-xs font-mono"
        />
      </div>

      {dynamicVars.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            Variáveis dinâmicas detectadas (clique para inserir no template):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dynamicVars.map((col) => {
              const token = `{{${col}}}`;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => onInsertVariable?.(token)}
                  className="min-h-[32px] px-2 py-0.5 rounded-full border bg-background hover:bg-primary/10 text-[11px] font-mono text-primary transition-colors"
                >
                  {token}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="w-full overflow-x-auto touch-pan-x rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] h-8">Nome</TableHead>
                <TableHead className="text-[11px] h-8">WhatsApp E.164</TableHead>
                <TableHead className="text-[11px] h-8">Variáveis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((c) => (
                <TableRow key={c.phoneE164}>
                  <TableCell className="text-xs py-1.5 font-medium whitespace-nowrap">{c.name}</TableCell>
                  <TableCell className="text-xs py-1.5 font-mono whitespace-nowrap">{c.phoneE164}</TableCell>
                  <TableCell className="text-[11px] py-1.5 text-muted-foreground max-w-[220px] truncate">
                    {Object.entries(c.vars)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" • ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
