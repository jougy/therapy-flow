import { useEffect, useState, useCallback } from "react";
import { 
  Building2, 
  CreditCard, 
  Sparkles, 
  UserRound, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Loader2, 
  ShieldCheck,
  Receipt,
  QrCode,
  Layers,
  Copy,
  Check,
  Tag,
  Clock,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClinicBillingSettingsProps {
  clinicId: string;
  currentPlan: "solo" | "clinic";
  accountRole?: string;
  refreshAuthState?: () => Promise<void>;
}

interface SubscriptionSummary {
  subscription_id: string | null;
  clinic_id: string;
  account_owner_user_id: string | null;
  plan_type: "solo" | "clinic";
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

  // Modal do PIX QR Code
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<Invoice | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Form states
  const [targetPlan, setTargetPlan] = useState<"solo" | "clinic">(currentPlan);
  const [extraConcurrentCount, setExtraConcurrentCount] = useState(0);

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

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("manage_clinic_subscription_plan", {
        _clinic_id: clinicId,
        _new_plan: targetPlan,
      });

      if (error) throw error;

      toast.success(targetPlan === "clinic" ? "Upgrade para o Plano Clínica efetuado com sucesso!" : "Alteração para o Plano Solo efetuada com sucesso!");
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


  // Ajustar Acessos Simultâneos (+R$ 10,00/mês cada)
  const handleUpdateConcurrentAccesses = async () => {
    if (!clinicId || submitting) return;

    setSubmitting(true);
    try {
      // Invocar Edge Function de atualização no Asaas
      await supabase.functions.invoke("asaas-subscription", {
        body: {
          action: "UPDATE_SEATS",
          clinic_id: clinicId,
          additional_seats_count: extraConcurrentCount,
        },
      });

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    toast.success("Código PIX Copia e Cola copiado para a área de transferência!");
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const activePlan = summary?.plan_type || currentPlan;
  const isSolo = activePlan === "solo";
  const baseSubaccountLimit = summary?.base_subaccount_limit ?? (isSolo ? 1 : 30);
  const extraSubaccountSpaces = summary?.purchased_subaccount_extra_count ?? 0;
  const totalSubaccountLimit = summary?.total_subaccount_limit ?? (isSolo ? 1 : 30);

  const baseConcurrent = summary?.base_concurrent_access_count ?? (isSolo ? 1 : 2);
  const extraConcurrent = summary?.additional_concurrent_access_count ?? 0;
  const totalConcurrent = summary?.total_concurrent_access_limit ?? (isSolo ? 1 : 2);

  const rawMonthlyPrice = isSolo ? 50.0 : 60.0 + extraConcurrent * 10.0;
  const totalMonthlyPrice = summary?.total_recurring_monthly_price ?? rawMonthlyPrice;
  const isOwner = accountRole === "account_owner" || !accountRole;

  const usagePercent = Math.min(100, Math.round((activeCollaboratorsCount / (totalSubaccountLimit || 1)) * 100));

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
              <div className={`p-3 rounded-2xl ${isSolo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                {isSolo ? <UserRound className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-foreground">
                    {isSolo ? "Profissional Solo" : "Clínica com Equipe"}
                  </h3>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Fase Beta (100% Gratuito)
                  </Badge>

                  {summary?.coupon_code && (
                    <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-semibold">
                      <Tag className="w-3 h-3 mr-1" />
                      Cupom: {summary.coupon_code}
                    </Badge>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {isSolo
                    ? "Ideal para profissionais autônomos organizarem seus atendimentos."
                    : "Para clínicas compartilhadas com gestão de colaboradores e acessos simultâneos."}
                </p>
              </div>
            </div>

            {isOwner && (
              <Button
                onClick={() => {
                  setTargetPlan(activePlan);
                  setIsPlanModalOpen(true);
                }}
                variant="outline"
                className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
              >
                <Layers className="w-4 h-4 mr-2 text-blue-500" />
                Alterar Plano
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-2 grid gap-4 sm:grid-cols-3 border-t border-border mt-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensalidade Recorrente</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              {summary?.coupon_code && rawMonthlyPrice !== totalMonthlyPrice && (
                <span className="text-sm text-muted-foreground line-through font-mono">
                  R$ {rawMonthlyPrice.toFixed(2)}
                </span>
              )}
              <span className="text-2xl font-bold text-foreground">R$ {totalMonthlyPrice.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Isento na Fase Beta</p>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status do Faturamento</p>
            <div className="flex items-center gap-2 mt-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-base font-semibold text-foreground">Ativo (Sandbox)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Integração Asaas Pronta</p>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimento / Ciclo</p>
            <p className="text-base font-semibold text-foreground mt-1">Isenção Beta Ativa</p>
            <p className="text-xs text-muted-foreground mt-1">Renovação automática</p>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Cotas e Limites */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Colaboradores da Equipe */}
        <Card className="border bg-card text-card-foreground shadow-lg rounded-2xl">
          <CardHeader className="p-6 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg font-semibold text-foreground">Colaboradores da Equipe</CardTitle>
              </div>
              <Badge variant="outline" className={isSolo ? "text-muted-foreground" : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"}>
                {isSolo ? `${activeCollaboratorsCount} / 0 Vagas` : "Cadastro Ilimitado"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {isSolo
                ? "O plano Solo é voltado para uso individual. Para convidar equipe, faça upgrade para o plano Clínica."
                : "Cadastre profissionais, secretárias e estagiários sem custos adicionais por usuário cadastrado."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4">
            <div className="rounded-xl bg-muted/50 border p-4 space-y-3 text-xs text-foreground">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Colaboradores ativos na clínica:</span>
                <span className="font-bold text-sm text-foreground">{activeCollaboratorsCount} pessoa(s)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Limite de cadastros:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {isSolo ? "1 usuário (Proprietário)" : "Sem limite (Ilimitado)"}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {isSolo
                ? "No plano Clínica com Equipe, você pode registrar toda a sua equipe livremente e dimensionar apenas os acessos simultâneos."
                : "No Therapy-Flow, a criação de contas para a equipe é livre. Você só paga pela quantidade de acessos simultâneos que utilizarem o sistema ao mesmo tempo."}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Acessos Simultâneos (Sem vazamento de markdown cru) */}
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
                  <span className="font-semibold text-blue-600 dark:text-blue-400">+{extraConcurrent} (+R$ {extraConcurrent * 10}/mês)</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cada acesso simultâneo adicional adiciona <strong className="font-semibold text-foreground">+R$ 10,00/mês</strong> recorrente na mensalidade do Asaas.
            </p>

            {!isSolo && isOwner && (
              <Button
                onClick={() => setIsConcurrentModalOpen(true)}
                variant="outline"
                className="w-full font-medium rounded-xl h-11 text-sm transition-all"
              >
                Ajustar Acessos Simultâneos (+R$ 10/mês)
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
                      {inv.status === "PENDING" && (inv.pix_copia_e_cola || inv.pix_qr_code) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPixInvoice(inv)}
                          className="h-8 text-xs rounded-lg border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
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

      {/* Modal 1: Alterar Plano (Upgrade / Downgrade com Trava de Segurança) */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Alterar Plano de Assinatura</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Escolha o plano ideal para as necessidades operacionais da sua clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Plano Solo */}
            <div
              onClick={() => setTargetPlan("solo")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                targetPlan === "solo"
                  ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                  : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserRound className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-bold text-foreground">Profissional Solo</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Para atendimento individual sem equipe.</p>
                <div className="text-2xl font-bold text-foreground mb-1">R$ 50<span className="text-xs text-muted-foreground">/mês</span></div>
                <ul className="text-xs text-muted-foreground space-y-1.5 mt-2">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> 1 Profissional de saúde</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> 1 Acesso simultâneo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Sem cobrança de subcontas</li>
                </ul>
              </div>
            </div>

            {/* Plano Clínica */}
            <div
              onClick={() => setTargetPlan("clinic")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                targetPlan === "clinic"
                  ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                  : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <h4 className="font-bold text-foreground">Clínica com Equipe</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Para clínicas e consultórios compartilhados.</p>
                <div className="text-2xl font-bold text-foreground mb-1">R$ 60<span className="text-xs text-muted-foreground">/mês</span></div>
                <ul className="text-xs text-muted-foreground space-y-1.5 mt-2">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" /> <strong>30 Vagas</strong> de colaboradores</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" /> <strong>2 Acessos</strong> simultâneos inclusos</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Permissões & Hierarquias</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bloqueio de Downgrade se houver colaboradores */}
          {targetPlan === "solo" && activeCollaboratorsCount > 0 && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-semibold text-sm">Bloqueio de Downgrade</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Sua clínica possui <strong>{activeCollaboratorsCount} colaborador(es) ativo(s)</strong>. Para alterar para o plano Solo, você precisa primeiro remover ou desativar os colaboradores na aba <em>"Colaboradores e acessos"</em>.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsPlanModalOpen(false)}
              disabled={submitting}
              className="text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleManagePlan}
              disabled={submitting || (targetPlan === "solo" && activeCollaboratorsCount > 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Alteração de Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal 3: Ajustar Acessos Simultâneos Extras (+R$ 10/mês recorrente) */}
      <Dialog open={isConcurrentModalOpen} onOpenChange={setIsConcurrentModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Ajustar Acessos Simultâneos Extras</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Altere o limite de conexões simultâneas permitidas na clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Acessos Extras Adicionais (+R$ 10/mês cada)</Label>
              <Input
                type="number"
                min={0}
                max={50}
                value={extraConcurrentCount}
                onChange={(e) => setExtraConcurrentCount(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="h-11 text-base rounded-xl"
              />
            </div>

            {extraConcurrentCount < extraConcurrent && (
              <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-semibold text-xs sm:text-sm">Efetivação de Redução de Cotas</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  O aumento de acessos entra em vigor imediatamente. Reduções de acessos simultâneos passam a valer na renovação do próximo ciclo de faturamento para garantir a cobrança justa pelo uso no período atual.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-xl bg-muted/60 border p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Acessos Inclusos no Plano Base:</span>
                <span className="text-foreground font-medium">2 acessos</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total de Acessos Permitidos:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{2 + extraConcurrentCount} acessos simultâneos</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border text-sm">
                <span className="font-semibold text-foreground">Nova Mensalidade Recorrente:</span>
                <span className="text-xl font-bold text-foreground">R$ {(60 + extraConcurrentCount * 10).toFixed(2)}<span className="text-xs text-muted-foreground">/mês</span></span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConcurrentModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateConcurrentAccesses}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Atualizar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Pagamento via PIX com QR Code e Copia e Cola */}
      <Dialog open={!!selectedPixInvoice} onOpenChange={(open) => !open && setSelectedPixInvoice(null)}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-500" />
              Pagamento via PIX (Asaas Sandbox)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Escaneie o QR Code ou copie a chave abaixo no app do seu banco.
            </DialogDescription>
          </DialogHeader>

          {selectedPixInvoice && (
            <div className="space-y-4 py-2 text-center">
              {/* Image QR Code */}
              {selectedPixInvoice.pix_qr_code ? (
                <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto">
                  <img
                    src={`data:image/png;base64,${selectedPixInvoice.pix_qr_code}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-muted/60 border text-center text-xs text-muted-foreground">
                  <QrCode className="w-12 h-12 mx-auto mb-2 text-emerald-500 opacity-60" />
                  QR Code gerado para cobrança Asaas Sandbox
                </div>
              )}

              <div className="text-lg font-bold text-foreground">
                Valor: <span className="text-emerald-500">R$ {Number(selectedPixInvoice.value).toFixed(2)}</span>
              </div>

              {/* Payload Copia e Cola */}
              {selectedPixInvoice.pix_copia_e_cola && (
                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-foreground">PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={selectedPixInvoice.pix_copia_e_cola}
                      className="h-10 text-xs font-mono bg-muted"
                    />
                    <Button
                      onClick={() => copyToClipboard(selectedPixInvoice.pix_copia_e_cola || "")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-10 px-3"
                    >
                      {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPixInvoice(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
