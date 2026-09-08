import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  CreditCard, 
  Sparkles, 
  UserRound, 
  Users, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Receipt,
  QrCode,
  Layers,
  Tag,
  Clock,
  Download,
  CalendarClock,
  AlertTriangle,
  RotateCw,
  Ban,
  ArrowUpRight,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { calculatePlanPrice, BillingCycle, parsePlanType, parseBillingCycle } from "@/utils/subscriptionPricing";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";
import { toast } from "sonner";
import {
  ChangePlanModal,
  AdjustConcurrentAccessModal,
  CancelSubscriptionModal,
  PixPaymentModal,
} from "./clinic-billing";

interface ClinicBillingSettingsProps {
  clinicId: string;
  currentPlan: "solo" | "clinic" | "enterprise";
  accountRole?: string;
  refreshAuthState?: () => Promise<void>;
}

interface SubscriptionSummary {
  subscription_id: string | null;
  clinic_id: string;
  account_owner_user_id: string | null;
  plan_type: "solo" | "clinic" | "enterprise";
  status: string;
  billing_cycle: string;
  payment_method: string;
  base_monthly_price: number;
  total_recurring_monthly_price: number;
  base_subaccount_limit: number;
  purchased_subaccount_extra_count: number;
  total_subaccount_limit: number;
  base_concurrent_access_count: number;
  additional_concurrent_access_count: number;
  total_concurrent_access_limit: number;
  next_due_date: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  applied_coupon_id?: string | null;
  coupon_code?: string | null;
  discount_percentage?: number | null;
  discount_fixed_amount?: number | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  period_duration_days?: number | null;
  auto_renew?: boolean | null;
  days_remaining?: number | null;
  is_expired?: boolean | null;
  is_free_trial?: boolean | null;
  cpf_cnpj?: string | null;
  billing_email?: string | null;
  billing_name?: string | null;
  override_reason?: string | null;
}

interface Invoice {
  id: string;
  asaas_payment_id: string;
  charge_type: "RECURRING_SUBSCRIPTION" | "ONE_TIME_SUBACCOUNT_EXPANSION";
  status: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  billing_type: string | null;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  pix_copia_e_cola?: string | null;
  pix_expiration_date?: string | null;
  invoice_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export function ClinicBillingSettings({
  clinicId,
  currentPlan,
  accountRole,
  refreshAuthState,
}: ClinicBillingSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [activeCollaboratorsCount, setActiveCollaboratorsCount] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isConcurrentModalOpen, setIsConcurrentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Modal do PIX QR Code
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<Invoice | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Form states
  const [targetPlan, setTargetPlan] = useState<"solo" | "clinic" | "enterprise">(currentPlan);
  const [targetCycle, setTargetCycle] = useState<BillingCycle>("annual");
  const [extraConcurrentCount, setExtraConcurrentCount] = useState(0);

  const navigate = useNavigate();
  const quota = useClinicPlanQuota(clinicId);

  const fetchSubscriptionData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      // 1. Resumo da Assinatura via RPC get_clinic_subscription_summary
      const { data: summaryData, error: summaryErr } = await supabase
        .rpc("get_clinic_subscription_summary", { _clinic_id: clinicId });

      if (summaryErr) {
        console.warn("Aviso ao buscar resumo da assinatura via RPC:", summaryErr);
      } else if (summaryData && summaryData.length > 0) {
        const item = summaryData[0] as SubscriptionSummary;
        setSummary(item);
        setExtraConcurrentCount(item.additional_concurrent_access_count || 0);
        if (item.billing_cycle) {
          setTargetCycle(parseBillingCycle(item.billing_cycle));
        }
      }

      // 2. Quantidade de colaboradores ativos
      const { count: colabCount, error: colabErr } = await supabase
        .from("clinic_memberships")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .eq("membership_status", "active")
        .neq("account_role", "account_owner");

      if (!colabErr) {
        setActiveCollaboratorsCount(colabCount || 0);
      }

      // 3. Faturas registradas
      const { data: invoicesData, error: invoicesErr } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (!invoicesErr && invoicesData) {
        setInvoices(invoicesData as Invoice[]);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de faturamento:", err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  // Alterar Plano (Upgrade / Downgrade com Trava de Segurança)
  const handleManagePlan = async () => {
    if (!clinicId || submitting) return;

    if (targetPlan === "solo" && activeCollaboratorsCount > 0) {
      toast.error(`Sua clínica possui ${activeCollaboratorsCount} colaborador(es) cadastrado(s). Remova ou desative os colaboradores antes de mudar para o plano Solo.`);
      return;
    }

    if (!hasActiveRecurringCard) {
      setIsPlanModalOpen(false);
      const baseConcurrentParam = targetPlan === "enterprise" ? 10 : targetPlan === "clinic" ? 4 : 1;
      navigate(`/pagamento/${clinicId}?plan=${targetPlan}&cycle=${targetCycle}${targetPlan !== "solo" && extraConcurrentCount > 0 ? `&concurrent=${baseConcurrentParam + extraConcurrentCount}` : ""}`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Chamar Edge Function para sincronizar plano e ciclo no Asaas
      const { data: asaasData, error: asaasError } = await supabase.functions.invoke("asaas-subscription", {
        body: {
          action: "CHANGE_PLAN",
          clinic_id: clinicId,
          plan_type: targetPlan,
          billing_cycle: targetCycle,
          additional_seats_count: targetPlan !== "solo" ? extraConcurrentCount : 0,
        },
      });

      if (asaasError || asaasData?.success === false || asaasData?.error) {
        throw new Error(asaasData?.error || asaasError?.message || "Falha ao sincronizar alteração com a operadora de pagamentos.");
      }

      // 2. Atualizar via RPC local
      const { error } = await supabase.rpc("manage_clinic_subscription_plan", {
        _clinic_id: clinicId,
        _new_plan: targetPlan,
        _billing_cycle: targetCycle.toUpperCase(),
      });

      if (error) throw error;

      toast.success(
        targetPlan === "enterprise"
          ? "Upgrade para o Plano Enterprise efetuado com sucesso!"
          : targetPlan === "clinic"
          ? "Upgrade para o Plano Clínica efetuado com sucesso!"
          : "Alteração para o Plano Solo efetuada com sucesso!"
      );
      setIsPlanModalOpen(false);

      if (typeof refreshAuthState === "function") {
        await refreshAuthState();
      }
      await fetchSubscriptionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar plano.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Ajustar Acessos Simultâneos
  const handleUpdateConcurrentAccesses = async () => {
    if (!clinicId || submitting) return;

    setSubmitting(true);
    try {
      // Invocar Edge Function de atualização no Asaas
      const { data: asaasData, error: asaasError } = await supabase.functions.invoke("asaas-subscription", {
        body: {
          action: "UPDATE_SEATS",
          clinic_id: clinicId,
          additional_seats_count: extraConcurrentCount,
        },
      });

      if (asaasError || asaasData?.success === false || asaasData?.error) {
        throw new Error(asaasData?.error || asaasError?.message || "Falha ao sincronizar acessos com a operadora de pagamentos.");
      }

      // Invocar RPC de atualização local
      const { error } = await supabase.rpc("update_clinic_concurrent_accesses", {
        _clinic_id: clinicId,
        _extra_concurrent: extraConcurrentCount,
      });

      if (error) throw error;

      toast.success("Acessos simultâneos atualizados com sucesso!");
      setIsConcurrentModalOpen(false);

      if (typeof refreshAuthState === "function") {
        await refreshAuthState();
      }
      await fetchSubscriptionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar acessos simultâneos.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAutoRenew = async (nextValue: boolean) => {
    if (!clinicId || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("toggle_subscription_auto_renew", {
        _clinic_id: clinicId,
        _auto_renew: nextValue,
      });

      if (error) throw error;

      setSummary((prev) => (prev ? { ...prev, auto_renew: nextValue } : prev));
      toast.success(
        nextValue
          ? "Renovação automática ativada com sucesso."
          : "Renovação automática desativada. Ao final do período, a clínica entrará em modo somente leitura."
      );
      await fetchSubscriptionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar renovação automática.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!clinicId || submitting) return;
    setSubmitting(true);
    try {
      const { data: asaasData, error: asaasError } = await supabase.functions.invoke("asaas-subscription", {
        body: {
          action: "CANCEL",
          clinic_id: clinicId,
        },
      });

      if (asaasError || asaasData?.success === false || asaasData?.error) {
        throw new Error(asaasData?.error || asaasError?.message || "Falha ao cancelar assinatura na operadora de pagamentos.");
      }

      await supabase.rpc("toggle_subscription_auto_renew", {
        _clinic_id: clinicId,
        _auto_renew: false,
      });

      toast.success("Assinatura cancelada no Asaas. O acesso permanecerá ativo até o fim do período já pago.");
      setIsCancelModalOpen(false);
      await fetchSubscriptionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar assinatura.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    toast.success("Código PIX Copia e Cola copiado para a área de transferência!");
    setTimeout(() => setCopiedPix(false), 3000);
  }, []);

  const activePlan = summary?.plan_type || currentPlan;
  const isSolo = activePlan === "solo";
  const isEnterprise = activePlan === "enterprise";
  const isTrial = summary?.status === "TRIAL" || summary?.is_free_trial === true || quota.isFreeTrial;
  const activeCycle = parseBillingCycle(summary?.billing_cycle);
  const extraConcurrent = summary?.additional_concurrent_access_count ?? 0;
  const defaultBase = isSolo ? 1 : isEnterprise ? 10 : 4;
  const baseConcurrent = summary?.base_concurrent_access_count ?? defaultBase;
  const totalConcurrent = summary?.total_concurrent_access_limit ?? defaultBase;

  const couponParam = useMemo(() => summary?.coupon_code ? {
    valid: true,
    code: summary.coupon_code,
    discount_type: (summary.discount_percentage ? "PERCENTAGE" : "FIXED_AMOUNT") as "PERCENTAGE" | "FIXED_AMOUNT",
    discount_value: summary.discount_percentage || summary.discount_fixed_amount || 0,
  } : undefined, [summary?.coupon_code, summary?.discount_percentage, summary?.discount_fixed_amount]);

  const pricing = useMemo(() => calculatePlanPrice({
    planType: activePlan,
    billingCycle: activeCycle,
    additionalSeats: extraConcurrent,
    coupon: couponParam,
  }), [activePlan, activeCycle, extraConcurrent, couponParam]);

  const totalMonthlyPrice = isTrial ? 0 : (summary?.total_recurring_monthly_price ?? pricing.monthlyEquivalent);
  const isOwner = accountRole === "account_owner" || !accountRole;

  const hasActiveRecurringCard = Boolean(
    summary?.asaas_subscription_id &&
    summary?.payment_method === "CREDIT_CARD" &&
    summary?.status === "ACTIVE"
  );

  // Cálculos memoizados para os Modais de Mudança de Plano (Big-O O(1))
  const modalPricingSolo = useMemo(() => calculatePlanPrice({
    planType: "solo",
    billingCycle: targetCycle,
  }), [targetCycle]);

  const modalPricingClinic = useMemo(() => calculatePlanPrice({
    planType: "clinic",
    billingCycle: targetCycle,
    additionalSeats: targetPlan === "clinic" ? extraConcurrentCount : 0,
  }), [targetCycle, targetPlan, extraConcurrentCount]);

  const modalPricingEnterprise = useMemo(() => calculatePlanPrice({
    planType: "enterprise",
    billingCycle: targetCycle,
    additionalSeats: targetPlan === "enterprise" ? extraConcurrentCount : 0,
  }), [targetCycle, targetPlan, extraConcurrentCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal do Plano */}
      <Card className="relative overflow-hidden border bg-card text-card-foreground backdrop-blur-md shadow-lg rounded-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                isSolo 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : isEnterprise 
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                {isSolo ? <UserRound className="w-6 h-6" /> : isEnterprise ? <Sparkles className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-foreground">
                    {isSolo ? "Profissional Solo" : isEnterprise ? "Enterprise (Alta Escala)" : "Clínica Pro"}
                  </h3>
                  <Badge variant="outline" className={`border-emerald-500/30 text-xs font-semibold ${isTrial ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"}`}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {isTrial ? "Plano Gratuito / Degustação" : "Assinatura Ativa"}
                  </Badge>

                  {summary?.coupon_code && !isTrial && (
                    <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-semibold">
                      <Tag className="w-3 h-3 mr-1" />
                      Cupom: {summary.coupon_code}
                    </Badge>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {isTrial
                    ? "Espaço em período de degustação gratuito com limites volumétricos."
                    : isSolo
                    ? "Ideal para profissionais autônomos organizarem seus atendimentos."
                    : isEnterprise
                    ? "Para grandes clínicas com alta escala: base de 10 acessos com tarifas reduzidas."
                    : "Para clínicas compartilhadas com gestão de colaboradores e acessos simultâneos."}
                </p>
              </div>
            </div>

            {isOwner && (
              <div className="flex items-center gap-2 flex-wrap">
                {isTrial ? (
                  <Button
                    onClick={() => navigate(`/planos?clinicId=${clinicId}`)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-4 py-2 text-sm shadow-md transition-all min-h-[44px]"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1.5" />
                    Fazer Upgrade para Plano Ilimitado
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setTargetPlan(activePlan);
                        setTargetCycle(activeCycle);
                        setIsPlanModalOpen(true);
                      }}
                      variant="outline"
                      className="rounded-xl px-4 py-2 text-sm font-medium transition-all min-h-[44px]"
                    >
                      <Layers className="w-4 h-4 mr-2 text-blue-500" />
                      Alterar Plano
                    </Button>

                    {summary?.auto_renew !== false && (
                      <Button
                        onClick={() => setIsCancelModalOpen(true)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl text-xs min-h-[44px]"
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {/* Banner de Aviso de Assinatura Expirada (Modo Somente Leitura) */}
        {summary?.is_expired && !isTrial && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-red-200">Assinatura Expirada - Modo Somente Leitura Ativo</p>
              <p className="text-neutral-300">
                O período contratado terminou. O acesso à clínica está restrito apenas para leitura de dados e prontuários existentes. Renove o plano para restabelecer o direito de escrita e novos atendimentos.
              </p>
            </div>
          </div>
        )}

        <CardContent className="p-6 pt-2 grid gap-4 sm:grid-cols-3 border-t border-border mt-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensalidade Equivalente</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold text-foreground">
                {isTrial ? "R$ 0,00" : `R$ ${totalMonthlyPrice.toFixed(2)}`}
              </span>
              <span className="text-xs text-muted-foreground">{isTrial ? "/ Degustação" : "/mês"}</span>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              {isTrial ? "Sem cobrança recorrente" : `Total: R$ ${pricing.periodTotal.toFixed(2)} / ${pricing.periodLabel}`}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status do Faturamento</p>
            <div className="flex items-center gap-2 mt-1">
              {summary?.is_expired && !isTrial ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-base font-semibold text-red-400">Expirado (Leitura)</span>
                </>
              ) : isTrial ? (
                <>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="text-base font-semibold text-amber-600 dark:text-amber-400">
                    Degustação Gratuita
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-base font-semibold text-foreground">
                    {summary?.status === "ACTIVE" ? "Ativo (Regular)" : "Ativo"}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isTrial ? "Degustação de 7 dias ou até 20 atendimentos" : pricing.cycleTitle}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período de Membro / Vencimento</p>
              <div className="flex items-center gap-1.5 mt-1">
                <CalendarClock className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm font-bold text-foreground">
                  {isTrial
                    ? summary?.days_remaining !== undefined && summary?.days_remaining !== null
                      ? `${summary.days_remaining} dia(s) restantes (ou até 20 atendimentos)`
                      : "Degustação de 7 dias ou até 20 atendimentos"
                    : summary?.days_remaining !== undefined && summary?.days_remaining !== null
                    ? summary.days_remaining > 0
                      ? `${summary.days_remaining} dia(s) restantes`
                      : "Período Encerrado"
                    : "30 dias restantes"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isTrial
                  ? summary?.expires_at
                    ? `Vence em ${new Date(summary.expires_at).toLocaleDateString("pt-BR")} ou ao atingir 20 atendimentos`
                    : "Degustação de 7 dias ou até 20 atendimentos"
                  : summary?.expires_at
                  ? `Vence em ${new Date(summary.expires_at).toLocaleDateString("pt-BR")}`
                  : summary?.next_due_date
                  ? `Vence em ${new Date(summary.next_due_date).toLocaleDateString("pt-BR")}`
                  : "Renovação contínua"}
              </p>
            </div>

            {/* Switch de Renovação Automática */}
            {isOwner && !isTrial && (
              <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground">Renovação Automática:</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {summary?.auto_renew !== false ? "Ativa" : "Desligada"}
                  </span>
                  <Switch
                    checked={summary?.auto_renew !== false}
                    onCheckedChange={(checked) => handleToggleAutoRenew(checked)}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Se for Degustação Free: Exibir Quadro de Cotas Volumétricas */}
      {isTrial ? (
        <Card className="border bg-card text-card-foreground shadow-lg rounded-2xl">
          <CardHeader className="p-6 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">Consumo de Cotas da Degustação</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Acompanhe o uso dos limites inclusos no seu teste gratuito.
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/planos?clinicId=${clinicId}`)}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs h-9"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                Fazer Upgrade para Ilimitado
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-2 grid gap-4 sm:grid-cols-3">
            {/* Atendimentos */}
            <div className="p-4 rounded-xl bg-muted/40 border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-blue-500" /> Atendimentos
                </span>
                <span className="font-bold text-foreground">
                  {quota.attendances.current} / {quota.attendances.max}
                </span>
              </div>
              <Progress
                value={Math.min(100, (quota.attendances.current / Math.max(1, quota.attendances.max)) * 100)}
                className="h-2 rounded-full"
              />
              <p className="text-[11px] text-muted-foreground">
                {quota.attendances.remaining > 0
                  ? `${quota.attendances.remaining} atendimento(s) restante(s)`
                  : "Limite de atendimentos atingido"}
              </p>
            </div>

            {/* Pacientes */}
            <div className="p-4 rounded-xl bg-muted/40 border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" /> Pacientes Ativos
                </span>
                <span className="font-bold text-foreground">
                  {quota.patients.current} / {quota.patients.max}
                </span>
              </div>
              <Progress
                value={Math.min(100, (quota.patients.current / Math.max(1, quota.patients.max)) * 100)}
                className="h-2 rounded-full"
              />
              <p className="text-[11px] text-muted-foreground">
                {quota.patients.remaining > 0
                  ? `${quota.patients.remaining} vaga(s) de paciente restante(s)`
                  : "Limite de pacientes atingido"}
              </p>
            </div>

            {/* Formulários Extras */}
            <div className="p-4 rounded-xl bg-muted/40 border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-500" /> Modelos de Fichas
                </span>
                <span className="font-bold text-foreground">
                  {quota.forms.current} / {quota.forms.max} extra
                </span>
              </div>
              <Progress
                value={Math.min(100, (quota.forms.current / Math.max(1, quota.forms.max)) * 100)}
                className="h-2 rounded-full"
              />
              <p className="text-[11px] text-muted-foreground">
                Modelos padrão do sistema são ilimitados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Grid de Cotas e Limites para planos pagos */
        <div className="grid gap-6">
          {/* Card: Acessos Simultâneos */}
          <Card className="border bg-card text-card-foreground shadow-lg rounded-2xl">
            <CardHeader className="p-6 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg font-semibold text-foreground">Acessos Simultâneos</CardTitle>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                  {totalConcurrent} Acessos Concorrentes
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Quantidade de dispositivos logados ao mesmo tempo na clínica.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="rounded-xl bg-muted/50 border p-3 space-y-2 text-xs text-foreground">
                <div className="flex justify-between">
                  <span>Acessos Inclusos na Base:</span>
                  <span className="font-semibold">{baseConcurrent} acessos</span>
                </div>
                {!isSolo && (
                  <div className="flex justify-between">
                    <span>Acessos Extras Contratados:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">+{extraConcurrent} (+R$ {(extraConcurrent * pricing.extraSeatRate).toFixed(2)}/mês)</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Cada acesso simultâneo adicional adiciona <strong className="font-semibold text-foreground">+R$ {pricing.extraSeatRate.toFixed(2)}/mês</strong> recorrente no ciclo {pricing.cycleTitle.toLowerCase()}.
              </p>

              {!isSolo && isOwner && (
                <Button
                  onClick={() => setIsConcurrentModalOpen(true)}
                  variant="outline"
                  className="w-full font-medium rounded-xl h-11 text-sm transition-all min-h-[44px]"
                >
                  Ajustar Acessos Simultâneos (+R$ {pricing.extraSeatRate.toFixed(2)}/mês)
                </Button>
              )}

              {isSolo && (
                <p className="text-xs text-muted-foreground italic">
                  O plano Solo é limitado a 1 acesso simultâneo por vez.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Faturas e Cobranças */}
      <Card className="border bg-card text-card-foreground shadow-lg rounded-2xl">
        <CardHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-500" />
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Histórico de Faturas e Cobranças</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Registro de mensalidades recorrentes e compras avulsas geradas via Asaas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhuma fatura gerada ainda. As faturas recorrentes e recibos avulsos aparecerão aqui.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider font-semibold border-b">
                <tr>
                  <th className="p-4">Tipo de Cobrança</th>
                  <th className="p-4">Data / Vencimento</th>
                  <th className="p-4">Forma</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-foreground">
                      {inv.charge_type === "ONE_TIME_SUBACCOUNT_EXPANSION"
                        ? "Expansão Avulsa de Vagas"
                        : "Mensalidade Recorrente"}
                    </td>
                    <td className="p-4">{new Date(inv.due_date).toLocaleDateString("pt-BR")}</td>
                    <td className="p-4">{inv.billing_type || "PIX"}</td>
                    <td className="p-4 font-bold text-foreground">R$ {Number(inv.value).toFixed(2)}</td>
                    <td className="p-4">
                      <Badge 
                        variant="outline" 
                        className={
                          inv.status === "CONFIRMED" || inv.status === "RECEIVED"
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : inv.status === "PENDING"
                            ? "border-yellow-500/30 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
                            : "border-neutral-500/30 text-neutral-400"
                        }
                      >
                        {inv.status === "CONFIRMED" || inv.status === "RECEIVED" ? "Pago / Confirmado" : inv.status === "PENDING" ? "Pendente" : inv.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {inv.status === "PENDING" && (inv.pix_copy_paste || inv.pix_copia_e_cola || inv.pix_qr_code) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPixInvoice(inv)}
                          className="h-8 text-xs rounded-lg border-blue-500/30 text-blue-500 hover:bg-blue-500/10 min-h-[36px]"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1" />
                          Pagar via PIX
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Alterar Plano (Upgrade / Downgrade com Seleção de Ciclo) */}
      <ChangePlanModal
        isOpen={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        targetCycle={targetCycle}
        onCycleChange={setTargetCycle}
        targetPlan={targetPlan}
        onPlanChange={setTargetPlan}
        currentPlan={activePlan}
        currentCycle={activeCycle}
        hasActiveRecurringCard={hasActiveRecurringCard}
        extraConcurrentCount={extraConcurrentCount}
        activeCollaboratorsCount={activeCollaboratorsCount}
        submitting={submitting}
        onConfirmChangePlan={handleManagePlan}
        onNavigateToCheckout={() => {
          setIsPlanModalOpen(false);
          const baseConcurrentParam = targetPlan === "enterprise" ? 10 : targetPlan === "clinic" ? 4 : 1;
          navigate(`/pagamento/${clinicId}?plan=${targetPlan}&cycle=${targetCycle}${targetPlan !== "solo" && extraConcurrentCount > 0 ? `&concurrent=${baseConcurrentParam + extraConcurrentCount}` : ""}`);
        }}
        modalPricingSolo={modalPricingSolo}
        modalPricingClinic={modalPricingClinic}
        modalPricingEnterprise={modalPricingEnterprise}
      />

      {/* Modal 2: Ajustar Acessos Simultâneos Extras */}
      <AdjustConcurrentAccessModal
        isOpen={isConcurrentModalOpen}
        onOpenChange={setIsConcurrentModalOpen}
        extraConcurrentCount={extraConcurrentCount}
        onExtraConcurrentCountChange={setExtraConcurrentCount}
        baseConcurrent={baseConcurrent}
        extraSeatRate={pricing.extraSeatRate}
        baseMonthlyEq={pricing.baseMonthlyEq}
        hasActiveRecurringCard={hasActiveRecurringCard}
        submitting={submitting}
        onConfirmUpdate={handleUpdateConcurrentAccesses}
        onNavigateToCheckout={() => {
          setIsConcurrentModalOpen(false);
          navigate(`/pagamento/${clinicId}?plan=${activePlan}&cycle=${targetCycle || activeCycle}&concurrent=${baseConcurrent + extraConcurrentCount}`);
        }}
      />

      {/* Modal 3: Cancelamento de Assinatura */}
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onOpenChange={setIsCancelModalOpen}
        expiresAt={summary?.expires_at}
        submitting={submitting}
        onConfirmCancel={handleCancelSubscription}
      />

      {/* Modal 4: Pagamento via PIX com QR Code */}
      <PixPaymentModal
        invoice={selectedPixInvoice}
        onClose={() => setSelectedPixInvoice(null)}
        copiedPix={copiedPix}
        onCopyPix={copyToClipboard}
      />
    </div>
  );
}

