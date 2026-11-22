import React, { useState } from "react";
import { Check, Copy, Smartphone, Webhook } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { MarketingWhatsAppInstance } from "./types";

interface AndroidBridgeSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: MarketingWhatsAppInstance | null;
}

export const AndroidBridgeSetupSheet: React.FC<AndroidBridgeSetupSheetProps> = ({
  open,
  onOpenChange,
  instance,
}) => {
  const [autoSaveContact, setAutoSaveContact] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const supabaseBase =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "") ||
    "https://<seu-projeto>.supabase.co";
  const endpointUrl = `${supabaseBase}/functions/v1/marketing-android-bridge`;
  const instanceKey = instance?.instance_key || "pluri-mkt-android-01";

  const payloadExample = JSON.stringify(
    {
      instance_key: instanceKey,
      sender_phone: "5511999990000",
      sender_name: "Dra. Juliana Fisioterapia",
      message_text: "Olá, gostaria de saber mais sobre os planos do Pluri Fisio.",
      package_name: "com.whatsapp",
      auto_save_contact: autoSaveContact,
    },
    null,
    2,
  );

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast({ title: `${label} copiado!` });
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast({ title: "Copie manualmente o bloco abaixo" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl max-h-[100dvh] flex flex-col p-0">
        <SheetHeader className="px-4 sm:px-6 pt-5 pb-3 border-b text-left">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Smartphone className="h-5 w-5 text-primary shrink-0" />
            Bridge Android Nativo (Equivalente MobZap)
          </SheetTitle>
          <SheetDescription className="text-xs">
            Capture notificações do WhatsApp/WhatsApp Business direto do aparelho Android sem precisar de QR Code.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">NotificationListener Android</Badge>
            <Badge variant="outline">MacroDroid</Badge>
            <Badge variant="outline">Tasker</Badge>
            <Badge variant="secondary" className="font-mono">{instanceKey}</Badge>
          </div>

          <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold flex items-center gap-1.5">
                <Webhook className="h-3.5 w-3.5 text-primary" />
                Endpoint Webhook (POST)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy("Endpoint Webhook", endpointUrl)}
                className="min-h-[38px] text-xs gap-1"
              >
                {copiedField === "Endpoint Webhook" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copiar URL</span>
              </Button>
            </div>
            <code className="block rounded-lg border bg-background p-2.5 font-mono text-[11px] break-all">
              {endpointUrl}
            </code>
          </div>

          <div className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Header de Autenticação Obrigatório</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleCopy("Header Secret", "x-android-bridge-secret")}
                className="min-h-[38px] text-xs gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar Header</span>
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2.5 font-mono text-[11px] break-all">
              x-android-bridge-secret: &lt;ANDROID_BRIDGE_SECRET do Pulumi ESC&gt;
            </div>
          </div>

          <div className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Exemplo de Payload JSON</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy("Payload JSON", payloadExample)}
                className="min-h-[38px] text-xs gap-1"
              >
                {copiedField === "Payload JSON" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copiar JSON</span>
              </Button>
            </div>
            <pre className="rounded-lg border bg-muted/40 p-2.5 font-mono text-[11px] overflow-x-auto max-w-full">
              {payloadExample}
            </pre>
          </div>

          <div className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-primary/5 border-primary/20">
            <div className="space-y-0.5">
              <p className="font-semibold">Auto-salvar contato no CRM ao receber notificação</p>
              <p className="text-[11px] text-muted-foreground">
                Cria ou atualiza automaticamente a conversa em <code>marketing_zap_conversations</code> e aciona o agente IA vinculado.
              </p>
            </div>
            <Switch checked={autoSaveContact} onCheckedChange={setAutoSaveContact} />
          </div>

          <div className="rounded-xl border p-3 space-y-1.5">
            <p className="font-semibold">Passo a passo (MacroDroid / Tasker / App NotificationListener)</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground">
              <li>Crie um gatilho para notificações recebidas dos pacotes <code>com.whatsapp</code> ou <code>com.whatsapp.w4b</code>.</li>
              <li>Extraia título como <code>sender_name</code>, texto como <code>message_text</code> e número se disponível.</li>
              <li>Configure uma ação HTTP POST para a URL acima com o header <code>x-android-bridge-secret</code>.</li>
              <li>A resposta da IA pode ser respondida direto via <em>Direct Reply</em> na notificação do Android ou via chip Evolution pareado.</li>
            </ol>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t bg-background px-4 sm:px-6 py-3 flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Entendido
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
