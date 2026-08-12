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
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  QrCode,
  Layers
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
  const [isBuySpacesModalOpen, setIsBuySpacesModalOpen] = useState(false);
  const [isConcurrentModalOpen, setIsConcurrentModalOpen] = useState(false);

  // Form states
  const [targetPlan, setTargetPlan] = useState<"solo" | "clinic">(currentPlan);
  const [extraSpacesQuantity, setExtraSpacesQuantity] = useState(10);
  const [buySpacesBillingType, setBuySpacesBillingType] = useState("PIX");
  const [extraConcurrentCount, setExtraConcurrentCount] = useState(0);

  const fetchSubscriptionData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      // 1. Fetch Subscription summary via RPC
      const { data: summaryData, error: summaryErr } = await supabase
        .rpc("get_clinic_subscription_summary", { _clinic_id: clinicId });

      if (summaryErr) {
        console.warn("Could not fetch subscription summary via RPC:", summaryErr);
      } else if (summaryData && summaryData.length > 0) {
        const item = summaryData[0] as SubscriptionSummary;
        setSummary(item);
        setExtraConcurrentCount(item.additional_concurrent_access_count || 0);
      }

      // 2. Fetch Active Collaborators Count
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

      // 3. Fetch Invoices
      const { data: invoicesData, error: invoicesErr } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (!invoicesErr && invoicesData) {
        setInvoices(invoicesData as Invoice[]);
      }
    } catch (err) {
      console.error("Error loading billing settings:", err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  // Handle Upgrade / Downgrade Plan
  const handleManagePlan = async () => {
    if (!clinicId || submitting) return;

    if (targetPlan === "solo" && activeCollaboratorsCount > 0) {
      toast.error(`Sua clínica possui ${activeCollaboratorsCount} colaborador(es) cadastrado(s). Remova ou desative os colaboradores antes de mudar para o plano Solo.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("manage_clinic_subscription_plan", {
        _clinic_id: clinicId,
        _new_plan: targetPlan,
      });

      if (error) throw error;

      toast.success(targetPlan === "clinic" ? "Upgrade para Plano Clínica efetuado com sucesso!" : "Alteração para o Plano Solo efetuada com sucesso!");
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

  // Handle Buy Extra Collaborator Spaces (One-time purchase R$ 5.00/space)
  const handleBuyExtraSpaces = async () => {
    if (!clinicId || submitting) return;
    if (extraSpacesQuantity <= 0) {
      toast.error("Informe uma quantidade válida de vagas.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("buy_clinic_subaccount_extra_spaces", {
        _clinic_id: clinicId,
        _quantity: extraSpacesQuantity,
        _billing_type: buySpacesBillingType,
      });

      if (error) throw error;

      toast.success(`Compra avulsa de ${extraSpacesQuantity} vagas confirmada com sucesso!`);
      setIsBuySpacesModalOpen(false);

      if (typeof refreshAuthState === "function") {
        await refreshAuthState();
      }
      await fetchSubscriptionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao adquirir vagas extras.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Update Extra Concurrent Accesses (+R$ 10.00/month recurring)
  const handleUpdateConcurrentAccesses = async () => {
    if (!clinicId || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("update_clinic_concurrent_accesses", {
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

  const activePlan = summary?.plan_type || currentPlan;
  const isSolo = activePlan === "solo";
  const baseSubaccountLimit = summary?.base_subaccount_limit ?? (isSolo ? 1 : 30);
  const extraSubaccountSpaces = summary?.purchased_subaccount_extra_count ?? 0;
  const totalSubaccountLimit = summary?.total_subaccount_limit ?? (isSolo ? 1 : 30);

  const baseConcurrent = summary?.base_concurrent_access_count ?? (isSolo ? 1 : 2);
  const extraConcurrent = summary?.additional_concurrent_access_count ?? 0;
  const totalConcurrent = summary?.total_concurrent_access_limit ?? (isSolo ? 1 : 2);

  const totalMonthlyPrice = summary?.total_recurring_monthly_price ?? (isSolo ? 50 : 60 + extraConcurrent * 10);
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
      {/* Overview Banner Card */}
      <Card className="relative overflow-hidden border bg-card text-card-foreground backdrop-blur-md shadow-lg rounded-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${isSolo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                {isSolo ? <UserRound className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-foreground">
                    {isSolo ? "Profissional Solo" : "Clínica com Equipe"}
                  </h3>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Fase Beta (100% Gratuito)
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isSolo ? "Ideal para profissionais autônomos organizarem seus atendimentos." : "Para clínicas compartilhadas com gestão de colaboradores e acessos simultâneos."}
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
            <div className="flex items-baseline gap-1 mt-1">
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
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</p>
            <p className="text-base font-semibold text-foreground mt-1">Isenção Beta Ativa</p>
            <p className="text-xs text-muted-foreground mt-1">Renovação automática</p>
          </div>
        </CardContent>
      </Card>

      {/* Capacity & Extra Quotas Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Subaccount Spaces */}
        <Card className="border bg-card text-card-foreground shadow-lg rounded-2xl">
          <CardHeader className="p-6 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg font-semibold text-foreground">Cadastro de Colaboradores</CardTitle>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                {activeCollaboratorsCount} / {totalSubaccountLimit} Vagas
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Vagas disponíveis para convidar secretárias, profissionais e colaboradores.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uso das Vagas</span>
                <span>{usagePercent}% preenchido</span>
              </div>
              <Progress value={usagePercent} className="h-2.5 bg-muted" />
            </div>

            <div className="rounded-xl bg-muted/50 border p-3 space-y-1.5 text-xs text-foreground">
              <div className="flex justify-between">
                <span>Cota Base do Plano:</span>
                <span className="font-semibold">{baseSubaccountLimit} vagas</span>
              </div>
              {!isSolo && (
                <div className="flex justify-between">
                  <span>Vagas Extras Compradas:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{extraSubaccountSpaces} vagas</span>
                </div>
              )}
            </div>

            {!isSolo && isOwner && (
              <Button
                onClick={() => setIsBuySpacesModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 text-sm transition-all shadow-md shadow-blue-600/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Comprar Vagas Extras (R$ 5,00 Avulso por Vaga)
              </Button>
            )}

            {isSolo && (
              <p className="text-xs text-muted-foreground italic">
                O plano Solo não permite colaboradores adicionais. Faça upgrade para o plano Clínica com Equipe para liberar até 30 vagas.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Concurrent Accesses */}
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

            <p className="text-xs text-muted-foreground">
              Cada acesso simultâneo adicional adiciona **+R$ 10,00/mês** recorrente na mensalidade do Asaas.
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

      {/* Invoices History Table */}
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
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                        {inv.status === "CONFIRMED" || inv.status === "RECEIVED" ? "Pago / Confirmado" : inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Alterar Plano (Upgrade / Downgrade) */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Alterar Plano de Assinatura</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Escolha o plano ideal para as necessidades operacionais da sua clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Solo Option */}
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
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• 1 Profissional de saúde</li>
                  <li>• 1 Acesso simultâneo</li>
                  <li>• Sem colaboradores</li>
                </ul>
              </div>
            </div>

            {/* Clinic Option */}
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
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• **30 Vagas** de colaboradores inclusas</li>
                  <li>• **2 Acessos** simultâneos inclusos</li>
                  <li>• Permissões & Hierarquias</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Downgrade Warning Guard */}
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

      {/* Modal 2: Compra Avulsa de Vagas de Colaboradores (R$ 5,00 avulso/vaga) */}
      <Dialog open={isBuySpacesModalOpen} onOpenChange={setIsBuySpacesModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Comprar Vagas Extras de Colaboradores</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Adicione mais capacidade de registro de colaboradores na sua clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Quantidade de Vagas Extras</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={extraSpacesQuantity}
                onChange={(e) => setExtraSpacesQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="h-11 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Forma de Pagamento</Label>
              <Select value={buySpacesBillingType} onValueChange={setBuySpacesBillingType}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX (Aprovação Imediata Sandbox)</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="BOLETO">Boleto Bancário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Total Preview Box */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Valor por Vaga Extra:</span>
                <span>R$ 5,00 (único)</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-blue-500/20">
                <span className="text-sm font-semibold text-foreground">Total da Compra Avulsa:</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">R$ {(extraSpacesQuantity * 5).toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                * Esta é uma cobrança avulsa e <strong>NÃO</strong> altera o valor da sua mensalidade recorrente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBuySpacesModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleBuyExtraSpaces}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Compra (R$ {(extraSpacesQuantity * 5).toFixed(2)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Ajustar Acessos Simultâneos Extras (+R$ 10/mês recorrente) */}
      <Dialog open={isConcurrentModalOpen} onOpenChange={setIsConcurrentModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl">
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
    </div>
  );
}
