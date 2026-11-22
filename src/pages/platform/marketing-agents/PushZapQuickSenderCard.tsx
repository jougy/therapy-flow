import React, { useState } from "react";
import { BellRing, Check, Code2, Copy, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { MarketingWhatsAppInstance } from "./types";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";

interface PushZapQuickSenderCardProps {
  instances: MarketingWhatsAppInstance[];
  onSendPush?: (payload: { instanceId: string; phone: string; message: string }) => Promise<boolean>;
}

export const PushZapQuickSenderCard: React.FC<PushZapQuickSenderCardProps> = ({
  instances,
  onSendPush,
}) => {
  const [instanceId, setInstanceId] = useState(instances[0]?.id || "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [curlOpen, setCurlOpen] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const selectedInstance = instances.find((i) => i.id === instanceId) || instances[0];
  const supabaseBase =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "") ||
    "https://<seu-projeto>.supabase.co";

  const curlSnippet = `curl -X POST "${supabaseBase}/functions/v1/marketing-zap-gateway?action=send_push_alert" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_KEY>" \\
  -d '{"instance_id":"${selectedInstance?.id || ""}","phone":"${normalizePhoneToE164(phone) || "5511999990000"}","message":"Alerta Pluri-Health: novo lead qualificado!"}'`;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlSnippet);
      setCopiedCurl(true);
      toast({ title: "Snippet cURL copiado!" });
      setTimeout(() => setCopiedCurl(false), 1800);
    } catch {
      toast({ title: "Copie manualmente o comando cURL" });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhoneToE164(phone);
    if (!selectedInstance || normalized.length < 10 || !message.trim()) {
      toast({
        title: "Preencha chip, WhatsApp destino e mensagem",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      if (onSendPush) {
        const ok = await onSendPush({
          instanceId: selectedInstance.id,
          phone: normalized,
          message: message.trim(),
        });
        if (ok) setMessage("");
      } else {
        toast({
          title: "PushZap pronto para envio",
          description: `Alerta validado para ${formatPhoneBr(normalized)} via ${selectedInstance.instance_key}.`,
        });
        setMessage("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-amber-500/30 w-full max-w-full min-w-0">
      <CardHeader className="pb-2.5">
        <CardTitle className="text-sm flex items-center gap-2">
          <BellRing className="h-4 w-4 text-amber-500 shrink-0" />
          <span>PushZap — Alerta Rápido & Webhook REST</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Envie notificações transacionais ou alertas internos em 1 clique sem criar campanha completa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="pushzap-chip" className="text-xs">Chip Origem</Label>
              <Select value={selectedInstance?.id || ""} onValueChange={setInstanceId}>
                <SelectTrigger id="pushzap-chip" className="min-h-[44px] text-xs">
                  <SelectValue placeholder="Selecione o chip" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {formatPhoneBr(inst.phone_e164)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pushzap-phone" className="text-xs">WhatsApp Destino</Label>
              <Input
                id="pushzap-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="min-h-[44px] text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pushzap-msg" className="text-xs">Mensagem Push</Label>
            <Textarea
              id="pushzap-msg"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Novo lead quente solicitou demonstração agora!"
              className="text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Collapsible open={curlOpen} onOpenChange={setCurlOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  <span>{curlOpen ? "Ocultar Webhook cURL" : "Webhook REST (cURL)"}</span>
                </Button>
              </CollapsibleTrigger>
            </Collapsible>

            <Button type="submit" size="sm" disabled={sending} className="min-h-[44px] sm:min-h-[38px] gap-1.5">
              <Send className="h-3.5 w-3.5" />
              <span>{sending ? "Enviando..." : "Enviar Push Agora"}</span>
            </Button>
          </div>
        </form>

        <Collapsible open={curlOpen} onOpenChange={setCurlOpen}>
          <CollapsibleContent className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Integração via API REST</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyCurl()}
                className="min-h-[36px] text-xs gap-1"
              >
                {copiedCurl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copiar cURL</span>
              </Button>
            </div>
            <pre className="rounded-lg border bg-muted/40 p-2.5 text-[10px] font-mono overflow-x-auto max-w-full">
              {curlSnippet}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
