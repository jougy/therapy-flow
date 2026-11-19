import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { AutoLeadIcpTier } from "./types";

interface AutoLeadIntegrationModalProps {
  open: boolean;
  initialTab?: "manual" | "import";
  onOpenChange: (open: boolean) => void;
  onCreateManualLead: (payload: {
    full_name: string;
    phone?: string;
    email?: string;
    instagram_handle?: string;
    facebook_group_name?: string;
    clinic_name?: string;
    city?: string;
    icp_tier?: AutoLeadIcpTier;
    ai_score?: number;
    source_post_excerpt?: string;
    ai_icebreaker_message?: string;
  }) => Promise<boolean>;
  onImportBatch: (items: Record<string, unknown>[]) => Promise<boolean>;
}

function parseCsvOrJson(raw: string): Record<string, unknown>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,]/).map((c) => c.trim());
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const val = cols[idx] || "";
      if (["name", "nome", "full_name", "authorname"].includes(h)) obj.full_name = val;
      else if (["phone", "telefone", "whatsapp", "celular"].includes(h)) obj.phone = val;
      else if (["email", "e-mail"].includes(h)) obj.email = val;
      else if (["instagram", "instagram_handle", "ig"].includes(h)) obj.instagram_handle = val;
      else if (["grupo", "group", "facebook_group_name", "groupname"].includes(h)) obj.facebook_group_name = val;
      else if (["cidade", "city"].includes(h)) obj.city = val;
      else if (["post", "texto", "source_post_excerpt", "posttext"].includes(h)) obj.source_post_excerpt = val;
      else if (["score", "ai_score"].includes(h)) obj.ai_score = Number(val) || 65;
      else obj[h] = val;
    });
    obj.source_platform = "csv_import";
    return obj;
  });
}

export const AutoLeadIntegrationModal: React.FC<AutoLeadIntegrationModalProps> = ({
  open,
  initialTab = "manual",
  onOpenChange,
  onCreateManualLead,
  onImportBatch,
}) => {
  const [tab, setTab] = useState<"manual" | "import">(initialTab);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [groupName, setGroupName] = useState("Fisioterapia Brasil");
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");
  const [icpTier, setIcpTier] = useState<AutoLeadIcpTier>("clinic_owner");
  const [excerpt, setExcerpt] = useState("");
  const [rawBatch, setRawBatch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      const ok = await onCreateManualLead({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        instagram_handle: instagram.trim() || undefined,
        facebook_group_name: groupName.trim() || undefined,
        clinic_name: clinicName.trim() || undefined,
        city: city.trim() || undefined,
        icp_tier: icpTier,
        ai_score: phone.trim() ? 82 : 65,
        source_post_excerpt: excerpt.trim() || undefined,
      });
      if (ok) {
        setFullName("");
        setPhone("");
        setEmail("");
        setInstagram("");
        setClinicName("");
        setCity("");
        setExcerpt("");
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    setSubmitting(true);
    try {
      const items = parseCsvOrJson(rawBatch);
      if (items.length === 0) {
        toast({ title: "Nenhum registro reconhecido", description: "Cole um CSV com cabeçalho ou JSON válido.", variant: "destructive" });
        return;
      }
      const ok = await onImportBatch(items);
      if (ok) {
        setRawBatch("");
        onOpenChange(false);
      }
    } catch {
      toast({ title: "Erro ao processar JSON/CSV", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <span>Adicionar ou Importar Contatos de Leads</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cadastre um novo possível cliente ou cole um lote JSON/CSV extraído pelos subagentes do Antigravity (Apify + Curador IA).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "import")} className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual" className="text-xs gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Cadastro Manual</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="text-xs gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Importar CSV / JSON</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
            <form onSubmit={handleSaveManual} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-name" className="text-xs">Nome completo *</Label>
                  <Input
                    id="lead-manual-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Dra. Camila Nogueira"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-phone" className="text-xs">WhatsApp</Label>
                  <Input
                    id="lead-manual-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 5511991234455"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-email" className="text-xs">E-mail</Label>
                  <Input id="lead-manual-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-ig" className="text-xs">Instagram</Label>
                  <Input id="lead-manual-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@clinica" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-group" className="text-xs">Grupo Facebook</Label>
                  <Input id="lead-manual-group" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-clinic" className="text-xs">Clínica / Studio</Label>
                  <Input id="lead-manual-clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-manual-icp" className="text-xs">Perfil (ICP)</Label>
                  <Select value={icpTier} onValueChange={(v) => setIcpTier(v as AutoLeadIcpTier)}>
                    <SelectTrigger id="lead-manual-icp">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic_owner">Dono de Clínica</SelectItem>
                      <SelectItem value="studio_pilates">Estúdio de Pilates</SelectItem>
                      <SelectItem value="solo_physio">Fisio Autônomo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-manual-excerpt" className="text-xs">Contexto / Post no Grupo</Label>
                <Textarea
                  id="lead-manual-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Dúvida ou necessidade identificada..."
                  className="min-h-[70px] text-xs"
                />
              </div>

              <Button type="submit" disabled={submitting || !fullName.trim()} className="w-full gap-1.5">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Salvar na Tabela de Contatos</span>
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="import" className="space-y-3">
            <Label htmlFor="batch-import-area" className="text-xs">
              Cole JSON curado pelos subagentes ou CSV (`full_name,phone,email,instagram,facebook_group_name,source_post_excerpt,ai_score`)
            </Label>
            <Textarea
              id="batch-import-area"
              value={rawBatch}
              onChange={(e) => setRawBatch(e.target.value)}
              placeholder={"full_name,phone,facebook_group_name,ai_score\nDra. Juliana Costa,5511988776655,Fisioterapia Brasil,90"}
              className="min-h-[140px] font-mono text-xs"
            />
            <Button type="button" onClick={handleImport} disabled={submitting || !rawBatch.trim()} className="w-full">
              {submitting ? "Importando..." : "Importar & Deduplicar Contatos"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
