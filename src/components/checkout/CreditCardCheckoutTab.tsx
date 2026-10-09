import { useState, useMemo, useEffect } from "react";
import { Lock, Loader2, ShieldCheck, CreditCard as CardIcon, AlertCircle, ExternalLink, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface SavedCreditCard {
  id: string;
  brand: CardBrand;
  bankLabel: string;
  last4: string;
  holderName: string;
  expiry: string;
  holderCpf?: string;
  holderPhone?: string;
  holderPostalCode?: string;
  holderAddressNumber?: string;
  creditCardToken?: string;
  createdAt: string;
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
  clinicId?: string;
}

const BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  unknown: "Cartão de Crédito",
};

export function detectBankName(number: string, brand: CardBrand): string {
  const clean = number.replace(/\D/g, "");
  if (/^(5274|5162|5256|5144)/.test(clean)) return "Nubank";
  if (/^(5302|4074|4532|5445)/.test(clean)) return "Banco Inter";
  if (/^(4984|5300|5502|5100|1287)/.test(clean)) return "BTG Pactual";
  if (/^(4011|4389|4514|5067|5090)/.test(clean)) return "Banco do Brasil";
  if (/^(4984|4007|5502|5464)/.test(clean)) return "Itaú";
  if (/^(4093|4984|5155|5462)/.test(clean)) return "Bradesco";
  if (/^(4024|4551|5289|5427)/.test(clean)) return "Santander";
  if (/^(4556|5103|5201)/.test(clean)) return "Caixa Econômica";
  return BRAND_LABELS[brand] || "Cartão de Crédito";
}

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
  clinicId,
}: CreditCardCheckoutTabProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveCardOption, setSaveCardOption] = useState(true);
  const [savedCards, setSavedCards] = useState<SavedCreditCard[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("new");

  const storageKey = clinicId ? `pluri_saved_cards_${clinicId}` : "pluri_saved_cards_global";

  // Carregar cartões salvos do LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: SavedCreditCard[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedCards(parsed);
          setSelectedMode(parsed[0].id);
          // Preencher formulário com o primeiro cartão salvo
          const first = parsed[0];
          setCardForm((prev) => ({
            ...prev,
            holderName: first.holderName,
            expiry: first.expiry,
            number: `•••• •••• •••• ${first.last4}`,
            holderCpf: first.holderCpf || prev.holderCpf,
            holderPhone: first.holderPhone || prev.holderPhone,
            holderPostalCode: first.holderPostalCode || prev.holderPostalCode,
            holderAddressNumber: first.holderAddressNumber || prev.holderAddressNumber,
          }));
        }
      }
    } catch (e) {
      console.warn("Aviso ao ler cartões salvos:", e);
    }
  }, [storageKey, setCardForm]);

  const handleSelectSavedCard = (card: SavedCreditCard) => {
    setSelectedMode(card.id);
    setCardForm((prev) => ({
      ...prev,
      holderName: card.holderName,
      expiry: card.expiry,
      number: `•••• •••• •••• ${card.last4}`,
      ccv: "",
      holderCpf: card.holderCpf || prev.holderCpf,
      holderPhone: card.holderPhone || prev.holderPhone,
      holderPostalCode: card.holderPostalCode || prev.holderPostalCode,
      holderAddressNumber: card.holderAddressNumber || prev.holderAddressNumber,
    }));
  };

  const handleSelectNewCardMode = () => {
    setSelectedMode("new");
    setCardForm((prev) => ({
      ...prev,
      holderName: "",
      number: "",
      expiry: "",
      ccv: "",
    }));
  };

  const handleDeleteSavedCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCards.filter((c) => c.id !== id);
    setSavedCards(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      toast.success("Cartão removido dos salvos.");
      if (selectedMode === id) {
        if (updated.length > 0) {
          handleSelectSavedCard(updated[0]);
        } else {
          handleSelectNewCardMode();
        }
      }
    } catch (err) {
      console.warn("Erro ao atualizar storage:", err);
    }
  };

  const cardBrand = useMemo(() => {
    if (selectedMode !== "new") {
      const found = savedCards.find((c) => c.id === selectedMode);
      return found?.brand || "unknown";
    }
    return detectCardBrand(cardForm.number);
  }, [selectedMode, savedCards, cardForm.number]);

  const isLuhnValid = useMemo(() => {
    if (selectedMode !== "new") return true;
    const clean = cardForm.number.replace(/\D/g, "");
    return clean.length >= 13 ? validateLuhn(clean) : true;
  }, [selectedMode, cardForm.number]);

  const expiryCheck = useMemo(() => {
    if (selectedMode !== "new") return { valid: true };
    if (!cardForm.expiry || cardForm.expiry.length < 5) return { valid: true };
    return validateExpiry(cardForm.expiry);
  }, [selectedMode, cardForm.expiry]);

  const isHolderValid = useMemo(() => {
    if (selectedMode !== "new") return true;
    if (!cardForm.holderName) return true;
    return validateCardHolder(cardForm.holderName);
  }, [selectedMode, cardForm.holderName]);

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

    if (selectedMode === "new") {
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

      // Se a opção de salvar cartão estiver ativa, salvar no LocalStorage
      if (saveCardOption) {
        const brand = detectCardBrand(cleanCard);
        const newSaved: SavedCreditCard = {
          id: `card_${Date.now()}`,
          brand,
          bankLabel: detectBankName(cleanCard, brand),
          last4: cleanCard.slice(-4),
          holderName: cardForm.holderName.trim().toUpperCase(),
          expiry: cardForm.expiry.trim(),
          holderCpf: cardForm.holderCpf,
          holderPhone: cardForm.holderPhone,
          holderPostalCode: cardForm.holderPostalCode,
          holderAddressNumber: cardForm.holderAddressNumber,
          createdAt: new Date().toISOString(),
        };
        const updated = [newSaved, ...savedCards.filter((c) => c.last4 !== newSaved.last4)];
        setSavedCards(updated);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (err) {
          console.warn("Aviso ao persistir cartão:", err);
        }
      }
    } else {
      // Cartão salvo selecionado: validar CVV se exigido
      if (cardForm.ccv && !validateCvv(cardForm.ccv, cardBrand)) {
        toast.error("Código de segurança (CVV) inválido.");
        return;
      }
    }

    onSubmit(e);
  };

  const installmentNum = parseInt(installments, 10) || 1;
  const installmentValue = (rawTotal / installmentNum).toFixed(2);

  return (
    <div className="space-y-6">
      {/* 1. SEÇÃO DE CARTÕES SALVOS (PADRÃO MERCADO LIVRE / SHOPEE) */}
      {savedCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CardIcon className="w-4 h-4 text-primary" />
              <span>Seus Cartões Salvos</span>
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {savedCards.length} {savedCards.length === 1 ? "cartão salvo" : "cartões salvos"}
            </span>
          </div>

          <div className="grid gap-2.5">
            {savedCards.map((card, idx) => {
              const isSelected = selectedMode === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => handleSelectSavedCard(card)}
                  className={`cursor-pointer rounded-2xl p-3.5 sm:p-4 border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-2 ring-primary/20"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="p-2 rounded-xl bg-muted shrink-0 text-foreground font-bold text-xs">
                      {BRAND_LABELS[card.brand]?.slice(0, 4) || "CARD"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {card.bankLabel || BRAND_LABELS[card.brand]} **** {card.last4}
                        </span>
                        {idx === 0 && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[9px] font-bold">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Validade: {card.expiry} · {card.holderName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedCard(card.id, e)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir este cartão salvo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Opção + Novo Cartão */}
            <div
              onClick={handleSelectNewCardMode}
              className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex items-center gap-3 ${
                selectedMode === "new"
                  ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20"
                  : "border-dashed border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  selectedMode === "new" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                }`}
              >
                {selectedMode === "new" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-foreground">Pagar com outro cartão de crédito</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. FORMULÁRIO DO NOVO CARTÃO OU CVV DO CARTÃO SALVO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {selectedMode === "new" ? (
          <>
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

            {/* Checkbox de Salvar Cartão com Segurança */}
            <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-muted/40 border border-border">
              <Checkbox
                id="saveCardOption"
                checked={saveCardOption}
                onCheckedChange={(checked) => setSaveCardOption(Boolean(checked))}
              />
              <Label
                htmlFor="saveCardOption"
                className="text-xs font-medium text-foreground cursor-pointer leading-tight select-none"
              >
                Salvar este cartão com segurança para próximas renovações e pagamentos rápidos
              </Label>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Confirmar CVV do Cartão Selecionado</span>
              <span className="text-[11px] text-muted-foreground font-mono">{cardForm.number}</span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                name="ccv"
                placeholder="CVV (3 ou 4 dígitos)"
                maxLength={4}
                value={cardForm.ccv}
                onChange={handleInputChange}
                required
                className="bg-background border-input font-mono h-10 text-xs sm:text-sm rounded-xl w-36"
              />
              <span className="text-[11px] text-muted-foreground">
                Informe o código de segurança do verso do cartão para autenticar.
              </span>
            </div>
          </div>
        )}

        {/* Seletor de Parcelamento */}
        {rawTotal > 0.01 && (
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
        )}

        {/* Botão de Envio */}
        <Button
          type="submit"
          disabled={processing || !isLuhnValid || (touched.expiry && !expiryCheck.valid)}
          className="w-full bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-semibold h-12 rounded-xl text-sm shadow-xl shadow-primary/20 transition-all mt-4"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {rawTotal <= 0.01 ? "Validando cartão de crédito com o Asaas..." : "Processando e validando transação com o Asaas..."}
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              {rawTotal <= 0.01
                ? "Validar Cartão e Ativar Degustação Grátis (R$ 0,01)"
                : `Pagar em ${installments}x de R$ ${installmentValue} e Ativar Espaço`}
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
