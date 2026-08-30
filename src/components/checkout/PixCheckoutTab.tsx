import { useState } from "react";
import { QrCode, Copy, Check, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PixCheckoutTabProps {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  pixDiscountTotal: number;
  rawTotal: number;
  periodLabel: string;
  onGeneratePix?: () => void;
  generatingPix?: boolean;
}

export function PixCheckoutTab({
  pixQrCode,
  pixCopyPaste,
  pixDiscountTotal,
  rawTotal,
  periodLabel,
  onGeneratePix,
  generatingPix = false,
}: PixCheckoutTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!pixCopyPaste) return;
    navigator.clipboard.writeText(pixCopyPaste);
    setCopied(true);
    toast.success("Chave PIX Copia e Cola copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  const discountSavings = Math.max(0, rawTotal - pixDiscountTotal);
  const hasPixData = Boolean(pixQrCode || pixCopyPaste);

  return (
    <div className="space-y-6">
      {/* Banner de Desconto Exclusivo */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-3 shadow-sm">
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-bold text-foreground text-sm">Desconto Exclusivo de 5% Aplicado no PIX</p>
          <p className="text-muted-foreground leading-relaxed">
            Economize <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">R$ {discountSavings.toFixed(2)}</strong> pagando à vista via PIX ({periodLabel}). A liberação do seu espaço ocorre em poucos segundos após a confirmação bancária.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-5 py-2">
        {hasPixData ? (
          <>
            {/* QR Code Container */}
            {pixQrCode && (
              <div className="p-4 bg-white rounded-3xl shadow-xl border border-border inline-block relative group">
                <img
                  src={pixQrCode.startsWith("data:") ? pixQrCode : `data:image/png;base64,${pixQrCode}`}
                  alt="QR Code PIX Oficial Asaas"
                  className="w-52 h-52 object-contain"
                />
              </div>
            )}

            {/* PIX Copia e Cola */}
            {pixCopyPaste && (
              <div className="w-full max-w-lg space-y-1.5 text-left">
                <Label className="text-xs font-semibold text-foreground">Chave PIX Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={pixCopyPaste}
                    className="h-11 text-xs font-mono bg-background border-border text-foreground rounded-xl select-all focus-visible:ring-emerald-500"
                  />
                  <Button
                    type="button"
                    onClick={handleCopy}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-11 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copiado!" : "Copiar"}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Status Polling Live */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-4 py-2 rounded-full border border-border">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              <span>Aguardando identificação do pagamento no seu aplicativo do banco...</span>
            </div>
          </>
        ) : (
          <div className="w-full p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <QrCode className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-semibold text-foreground text-base">Pagamento Instantâneo via PIX</h3>
              <p className="text-xs text-muted-foreground">
                Gere o QR Code dinâmico do Banco Central para pagar no aplicativo do seu banco com 5% de desconto à vista.
              </p>
            </div>
            {onGeneratePix && (
              <Button
                type="button"
                onClick={onGeneratePix}
                disabled={generatingPix}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl text-sm shadow-xl shadow-emerald-600/20 transition-all inline-flex items-center gap-2"
              >
                {generatingPix ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando QR Code PIX...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Gerar QR Code PIX (-5% OFF)</span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
