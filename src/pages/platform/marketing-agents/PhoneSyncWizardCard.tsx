import React, { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, QrCode, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_MARKETING_CHIP_DISPLAY, DEFAULT_MARKETING_INSTANCE_KEY } from "./types";

interface PhoneSyncWizardCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  onGenerateQr: () => Promise<void>;
  onVerifyConnection: () => Promise<void>;
}

const ONE_CLICK_CMD = "npm run marketing:conectar-celular";

export const PhoneSyncWizardCard: React.FC<PhoneSyncWizardCardProps> = ({
  isConnected,
  isConnecting,
  onGenerateQr,
  onVerifyConnection,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ONE_CLICK_CMD);
      setCopied(true);
      toast({ title: "Comando copiado!", description: "Cole no terminal da pasta do projeto." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copie manualmente: npm run marketing:conectar-celular" });
    }
  };

  return (
    <Card
      data-testid="phone-sync-wizard-card"
      className="border-emerald-500/30 bg-emerald-500/5"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
            Sincronizar Celular {DEFAULT_MARKETING_CHIP_DISPLAY} em 4 Passos Simples
          </CardTitle>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? "Sincronizado" : "Pronto para parear"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Jeito mais rápido (custo R$ 0): sobe o conector WhatsApp automaticamente e exibe o QR Code.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background/80 p-3 space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                1
              </span>
              Ligue o conector no seu computador
            </p>
            <p className="text-muted-foreground">
              Abra o terminal na pasta do projeto e rode este único comando (ele cria a senha e sobe tudo sozinho):
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-2.5 py-2">
              <code className="font-mono text-[11px] break-all">{ONE_CLICK_CMD}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="min-h-[36px] shrink-0 gap-1"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-background/80 p-3 space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                2
              </span>
              Abra o QR Code na tela
            </p>
            <p className="text-muted-foreground">
              Clique em <strong>Gerar QR Code aqui</strong> ou abra o painel local da Evolution API para ler o código da instância{" "}
              <code>{DEFAULT_MARKETING_INSTANCE_KEY}</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isConnecting}
                onClick={() => void onGenerateQr()}
                className="min-h-[40px] gap-1.5"
              >
                <QrCode className="h-4 w-4" />
                <span>{isConnecting ? "Gerando..." : "Gerar QR Code aqui"}</span>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild className="min-h-[40px] gap-1.5">
                <a href="http://127.0.0.1:8085/manager" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Abrir Painel Local</span>
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-background/80 p-3 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                3
              </span>
              Escaneie no celular {DEFAULT_MARKETING_CHIP_DISPLAY}
            </p>
            <p className="text-muted-foreground">
              No WhatsApp do celular de marketing: toque em <strong>Configurações</strong> (ou 3 pontinhos) →{" "}
              <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code.
            </p>
          </div>

          <div className="rounded-xl border bg-background/80 p-3 space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                4
              </span>
              Confirme a sincronização
            </p>
            <p className="text-muted-foreground">
              Assim que aparecer conectado no celular, clique abaixo para validar o status verde e começar a usar seus agentes.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onVerifyConnection()}
              className="min-h-[40px] gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Confirmar Conexão Agora</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
