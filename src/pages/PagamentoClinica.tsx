import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Building2, 
  CreditCard, 
  QrCode, 
  FileText, 
  ArrowLeft, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { processAsaasPayment, checkAsaasPaymentStatus, getPixQrCode } from "@/services/asaasService";
import { calculatePlanPrice, type CouponDiscount } from "@/utils/subscriptionPricing";
import { formatOwnerDocument, validateCPF, validateCNPJ } from "@/lib/owner-document";
import { CheckoutSummaryCard } from "@/components/checkout/CheckoutSummaryCard";
import { PixCheckoutTab } from "@/components/checkout/PixCheckoutTab";
import { CreditCardCheckoutTab, CardFormData } from "@/components/checkout/CreditCardCheckoutTab";
import { BoletoCheckoutTab } from "@/components/checkout/BoletoCheckoutTab";
import { PaymentSuccessView } from "@/components/checkout/PaymentSuccessView";
import { PaymentRefusalAlert } from "@/components/checkout/PaymentRefusalAlert";
import { toast } from "sonner";

interface SubscriptionDetails {
  id: string;
  clinic_id: string;
  plan_type: "solo" | "clinic" | "enterprise";
  billing_cycle?: "ANNUAL" | "QUARTERLY" | "MONTHLY";
  status: string;
  total_recurring_monthly_price: number;
  payment_method: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  coupon_code: string | null;
  discount_percentage: number | null;
  discount_fixed_amount: number | null;
  next_due_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface InvoiceDetails {
  id: string;
  asaas_payment_id: string;
  status: string;
  value: number;
  due_date: string;
  billing_type: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  identification_field?: string | null;
  bar_code?: string | null;
}

export default function PagamentoClinica() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshAuthState, selectClinic } = useAuth();

  const isTrial = searchParams.get("trial") === "true";
  const cycleParam = (searchParams.get("cycle") || "annual").toLowerCase() as "annual" | "quarterly" | "monthly";
  const planParam = (searchParams.get("plan") || "solo") as "solo" | "clinic" | "enterprise";
  const defaultConcurrent = planParam === "enterprise" ? 10 : planParam === "clinic" ? 4 : 1;
  const concurrentParam = parseInt(searchParams.get("concurrent") || String(defaultConcurrent), 10);
  const couponParam = searchParams.get("coupon") || undefined;
  const extraSeatsCount = planParam === "enterprise"
    ? Math.max(0, concurrentParam - 10)
    : planParam === "clinic"
    ? Math.max(0, concurrentParam - 4)
    : 0;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isTrial ? "card" : "pix");
  const [clinicData, setClinicData] = useState<any>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentRefused, setPaymentRefused] = useState(false);
  const [refusalMessage, setRefusalMessage] = useState("");
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [generatingBoleto, setGeneratingBoleto] = useState(false);

  // Parcelas do cartão
  const [installments, setInstallments] = useState(isTrial ? "1" : cycleParam === "annual" ? "12" : cycleParam === "quarterly" ? "3" : "1");

  // Documento Fiscal de Cobrança (CPF ou CNPJ)
  const [billingCpfCnpj, setBillingCpfCnpj] = useState("");

  // Form do Cartão de Crédito
  const [cardForm, setCardForm] = useState<CardFormData>({
    holderName: "",
    number: "",
    expiry: "",
    ccv: "",
    holderCpf: "",
    holderPhone: "",
    holderPostalCode: "",
    holderAddressNumber: "",
  });
  const [processingCard, setProcessingCard] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDiscount | null>(null);

  const hasLoadedInitialRef = useRef(false);

  // Validação do cupom recebido via query param
  useEffect(() => {
    if (!couponParam) return;
    let isMounted = true;
    async function validateUrlCoupon() {
      try {
        const { data, error } = await supabase.rpc("validate_subscription_coupon", {
          _code: couponParam!.trim().toUpperCase(),
          _plan_type: planParam,
          _clinic_id: clinicId || null,
          _billing_cycle: cycleParam,
        });
        if (!error && data?.valid && isMounted) {
          setAppliedCoupon({
            code: data.code || couponParam!.trim().toUpperCase(),
            discount_type: data.discount_type,
            discount_value: data.discount_value,
          });
        }
      } catch (err) {
        console.warn("Falha ao validar cupom da URL:", err);
      }
    }
    validateUrlCoupon();
    return () => {
      isMounted = false;
    };
  }, [couponParam, planParam]);

  // Cálculo determinístico do plano atual
  const pricing = calculatePlanPrice({
    planType: planParam,
    billingCycle: cycleParam,
    additionalSeats: extraSeatsCount,
    coupon: appliedCoupon,
  });

  const fetchPaymentDetails = useCallback(async (isInitial = false) => {
    if (!clinicId) return;
    if (isInitial && !hasLoadedInitialRef.current) {
      setLoading(true);
    }
    setRefreshingStatus(true);

    try {
      // 1. Buscar Clínica
      const { data: clinic, error: clinicErr } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", clinicId)
        .single();

      if (clinicErr || !clinic) {
        toast.error("Clínica não encontrada.");
        navigate("/espacopessoal");
        return;
      }
      setClinicData(clinic);

      const initialDoc = clinic.cnpj || profile?.cpf || "";
      setBillingCpfCnpj(formatOwnerDocument(initialDoc));

      // Pré-preencher dados do cartão se vazios
      setCardForm((prev) => ({
        ...prev,
        holderCpf: prev.holderCpf || clinic.cnpj || profile?.cpf || "",
        holderPhone: prev.holderPhone || clinic.phone || profile?.phone || "",
        holderPostalCode: prev.holderPostalCode || (clinic.address && typeof clinic.address === "object" ? (clinic.address as { cep?: string }).cep || "" : ""),
        holderAddressNumber: prev.holderAddressNumber || (clinic.address && typeof clinic.address === "object" ? (clinic.address as { number?: string }).number || "" : "SN"),
      }));

      // 2. Buscar Assinatura em clinic_subscriptions
      const { data: sub } = await supabase
        .from("clinic_subscriptions")
        .select("*")
        .eq("clinic_id", clinicId)
        .single();

      if (sub) {
        setSubscription(sub as unknown as SubscriptionDetails);
        if (sub.status === "ACTIVE") {
          setPaymentConfirmed(true);
        }
      }

      // 3. Buscar Fatura Existente em subscription_invoices
      const { data: invList } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (invList && invList.length > 0) {
        let currentInv = invList[0] as unknown as InvoiceDetails;

        // Se a fatura salva for PIX e não tiver o QR Code em memória, buscar via Edge Function sem mutação no banco
        if (currentInv.billing_type === "PIX" && !currentInv.pix_qr_code && currentInv.asaas_payment_id && currentInv.asaas_payment_id !== "temp") {
          try {
            const qrData = await getPixQrCode(currentInv.asaas_payment_id, clinicId);
            if (qrData) {
              currentInv = {
                ...currentInv,
                pix_qr_code: qrData.encodedImage,
                pix_copy_paste: qrData.payload,
              };
            }
          } catch (qrFetchErr) {
            console.warn("Aviso ao carregar QR code:", qrFetchErr);
          }
        }

        setInvoice(currentInv);

        if (
          currentInv.status === "RECEIVED" ||
          currentInv.status === "CONFIRMED" ||
          currentInv.status === "RECEIVED_IN_CASH"
        ) {
          setPaymentConfirmed(true);
          setPaymentRefused(false);
        } else if (!isInitial && currentInv.asaas_payment_id) {
          // Apenas em verificações manuais, consultar status no gateway
          try {
            const asaasStatus = await checkAsaasPaymentStatus(
              currentInv.asaas_payment_id,
              sub?.asaas_subscription_id,
              sub?.asaas_customer_id,
              clinicId
            );

            if (asaasStatus.confirmed) {
              setPaymentConfirmed(true);
              setPaymentRefused(false);
              setInvoice((prev) => (prev ? { ...prev, status: "RECEIVED" } : null));
              toast.success("Pagamento confirmado!");
            } else if (asaasStatus.refused) {
              setPaymentRefused(true);
              setRefusalMessage("A cobrança foi recusada pela instituição financeira ou expirou.");
              setInvoice((prev) => (prev ? { ...prev, status: asaasStatus.status } : null));
            }
          } catch (asaasCheckErr) {
            console.warn("Aviso ao checar status da fatura:", asaasCheckErr);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados de pagamento:", err);
    } finally {
      hasLoadedInitialRef.current = true;
      setLoading(false);
      setRefreshingStatus(false);
    }
  }, [clinicId, navigate, profile?.cpf, profile?.phone]);

  useEffect(() => {
    fetchPaymentDetails(true);
  }, [fetchPaymentDetails]);

  // Supabase Realtime: Escutar atualizações e inserções na tabela subscription_invoices
  useEffect(() => {
    if (!clinicId) return;

    const channel = supabase
      .channel(`invoice-status-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscription_invoices",
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (!newRecord) return;

          setInvoice((prev) => ({
            id: newRecord.id || prev?.id || "temp",
            asaas_payment_id: newRecord.asaas_payment_id || prev?.asaas_payment_id || "",
            status: newRecord.status || prev?.status || "PENDING",
            value: newRecord.value || prev?.value || 0,
            due_date: newRecord.due_date || prev?.due_date || "",
            billing_type: newRecord.billing_type || prev?.billing_type || "PIX",
            invoice_url: newRecord.invoice_url ?? prev?.invoice_url ?? null,
            bank_slip_url: newRecord.bank_slip_url ?? prev?.bank_slip_url ?? null,
            pix_qr_code: newRecord.pix_qr_code ?? prev?.pix_qr_code ?? null,
            pix_copy_paste: newRecord.pix_copy_paste ?? prev?.pix_copy_paste ?? null,
            identification_field: newRecord.identification_field ?? prev?.identification_field ?? null,
            bar_code: newRecord.bar_code ?? prev?.bar_code ?? null,
          }));

          if (
            newRecord.status === "CONFIRMED" ||
            newRecord.status === "RECEIVED" ||
            newRecord.status === "RECEIVED_IN_CASH"
          ) {
            setPaymentConfirmed(true);
            setPaymentRefused(false);
            toast.success("Pagamento confirmado com sucesso! Sua clínica está ativa.");
          } else if (newRecord.status === "REFUSED" || newRecord.status === "OVERDUE") {
            setPaymentRefused(true);
            setRefusalMessage("A cobrança foi recusada pela instituição financeira ou expirou.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  // Helper de validação do CPF ou CNPJ de cobrança
  const validateBillingDocument = () => {
    const clean = billingCpfCnpj.replace(/\D/g, "");
    if (!clean) {
      toast.error("Por favor, preencha o CPF ou CNPJ para emissão da cobrança.");
      return false;
    }
    if (clean.length === 11 && !validateCPF(clean)) {
      toast.error("O CPF informado é inválido. Por favor, revise os dígitos.");
      return false;
    }
    if (clean.length === 14 && !validateCNPJ(clean)) {
      toast.error("O CNPJ informado é inválido. Por favor, revise os dígitos.");
      return false;
    }
    if (clean.length !== 11 && clean.length !== 14) {
      toast.error("O documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).");
      return false;
    }
    return true;
  };

  // Geração sob demanda do QR Code PIX
  const handleGeneratePix = async () => {
    if (!clinicId) return;
    if (!validateBillingDocument()) return;

    setGeneratingPix(true);
    setPaymentRefused(false);
    setRefusalMessage("");

    try {
      const result = await processAsaasPayment({
        action: "CREATE",
        clinic_id: clinicId,
        plan_type: planParam,
        billing_cycle: cycleParam,
        billing_type: "PIX",
        cpf_cnpj: billingCpfCnpj || clinicData?.cnpj || profile?.cpf,
        billing_name: clinicData?.name,
        billing_email: clinicData?.email || (user?.email || ""),
        coupon_code: couponParam,
        additional_seats_count: extraSeatsCount,
      });

      if (!result.success) {
        toast.error(result.error || "Não foi possível gerar a cobrança PIX.");
        return;
      }

      if (result.subscription) {
        setSubscription(result.subscription as unknown as SubscriptionDetails);
      }
      if (result.invoiceUrl || result.pixQrCode || result.invoice) {
        setInvoice({
          id: result.invoice?.id || result.rawResponse?.id || "temp",
          asaas_payment_id: result.invoice?.asaas_payment_id || result.rawResponse?.id || "temp",
          status: result.invoice?.status || "PENDING",
          value: result.invoice?.value || pricing.pixDiscountTotal,
          due_date: result.invoice?.due_date || result.subscription?.next_due_date || "",
          billing_type: "PIX",
          invoice_url: result.invoiceUrl || result.invoice?.invoice_url || null,
          bank_slip_url: result.bankSlipUrl || result.invoice?.bank_slip_url || null,
          pix_qr_code: result.pixQrCode || result.invoice?.pix_qr_code || null,
          pix_copy_paste: result.pixCopyPaste || result.invoice?.pix_copy_paste || null,
          identification_field: result.invoice?.identification_field || result.rawResponse?.identificationField || null,
          bar_code: result.invoice?.bar_code || result.rawResponse?.barCode || null,
        });
        toast.success("QR Code PIX gerado com sucesso!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar cobrança PIX.";
      toast.error(msg);
    } finally {
      setGeneratingPix(false);
    }
  };

  // Geração sob demanda do Boleto Bancário
  const handleGenerateBoleto = async () => {
    if (!clinicId) return;
    if (!validateBillingDocument()) return;

    setGeneratingBoleto(true);
    setPaymentRefused(false);
    setRefusalMessage("");

    try {
      const result = await processAsaasPayment({
        action: "CREATE",
        clinic_id: clinicId,
        plan_type: planParam,
        billing_cycle: cycleParam,
        billing_type: "BOLETO",
        cpf_cnpj: billingCpfCnpj || clinicData?.cnpj || profile?.cpf,
        billing_name: clinicData?.name,
        billing_email: clinicData?.email || (user?.email || ""),
        coupon_code: couponParam,
        additional_seats_count: extraSeatsCount,
      });

      if (!result.success) {
        toast.error(result.error || "Não foi possível gerar o boleto bancário.");
        return;
      }

      if (result.subscription) {
        setSubscription(result.subscription as unknown as SubscriptionDetails);
      }
      if (result.invoiceUrl || result.bankSlipUrl || result.invoice) {
        setInvoice({
          id: result.invoice?.id || result.rawResponse?.id || "temp",
          asaas_payment_id: result.invoice?.asaas_payment_id || result.rawResponse?.id || "temp",
          status: result.invoice?.status || "PENDING",
          value: result.invoice?.value || pricing.periodTotal,
          due_date: result.invoice?.due_date || result.subscription?.next_due_date || "",
          billing_type: "BOLETO",
          invoice_url: result.invoiceUrl || result.invoice?.invoice_url || null,
          bank_slip_url: result.bankSlipUrl || result.invoice?.bank_slip_url || null,
          pix_qr_code: result.pixQrCode || result.invoice?.pix_qr_code || null,
          pix_copy_paste: result.pixCopyPaste || result.invoice?.pix_copy_paste || null,
          identification_field: result.invoice?.identification_field || result.rawResponse?.identificationField || null,
          bar_code: result.invoice?.bar_code || result.rawResponse?.barCode || null,
        });
        toast.success("Boleto bancário gerado com sucesso!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar boleto bancário.";
      toast.error(msg);
    } finally {
      setGeneratingBoleto(false);
    }
  };

  // Processamento do Cartão de Crédito
  const handleProcessCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    if (!validateBillingDocument()) return;

    const cleanCard = cardForm.number.replace(/\D/g, "");
    const cleanCvv = cardForm.ccv.replace(/\D/g, "");
    const cleanExpiry = cardForm.expiry.trim();
    const [expMonth, expYearShort] = cleanExpiry.split("/");

    setProcessingCard(true);
    setPaymentRefused(false);
    setRefusalMessage("");

    try {
      const isTrialCoupon = appliedCoupon?.discount_type === "TRIAL_DAYS";
      const isFreePeriod = isTrial || isTrialCoupon;

      if (isFreePeriod) {
        const result = await processAsaasPayment({
          action: "TOKENIZE_TRIAL_CARD",
          clinic_id: clinicId,
          plan_type: planParam,
          cpf_cnpj: billingCpfCnpj || cardForm.holderCpf || clinicData?.cnpj || profile?.cpf,
          billing_name: clinicData?.name,
          billing_email: clinicData?.email || (user?.email || ""),
          coupon_code: couponParam || appliedCoupon?.code,
          clinic_data: clinicData,
          credit_card_data: {
            card: {
              holderName: cardForm.holderName.trim().toUpperCase(),
              number: cleanCard,
              expiryMonth: expMonth,
              expiryYear: `20${expYearShort}`,
              ccv: cleanCvv,
            },
            holder: {
              name: cardForm.holderName.trim().toUpperCase() || clinicData?.name,
              email: clinicData?.email || (user?.email || ""),
              cpfCnpj: String(billingCpfCnpj || cardForm.holderCpf || clinicData?.cnpj || profile?.cpf || "").replace(/\D/g, ""),
              postalCode: String(cardForm.holderPostalCode || "01001000").replace(/\D/g, ""),
              addressNumber: cardForm.holderAddressNumber || "100",
              phone: String(cardForm.holderPhone || "11999999999").replace(/\D/g, ""),
            },
          },
        });

        if (!result.success) {
          setPaymentConfirmed(false);
          setPaymentRefused(true);
          const errMsg = result.error || "Não foi possível autorizar a verificação no cartão com o emissor.";
          setRefusalMessage(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = isTrialCoupon
          ? `Cartão validado com cobrança de R$ 0,01! Acesso Beta de ${appliedCoupon?.discount_value || 180} dias ativado.`
          : "Cartão validado com cobrança de R$ 0,01! Sua degustação gratuita de 7 dias está ativa.";
        toast.success(successMsg);
        setPaymentConfirmed(true);
        setPaymentRefused(false);

        if (typeof refreshAuthState === "function") {
          await refreshAuthState();
        }
        if (typeof selectClinic === "function") {
          await selectClinic(clinicId);
        }
        return;
      }

      const result = await processAsaasPayment({
        action: "CREATE",
        clinic_id: clinicId,
        plan_type: planParam,
        billing_cycle: cycleParam,
        billing_type: "CREDIT_CARD",
        installment_count: parseInt(installments, 10) || 1,
        cpf_cnpj: billingCpfCnpj || cardForm.holderCpf || clinicData?.cnpj || profile?.cpf,
        billing_name: clinicData?.name,
        billing_email: clinicData?.email || (user?.email || ""),
        coupon_code: couponParam || appliedCoupon?.code,
        additional_seats_count: extraSeatsCount,
        credit_card_data: {
          card: {
            holderName: cardForm.holderName.trim(),
            number: cleanCard,
            expiryMonth: expMonth,
            expiryYear: `20${expYearShort}`,
            ccv: cleanCvv,
          },
          holder: {
            name: cardForm.holderName.trim() || clinicData?.name,
            email: clinicData?.email || (user?.email || ""),
            cpfCnpj: String(cardForm.holderCpf || clinicData?.cnpj || profile?.cpf || "").replace(/\D/g, ""),
            postalCode: String(cardForm.holderPostalCode || "01001000").replace(/\D/g, ""),
            addressNumber: cardForm.holderAddressNumber || "100",
            phone: String(cardForm.holderPhone || "11999999999").replace(/\D/g, ""),
          },
        },
      });

      if (!result.success) {
        setPaymentConfirmed(false);
        setPaymentRefused(true);
        const errMsg = result.error || "Não foi possível autorizar a transação no cartão com o banco emissor.";
        setRefusalMessage(errMsg);
        toast.error(errMsg);
        return;
      }

      toast.success("Pagamento no cartão aprovado com sucesso! Sua clínica está ativa.");
      setPaymentConfirmed(true);
      setPaymentRefused(false);

      if (typeof refreshAuthState === "function") {
        await refreshAuthState();
      }
      if (typeof selectClinic === "function") {
        await selectClinic(clinicId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar cartão de crédito.";
      setPaymentConfirmed(false);
      setPaymentRefused(true);
      setRefusalMessage(msg);
      toast.error(msg);
    } finally {
      setProcessingCard(false);
    }
  };

  const handleFinishAndEnter = async () => {
    if (typeof refreshAuthState === "function") {
      await refreshAuthState();
    }
    if (typeof selectClinic === "function" && clinicId) {
      await selectClinic(clinicId);
    }
    navigate("/espacopessoal", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Conectando com segurança ao gateway Asaas...</p>
      </div>
    );
  }

  const isTrialCoupon = appliedCoupon?.discount_type === "TRIAL_DAYS";
  const isFreePeriod = isTrial || isTrialCoupon;
  const rawTotal = isFreePeriod ? 0.01 : pricing.periodTotal;
  const pixDiscountTotal = isFreePeriod ? 0.01 : pricing.pixDiscountTotal;
  const cycleTitle = isTrialCoupon
    ? `Acesso Beta Gratuito (${appliedCoupon?.discount_value || 180} dias)`
    : isTrial
    ? "Degustação Grátis (7 dias)"
    : pricing.cycleTitle;
  const planTitle =
    planParam === "enterprise"
      ? "Plano Enterprise"
      : planParam === "clinic"
      ? "Plano Clínica com Equipe"
      : "Plano Profissional Solo";

  return (
    <div className="min-h-screen lg:h-[100dvh] bg-background flex flex-col items-center justify-start lg:justify-center py-2 sm:py-4 px-3 sm:px-6 relative overflow-y-auto overflow-x-hidden text-foreground">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/5 rounded-full blur-[100px] sm:blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/5 rounded-full blur-[100px] sm:blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-5xl space-y-3 sm:space-y-4 my-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/espacopessoal")}
            className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-2 min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Espaço Pessoal</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={refreshingStatus}
            onClick={() => fetchPaymentDetails(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs inline-flex items-center gap-1.5 rounded-xl h-8 min-h-[36px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingStatus ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Verificar</span>
          </Button>
        </div>

        {/* Header da Tela Compacto */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>{clinicData?.name || "Minha Clínica"}</span>
            <span>•</span>
            <span>{planTitle}</span>
            <span>•</span>
            <span>{cycleTitle}</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
            Checkout Oficial da Assinatura
          </h1>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            Processamento bancário seguro direto pelo gateway oficial Asaas (PCI-DSS Compliance).
          </p>
        </div>

        {/* Card de Confirmação de Sucesso */}
        {paymentConfirmed ? (
          <PaymentSuccessView
            clinicName={clinicData?.name || "Sua Clínica"}
            planTitle={planTitle}
            onEnter={handleFinishAndEnter}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            {/* Coluna Esquerda: Resumo do Valor (5 colunas) */}
            <div className="lg:col-span-5 space-y-3">
              <CheckoutSummaryCard
                cycleTitle={cycleTitle}
                rawTotal={rawTotal}
                pixDiscountTotal={pixDiscountTotal}
                monthlyEquivalent={isFreePeriod ? 0 : pricing.monthlyEquivalent}
                periodLabel={
                  isTrialCoupon
                    ? `Acesso Beta Gratuito de ${appliedCoupon?.discount_value || 180} dias (cobrança simbólica de R$ 0,01)`
                    : isTrial
                    ? "Degustação Grátis de 7 dias (cobrança simbólica de R$ 0,01)"
                    : pricing.periodLabel
                }
                invoiceUrl={invoice?.invoice_url}
                status={subscription?.status}
              />
            </div>

            {/* Coluna Direita: Painel de Métodos de Pagamento (7 colunas) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Alerta de Falha se Houver */}
              {paymentRefused && (
                <PaymentRefusalAlert
                  refusalMessage={refusalMessage}
                  onDismiss={() => setPaymentRefused(false)}
                />
              )}

              <Card className="border border-border/80 shadow-md">
                <CardHeader className="p-3.5 sm:p-4 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span>{isFreePeriod ? "Validação Obrigatória do Cartão de Crédito" : "Selecione a Forma de Pagamento"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {isFreePeriod
                      ? "Validação antifraude de R$ 0,01 processada e criptografada diretamente pelo gateway Asaas."
                      : "Todas as transações são criptografadas e processadas diretamente pela instituição Asaas."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-3.5 sm:p-4 pt-2">
                  {/* Bloco de Conferência do Documento Fiscal (CPF/CNPJ) */}
                  <div className="mb-3.5 p-3 rounded-xl bg-muted/50 border border-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="billingDocInput" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>CPF ou CNPJ do Titular da Cobrança</span>
                        <span className="text-destructive">*</span>
                      </Label>
                      {billingCpfCnpj && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {billingCpfCnpj.replace(/\D/g, "").length === 11 ? "Pessoa Física (CPF)" : billingCpfCnpj.replace(/\D/g, "").length === 14 ? "Pessoa Jurídica (CNPJ)" : "Preenchendo..."}
                        </span>
                      )}
                    </div>
                    <Input
                      id="billingDocInput"
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      value={billingCpfCnpj}
                      maxLength={18}
                      onChange={(e) => {
                        const formatted = formatOwnerDocument(e.target.value);
                        setBillingCpfCnpj(formatted);
                        setCardForm((prev) => ({ ...prev, holderCpf: formatted }));
                      }}
                      className="h-9 text-xs sm:text-sm font-mono bg-background border-input"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Documento oficial para emissão de notas fiscais e registro da cobrança no gateway bancário.
                    </p>
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {isFreePeriod ? (
                      <div className="p-3 mb-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          {isTrialCoupon
                            ? `O cupom ${appliedCoupon?.code} concede ${appliedCoupon?.discount_value || 180} dias gratuitos e exige validação de um cartão de crédito (R$ 0,01) para garantia antifraude e tokenização.`
                            : "A degustação gratuita exige validação de um cartão de crédito (R$ 0,01) para garantia antifraude."}
                        </span>
                      </div>
                    ) : (
                      <TabsList className="grid grid-cols-3 bg-muted p-1 rounded-xl border border-border mb-4">
                        <TabsTrigger
                          value="pix"
                          className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-[11px] sm:text-xs font-semibold rounded-lg transition-all px-1 sm:px-2 min-h-[34px]"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1 shrink-0" />
                          <span className="hidden sm:inline">PIX (-5% OFF)</span>
                          <span className="sm:hidden">PIX (-5%)</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="card"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[11px] sm:text-xs font-semibold rounded-lg transition-all px-1 sm:px-2 min-h-[34px]"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1 shrink-0" />
                          Cartão
                        </TabsTrigger>
                        <TabsTrigger
                          value="boleto"
                          className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-[11px] sm:text-xs font-semibold rounded-lg transition-all px-1 sm:px-2 min-h-[34px]"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1 shrink-0" />
                          Boleto
                        </TabsTrigger>
                      </TabsList>
                    )}

                    {/* TAB 1: PIX INSTANTÂNEO */}
                    {!isFreePeriod && (
                      <TabsContent value="pix">
                        <PixCheckoutTab
                          pixQrCode={invoice?.pix_qr_code || null}
                          pixCopyPaste={invoice?.pix_copy_paste || null}
                          pixDiscountTotal={pixDiscountTotal}
                          rawTotal={rawTotal}
                          periodLabel={pricing.periodLabel}
                          onGeneratePix={handleGeneratePix}
                          generatingPix={generatingPix}
                        />
                      </TabsContent>
                    )}

                    {/* TAB 2: CARTÃO DE CRÉDITO */}
                    <TabsContent value="card">
                      <CreditCardCheckoutTab
                        cardForm={cardForm}
                        setCardForm={setCardForm}
                        installments={installments}
                        setInstallments={setInstallments}
                        rawTotal={rawTotal}
                        cycle={isFreePeriod ? "annual" : cycleParam}
                        processing={processingCard}
                        onSubmit={handleProcessCreditCard}
                        invoiceUrl={invoice?.invoice_url}
                      />
                    </TabsContent>

                    {/* TAB 3: BOLETO BANCÁRIO */}
                    {!isFreePeriod && (
                      <TabsContent value="boleto">
                        <BoletoCheckoutTab
                          bankSlipUrl={invoice?.bank_slip_url || null}
                          invoiceUrl={invoice?.invoice_url || null}
                          rawTotal={rawTotal}
                          identificationField={invoice?.identification_field || null}
                          barCode={invoice?.bar_code || null}
                          onGenerateBoleto={handleGenerateBoleto}
                          generatingBoleto={generatingBoleto}
                        />
                      </TabsContent>
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
