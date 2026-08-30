import { useState, useMemo } from "react";
import { Lock, Loader2, ShieldCheck, CreditCard as CardIcon, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectCardBrand, validateLuhn, validateExpiry, validateCvv, validateCardHolder, CardBrand } from "@/utils/creditCardValidator";
import { toast } from "sonner";

export interface CardFormData {
  holderName: string;
  number: string;
  expiry: string;
  ccv: string;
  holderCpf: string;
  holderPhone: string;
  holderPostalCode: string;
  holderAddressNumber: string;
}

interface CreditCardCheckoutTabProps {
  cardForm: CardFormData;
  setCardForm: React.Dispatch<React.SetStateAction<CardFormData>>;
  installments: string;
  setInstallments: (v: string) => void;
  rawTotal: number;
  cycle: "annual" | "quarterly" | "monthly";
  processing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  invoiceUrl?: string | null;
}

const BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  unknown: "Cartão de Crédito",
};

export function CreditCardCheckoutTab({
  cardForm,
  setCardForm,
  installments,
  setInstallments,
  rawTotal,
  cycle,
  processing,
  onSubmit,
  invoiceUrl,
}: CreditCardCheckoutTabProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const cardBrand = useMemo(() => detectCardBrand(cardForm.number), [cardForm.number]);
  const isLuhnValid = useMemo(() => {
    const clean = cardForm.number.replace(/\D/g, "");
    return clean.length >= 13 ? validateLuhn(clean) : true;
  }, [cardForm.number]);

  const expiryCheck = useMemo(() => {
    if (!cardForm.expiry || cardForm.expiry.length < 5) return { valid: true };
    return validateExpiry(cardForm.expiry);
  }, [cardForm.expiry]);

  const isHolderValid = useMemo(() => {
    if (!cardForm.holderName) return true;
    return validateCardHolder(cardForm.holderName);
  }, [cardForm.holderName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "number") {
      const clean = value.replace(/\D/g, "").slice(0, 16);
      const formatted = clean.replace(/(\d{4})(?=\d)/g, "$1 ");
      setCardForm((prev) => ({ ...prev, number: formatted }));
      return;
    }
    if (name === "expiry") {
      const clean = value.replace(/\D/g, "").slice(0, 4);
      const formatted = clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean;
      setCardForm((prev) => ({ ...prev, expiry: formatted }));
      return;
    }
    if (name === "ccv") {
      const clean = value.replace(/\D/g, "").slice(0, cardBrand === "amex" ? 4 : 4);
      setCardForm((prev) => ({ ...prev, ccv: clean }));
      return;
    }
    setCardForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCard = cardForm.number.replace(/\D/g, "");
    const cleanCvv = cardForm.ccv.replace(/\D/g, "");

    if (!validateCardHolder(cardForm.holderName)) {
      toast.error("Informe o nome completo impresso no cartão.");
      return;
    }
    if (!validateLuhn(cleanCard)) {
      toast.error("Número de cartão inválido (dígito verificador incorreto).");
      return;
    }
    const expValidation = validateExpiry(cardForm.expiry);
    if (!expValidation.valid) {
      toast.error(expValidation.error || "Data de validade inválida.");
      return;
    }
    if (!validateCvv(cleanCvv, cardBrand)) {
      toast.error("Código de segurança (CVV) inválido.");
      return;
    }

    onSubmit(e);
  };

  const installmentNum = parseInt(installments, 10) || 1;
  const installmentValue = (rawTotal / installmentNum).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Cartão Virtual Interativo */}
      <div className="p-5 rounded-3xl bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-950 border border-neutral-700/60 shadow-2xl relative overflow-hidden text-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CardIcon className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              {BRAND_LABELS[cardBrand]}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Criptografia Ponta a Ponta</span>
          </div>
        </div>

        <div className="space-y-4 font-mono">
          <div className="text-lg sm:text-2xl font-bold tracking-widest text-white">
            {cardForm.number || "•••• •••• •••• ••••"}
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-300">
            <div>
              <span className="text-[9px] uppercase tracking-wider block text-neutral-400">Titular</span>
              <span className="font-sans font-semibold uppercase">{cardForm.holderName || "NOME DO TITULAR"}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider block text-neutral-400">Validade</span>
              <span>{cardForm.expiry || "MM/AA"}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seletor de Parcelamento */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">Opções de Parcelamento Sem Juros</Label>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger className="bg-background border-input text-foreground h-11 rounded-xl text-xs sm:text-sm">
              <SelectValue placeholder="Selecione o parcelamento" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="1">1x de R$ {rawTotal.toFixed(2)} (À vista)</SelectItem>
              {cycle === "annual" && (
                <>
                  <SelectItem value="2">2x de R$ {(rawTotal / 2).toFixed(2)}</SelectItem>
                  <SelectItem value="3">3x de R$ {(rawTotal / 3).toFixed(2)}</SelectItem>
                  <SelectItem value="6">6x de R$ {(rawTotal / 6).toFixed(2)}</SelectItem>
                  <SelectItem value="12">12x de R$ {(rawTotal / 12).toFixed(2)} (Sem juros)</SelectItem>
                </>
              )}
              {cycle === "quarterly" && (
                <>
                  <SelectItem value="2">2x de R$ {(rawTotal / 2).toFixed(2)}</SelectItem>
                  <SelectItem value="3">3x de R$ {(rawTotal / 3).toFixed(2)} (Sem juros)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Nome do Titular */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">Nome Impresso no Cartão *</Label>
          <Input
            name="holderName"
            placeholder="NOME COMPLETO IGUAL AO CARTÃO"
            value={cardForm.holderName}
            onChange={handleInputChange}
            onBlur={() => handleBlur("holderName")}
            required
            className={`bg-background border-input text-foreground font-mono uppercase h-11 text-xs sm:text-sm rounded-xl ${
              touched.holderName && !isHolderValid ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
          />
          {touched.holderName && !isHolderValid && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Informe o nome completo como impresso no cartão.
            </p>
          )}
        </div>

        {/* Número do Cartão */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">Número do Cartão *</Label>
            {cardBrand !== "unknown" && (
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                Bandeira: {BRAND_LABELS[cardBrand]}
              </span>
            )}
          </div>
          <Input
            name="number"
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            value={cardForm.number}
            onChange={handleInputChange}
            onBlur={() => handleBlur("number")}
            required
            className={`bg-background border-input text-foreground font-mono h-11 text-xs sm:text-sm rounded-xl ${
              touched.number && !isLuhnValid ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
          />
          {touched.number && !isLuhnValid && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Número de cartão inválido. Verifique os dígitos digitados.
            </p>
          )}
        </div>

        {/* Validade e CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Validade (MM/AA) *</Label>
            <Input
              name="expiry"
              placeholder="MM/AA"
              maxLength={5}
              value={cardForm.expiry}
              onChange={handleInputChange}
              onBlur={() => handleBlur("expiry")}
              required
              className={`bg-background border-input text-foreground font-mono h-11 text-xs sm:text-sm rounded-xl ${
                touched.expiry && !expiryCheck.valid ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {touched.expiry && !expiryCheck.valid && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {expiryCheck.error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Código de Segurança (CVV) *</Label>
            <Input
              name="ccv"
              placeholder={cardBrand === "amex" ? "1234" : "123"}
              maxLength={4}
              value={cardForm.ccv}
              onChange={handleInputChange}
              onBlur={() => handleBlur("ccv")}
              required
              className="bg-background border-input text-foreground font-mono h-11 text-xs sm:text-sm rounded-xl"
            />
          </div>
        </div>

        {/* Botão de Envio */}
        <Button
          type="submit"
          disabled={processing || !isLuhnValid || (touched.expiry && !expiryCheck.valid)}
          className="w-full bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-semibold h-12 rounded-xl text-sm shadow-xl shadow-primary/20 transition-all mt-4"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processando e validando transação com o Asaas...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Pagar em {installments}x de R$ {installmentValue} e Ativar Espaço
            </>
          )}
        </Button>

        {/* Garantias de Segurança Bancária */}
        <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>PCI-DSS Level 1 Compliance Oficial</span>
          </div>
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <span>Pagar no Site do Asaas</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
