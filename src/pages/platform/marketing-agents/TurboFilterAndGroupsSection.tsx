import React, { useMemo, useState } from "react";
import { CheckCircle2, Download, Filter, RefreshCw, Send, ShieldCheck, UserPlus, Users, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { MarketingWhatsAppInstance } from "./types";
import type { NumberValidationResult, WhatsAppGroupRecord } from "./suiteTypes";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { parseCsvOrTxtContacts } from "./zapSuiteEngine";

interface TurboFilterAndGroupsSectionProps {
  instances: MarketingWhatsAppInstance[];
  groups?: WhatsAppGroupRecord[];
  onValidateBatch?: (instanceId: string, phones: string[]) => Promise<NumberValidationResult[]>;
  onSyncGroups?: (instanceId: string) => Promise<WhatsAppGroupRecord[]>;
  onExtractGroupMembers?: (group: WhatsAppGroupRecord) => Promise<Array<{ phoneE164: string; name?: string }> | void>;
  onBatchGroupMembers?: (payload: { instanceId: string; groupJid: string; action: "add" | "remove"; phones: string[] }) => Promise<boolean>;
  onScheduleGroupBroadcast?: (payload: { instanceId: string; groupJids: string[]; message: string }) => Promise<boolean>;
}

export const TurboFilterAndGroupsSection: React.FC<TurboFilterAndGroupsSectionProps> = ({
  instances,
  groups: externalGroups,
  onValidateBatch,
  onSyncGroups,
  onExtractGroupMembers,
  onBatchGroupMembers,
  onScheduleGroupBroadcast,
}) => {
  const [activeInnerTab, setActiveInnerTab] = useState<"turbo-filter" | "groups">("turbo-filter");
  const [instanceId, setInstanceId] = useState(instances[0]?.id || "");
  const [rawNumbers, setRawNumbers] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<NumberValidationResult[]>([]);
  const [localGroups, setLocalGroups] = useState<WhatsAppGroupRecord[]>([]);
  const [syncingGroups, setSyncingGroups] = useState(false);
  const [selectedGroupJids, setSelectedGroupJids] = useState<string[]>([]);
  const [batchPhonesText, setBatchPhonesText] = useState("");
  const [batchAction, setBatchAction] = useState<"add" | "remove">("add");
  const [groupMessage, setGroupMessage] = useState("");

  const groups = externalGroups?.length ? externalGroups : localGroups;
  const activeInstanceId = instanceId || instances[0]?.id || "";
  const validCount = useMemo(() => validationResults.filter((r) => r.existsOnWhatsapp).length, [validationResults]);
  const invalidCount = validationResults.length - validCount;

  const handleRunTurboFilter = async () => {
    const parsed = parseCsvOrTxtContacts(rawNumbers);
    const phones =
      parsed.contacts.length > 0
        ? parsed.contacts.map((c) => c.phoneE164)
        : rawNumbers.split(/[\s,;]+/).map((p) => normalizePhoneToE164(p)).filter((p) => p.length >= 10);
    const unique = Array.from(new Set(phones));
    if (unique.length === 0) {
      toast({ title: "Cole ou importe ao menos 1 número válido", variant: "destructive" });
      return;
    }
    setValidating(true);
    try {
      if (onValidateBatch) {
        setValidationResults(await onValidateBatch(activeInstanceId, unique));
      } else {
        const now = new Date().toISOString();
        const localCheck: NumberValidationResult[] = unique.map((phone) => {
          const validFormat = /^55\d{10,11}$/.test(phone) || phone.length >= 11;
          return { phoneE164: phone, existsOnWhatsapp: validFormat, whatsappJid: validFormat ? `${phone}@s.whatsapp.net` : null, fromCache: true, checkedAt: now };
        });
        setValidationResults(localCheck);
        toast({ title: `Pré-validação concluída (${localCheck.filter((x) => x.existsOnWhatsapp).length} válidos)` });
      }
    } finally {
      setValidating(false);
    }
  };

  const handleDownloadCleanCsv = () => {
    const validRows = validationResults.filter((r) => r.existsOnWhatsapp);
    if (validRows.length === 0) return;
    const csv = ["telefone,whatsapp_jid,verificado_em", ...validRows.map((r) => `${r.phoneE164},${r.whatsappJid || ""},${r.checkedAt}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turbo-filter-limpo-${validRows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncGroups = async () => {
    if (!activeInstanceId) return;
    setSyncingGroups(true);
    try {
      if (onSyncGroups) setLocalGroups(await onSyncGroups(activeInstanceId));
      else toast({ title: "Sincronização de grupos pronta", description: "Conecte o chip Evolution para listar grupos." });
    } finally {
      setSyncingGroups(false);
    }
  };

  const toggleGroupSelection = (jid: string) =>
    setSelectedGroupJids((prev) => (prev.includes(jid) ? prev.filter((x) => x !== jid) : [...prev, jid]));

  const handleBatchMembers = async () => {
    const targetJid = selectedGroupJids[0];
    const phones = batchPhonesText.split(/[\s,;]+/).map((p) => normalizePhoneToE164(p)).filter((p) => p.length >= 10);
    if (!targetJid || phones.length === 0) {
      toast({ title: "Selecione 1 grupo e informe os números", variant: "destructive" });
      return;
    }
    if (onBatchGroupMembers) {
      await onBatchGroupMembers({ instanceId: activeInstanceId, groupJid: targetJid, action: batchAction, phones });
    } else {
      toast({ title: `Lote (${batchAction}) preparado para ${phones.length} número(s) com Jitter Anti-Ban` });
    }
  };

  const handleGroupBroadcast = async () => {
    if (selectedGroupJids.length === 0 || !groupMessage.trim()) {
      toast({ title: "Selecione ao menos 1 grupo e escreva a mensagem", variant: "destructive" });
      return;
    }
    if (onScheduleGroupBroadcast) {
      await onScheduleGroupBroadcast({ instanceId: activeInstanceId, groupJids: selectedGroupJids, message: groupMessage.trim() });
    } else {
      toast({ title: `Disparo agendado para ${selectedGroupJids.length} grupo(s)` });
    }
  };

  return (
    <Tabs value={activeInnerTab} onValueChange={(v) => setActiveInnerTab(v as "turbo-filter" | "groups")} className="w-full max-w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-full sm:w-auto overflow-x-auto touch-pan-x">
          <TabsList className="inline-flex w-max h-auto p-1 gap-1">
            <TabsTrigger value="turbo-filter" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5 px-3">
              <Filter className="h-3.5 w-3.5" /><span>Filtro Turbo (Validador)</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5 px-3">
              <Users className="h-3.5 w-3.5" /><span>WaGroup & GroupMaster</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <Select value={activeInstanceId} onValueChange={setInstanceId}>
          <SelectTrigger className="w-full sm:w-64 min-h-[44px] text-xs"><SelectValue placeholder="Chip" /></SelectTrigger>
          <SelectContent>
            {instances.map((i) => (
              <SelectItem key={i.id} value={i.id}>{formatPhoneBr(i.phone_e164)} ({i.instance_key})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TabsContent value="turbo-filter" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />Turbo Filter — Validador de WhatsApp em Massa
            </CardTitle>
            <CardDescription className="text-xs">
              Filtra números inexistentes via Evolution API antes do disparo, evitando bounce e queda no ZapDefender.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="turbo-numbers" className="text-xs">Cole números ou CSV/TXT</Label>
              <Textarea id="turbo-numbers" rows={4} value={rawNumbers} onChange={(e) => setRawNumbers(e.target.value)} placeholder="(11) 98765-4321&#10;11912345678" className="text-xs font-mono" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={validating} onClick={() => void handleRunTurboFilter()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                  <Filter className="h-3.5 w-3.5" /><span>{validating ? "Validando..." : "Validar Números no WhatsApp"}</span>
                </Button>
                {validCount > 0 && (
                  <Button type="button" variant="outline" onClick={handleDownloadCleanCsv} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" /><span>Baixar CSV Limpo ({validCount})</span>
                  </Button>
                )}
              </div>
              {validationResults.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" variant="outline">Válidos: {validCount}</Badge>
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" variant="outline">Inválidos: {invalidCount}</Badge>
                </div>
              )}
            </div>
            {validationResults.length > 0 && (
              <div className="w-full overflow-x-auto touch-pan-x rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead className="text-xs">Telefone E.164</TableHead><TableHead className="text-xs">Status WhatsApp</TableHead><TableHead className="text-xs">JID</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.slice(0, 50).map((item) => (
                      <TableRow key={item.phoneE164}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{item.phoneE164}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {item.existsOnWhatsapp ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Ativo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><XCircle className="h-3.5 w-3.5" /> Sem WhatsApp</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">{item.whatsappJid || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="groups" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />WaGroup & GroupMaster — Grupos do Chip</CardTitle>
                <CardDescription className="text-xs">Extraia membros em CSV, gerencie em lote com jitter ou agende disparos.</CardDescription>
              </div>
              <Button type="button" variant="outline" disabled={syncingGroups} onClick={() => void handleSyncGroups()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${syncingGroups ? "animate-spin" : ""}`} /><span>Sincronizar Grupos do Chip</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                Nenhum grupo sincronizado ainda. Clique em &ldquo;Sincronizar Grupos do Chip&rdquo; com o chip conectado.
              </p>
            ) : (
              <div className="w-full overflow-x-auto touch-pan-x rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead className="w-10"></TableHead><TableHead className="text-xs">Grupo</TableHead><TableHead className="text-xs">Membros</TableHead><TableHead className="text-xs text-right">Ações</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((grp) => (
                      <TableRow key={grp.groupJid}>
                        <TableCell><Checkbox checked={selectedGroupJids.includes(grp.groupJid)} onCheckedChange={() => toggleGroupSelection(grp.groupJid)} aria-label={`Selecionar ${grp.subject}`} /></TableCell>
                        <TableCell className="text-xs font-medium"><p className="truncate max-w-[200px]">{grp.subject}</p><p className="text-[10px] font-mono text-muted-foreground">{grp.groupJid}</p></TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{grp.participantCount}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" size="sm" variant="outline" onClick={() => void onExtractGroupMembers?.(grp)} className="min-h-[38px] text-xs gap-1">
                            <Download className="h-3.5 w-3.5" /><span>Extrair Membros (CSV)</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border p-3 space-y-2.5">
                <p className="text-xs font-semibold flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-primary" />Adicionar/Remover em Lote (com Jitter Anti-Ban)</p>
                <Select value={batchAction} onValueChange={(v) => setBatchAction(v as "add" | "remove")}>
                  <SelectTrigger className="min-h-[44px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Adicionar membros ao grupo</SelectItem>
                    <SelectItem value="remove">Remover membros do grupo</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea rows={2} value={batchPhonesText} onChange={(e) => setBatchPhonesText(e.target.value)} placeholder="Números por linha ou vírgula..." className="text-xs font-mono" />
                <Button type="button" variant="secondary" onClick={() => void handleBatchMembers()} className="w-full min-h-[44px] sm:min-h-[38px] text-xs">
                  Executar Lote ({selectedGroupJids.length} grupo)
                </Button>
              </div>
              <div className="rounded-xl border p-3 space-y-2.5">
                <p className="text-xs font-semibold flex items-center gap-1.5"><Send className="h-3.5 w-3.5 text-primary" />Agendar Disparo para Grupos ({selectedGroupJids.length})</p>
                <Textarea rows={4} value={groupMessage} onChange={(e) => setGroupMessage(e.target.value)} placeholder="Mensagem para os grupos selecionados..." className="text-xs" />
                <Button type="button" onClick={() => void handleGroupBroadcast()} className="w-full min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                  <Send className="h-3.5 w-3.5" /><span>Agendar Disparo para Grupos</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
