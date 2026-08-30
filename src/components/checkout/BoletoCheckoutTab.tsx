import { useState } from "react";
import { FileText, Loader2, Calendar, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BoletoCheckoutTabProps {
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  rawTotal: number;
  identificationField?: string | null;
  barCode?: string | null;
  onGenerateBoleto?: () => void;
  generatingBoleto?: boolean;
}

export function BoletoCheckoutTab({
  bankSlipUrl,
  invoiceUrl,
  rawTotal,
  identificationField,
  barCode,
  onGenerateBoleto,
  generatingBoleto = false,
}: BoletoCheckoutTabProps) {
  const [copied, setCopied] = useState(false);
  const targetUrl = bankSlipUrl || invoiceUrl;
  const linhaDigitavel = identificationField || barCode;
  const hasBoletoData = Boolean(targetUrl || linhaDigitavel);

  const handleCopyLinhaDigitavel = () => {
    if (!linhaDigitavel) return;
    navigator.clipboard.writeText(linhaDigitavel);
    setCopied(true);
    toast.success("Linha digitável copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-700 dark:text-purple-300 flex items-start gap-3 shadow-sm">
        <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
          <Calendar className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-bold text-foreground text-sm">Boleto Bancário Registrado</p>
          <p className="text-muted-foreground leading-relaxed">
            O boleto registrado pelo Asaas pode ser pago em qualquer banco, aplicativo ou casa lotérica até o vencimento. A compensação bancária ocorre em 1 a 3 dias úteis com ativação automática do seu espaço.
          </p>
        </div>
      </div>

      <div className="text-center py-2 space-y-5">
        {hasBoletoData ? (
          <>
            {/* Linha Digitável */}
            {linhaDigitavel && (
              <div className="w-full max-w-lg space-y-1.5 text-left mx-auto">
                <Label className="text-xs font-semibold text-foreground">Linha Digitável / Código de Barras</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={linhaDigitavel}
                    className="h-11 text-xs font-mono bg-background border-border text-foreground rounded-xl select-all focus-visible:ring-purple-500"
                  />
                  <Button
                    type="button"
                    onClick={handleCopyLinhaDigitavel}
                    className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 h-11 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "Copiado!" : "Copiar"}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Botão de Abrir Boleto */}
            {targetUrl && (
              <div className="pt-2">
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto h-12 px-8 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-xl shadow-purple-600/25 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Visualizar e Imprimir Boleto Bancário Oficial</span>
                  <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                </a>
              </div>
            )}

            {/* Live Status */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/60 px-4 py-2 rounded-full border border-border w-fit mx-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
              <span>Aguardando compensação bancária pelo Asaas...</span>
            </div>
          </>
        ) : (
          <div className="w-full p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-semibold text-foreground text-base">Boleto Bancário Registrado</h3>
              <p className="text-xs text-muted-foreground">
                Gere o boleto bancário oficial de R$ {rawTotal.toFixed(2)} para pagamento em qualquer banco ou aplicativo financeiro.
              </p>
            </div>
            {onGenerateBoleto && (
              <Button
                type="button"
                onClick={onGenerateBoleto}
                disabled={generatingBoleto}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 px-8 rounded-xl text-sm shadow-xl shadow-purple-600/20 transition-all inline-flex items-center gap-2 mx-auto"
              >
                {generatingBoleto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando Boleto Bancário...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Gerar Boleto Bancário</span>
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
