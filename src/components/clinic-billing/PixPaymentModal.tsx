import React from "react";
import { QrCode, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PixInvoiceData {
  id: string;
  value: number;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  pix_copia_e_cola?: string | null;
}

export interface PixPaymentModalProps {
  invoice: PixInvoiceData | null;
  onClose: () => void;
  copiedPix: boolean;
  onCopyPix: (code: string) => void;
}

/**
 * Modal para Pagamento Instantâneo via PIX com QR Code dinâmico e código Copia e Cola.
 *
 * Racional de Negócio:
 * - Reduz tempo de compensação de pagamentos (confirmação imediata via Webhook Asaas).
 * - Oferece 5% de desconto promocional nativo no fluxo de pagamento.
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const PixPaymentModal: React.FC<PixPaymentModalProps> = React.memo(({
  invoice,
  onClose,
  copiedPix,
  onCopyPix,
}) => {
  const pixCode = invoice?.pix_copy_paste || invoice?.pix_copia_e_cola || "";

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-500" />
            Pagamento via PIX Oficial
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Escaneie o QR Code ou copie a chave abaixo no app do seu banco.
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4 py-2 text-center">
            {invoice.pix_qr_code ? (
              <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto">
                <img
                  src={invoice.pix_qr_code.startsWith("data:") ? invoice.pix_qr_code : `data:image/png;base64,${invoice.pix_qr_code}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-muted/60 border text-center text-xs text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-60" />
                QR Code gerado para cobrança Asaas
              </div>
            )}

            <div className="text-lg font-bold text-foreground">
              Valor: <span className="text-emerald-500">R$ {Number(invoice.value).toFixed(2)}</span>
            </div>

            {pixCode && (
              <div className="space-y-2 text-left">
                <Label className="text-xs font-semibold text-foreground">PIX Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={pixCode}
                    className="h-10 text-xs font-mono bg-muted select-all"
                  />
                  <Button
                    type="button"
                    onClick={() => onCopyPix(pixCode)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-10 px-3 min-h-[40px]"
                    aria-label="Copiar código PIX"
                  >
                    {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

PixPaymentModal.displayName = "PixPaymentModal";
