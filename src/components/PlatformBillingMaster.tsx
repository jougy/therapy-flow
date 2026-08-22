import { useEffect, useState, useCallback } from "react";
import { 
  CreditCard, 
  Receipt, 
  ShieldCheck, 
  AlertCircle, 
  Search, 
  Loader2, 
  RefreshCw, 
  Building2, 
  Layers, 
  Tag, 
  CheckCircle2, 
  XCircle,
  FileCode,
  SlidersHorizontal,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClinicSubscriptionItem {
  id: string;
  clinic_id: string;
  clinic_name: string;
  plan_type: "solo" | "clinic";
  status: string;
  subaccount_limit: number;
  concurrent_access_limit: number;
  coupon_code?: string | null;
  total_recurring_monthly_price?: number;
  override_reason?: string | null;
  updated_at: string;
}

interface WebhookLogItem {
  id: string;
  event: string;
  payment_id: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  error_message: string | null;
  signature: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export function PlatformBillingMaster() {
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Assinaturas State
  const [subscriptions, setSubscriptions] = useState<ClinicSubscriptionItem[]>([]);
  const [subQuery, setSubQuery] = useState("");
  const [selectedSub, setSelectedSub] = useState<ClinicSubscriptionItem | null>(null);

  // Form Override State
  const [overridePlan, setOverridePlan] = useState<"solo" | "clinic">("clinic");
  const [overrideStatus, setOverrideStatus] = useState("active");
  const [overrideSubaccounts, setOverrideSubaccounts] = useState(30);
  const [overrideConcurrent, setOverrideConcurrent] = useState(2);
  const [overrideReason, setReason] = useState("");

  // Webhooks State
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [webhookFilter, setWebhookFilter] = useState<"all" | "errors">("all");
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookLogItem | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinic_subscriptions")
        .select(`
          id,
          clinic_id,
          plan_type,
          status,
          subaccount_limit,
          concurrent_access_limit,
          coupon_code,
          total_recurring_monthly_price,
          override_reason,
          updated_at,
          clinics!inner ( name )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map((item: any) => ({
          id: item.id,
          clinic_id: item.clinic_id,
          clinic_name: item.clinics?.name || "Clínica Desconhecida",
          plan_type: item.plan_type,
          status: item.status,
          subaccount_limit: item.subaccount_limit || 0,
          concurrent_access_limit: item.concurrent_access_limit || 0,
          coupon_code: item.coupon_code,
          total_recurring_monthly_price: item.total_recurring_monthly_price,
          override_reason: item.override_reason,
          updated_at: item.updated_at,
        }));
        setSubscriptions(formatted);
      }
    } catch (err) {
      console.error("Erro ao buscar assinaturas das clínicas:", err);
      toast.error("Não foi possível carregar as assinaturas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWebhookLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_asaas_webhook_logs", {
        _limit: 50,
        _offset: 0,
      });

      if (error) throw error;

      if (data) {
        setWebhookLogs(data as WebhookLogItem[]);
      }
    } catch (err) {
      console.error("Erro ao carregar logs de webhooks:", err);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
    fetchWebhookLogs();
  }, [fetchSubscriptions, fetchWebhookLogs]);

  // Abrir Modal de Override
  const handleOpenOverrideModal = (sub: ClinicSubscriptionItem) => {
    setSelectedSub(sub);
    setOverridePlan(sub.plan_type);
    setOverrideStatus(sub.status || "active");
    setOverrideSubaccounts(sub.subaccount_limit || 30);
    setOverrideConcurrent(sub.concurrent_access_limit || 2);
    setReason("");
  };

  // Executar Override Auditado via RPC PostgreSQL
  const handleExecuteOverride = async () => {
    if (!selectedSub || submitting) return;
    if (overrideReason.trim().length < 8) {
      toast.error("O motivo da auditoria master deve conter no mínimo 8 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("platform_override_clinic_subscription", {
        _clinic_id: selectedSub.clinic_id,
        _plan_type: overridePlan,
        _status: overrideStatus,
        _subaccount_limit: overrideSubaccounts,
        _concurrent_access_limit: overrideConcurrent,
        _reason: overrideReason.trim(),
      });

      if (error) throw error;

      toast.success(`Override de assinatura aplicado à clínica ${selectedSub.clinic_name}!`);
      setSelectedSub(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao aplicar override.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(
    (s) =>
      s.clinic_name.toLowerCase().includes(subQuery.toLowerCase()) ||
      s.clinic_id.toLowerCase().includes(subQuery.toLowerCase()) ||
      (s.coupon_code && s.coupon_code.toLowerCase().includes(subQuery.toLowerCase()))
  );

  const filteredWebhookLogs = webhookLogs.filter((log) => {
    if (webhookFilter === "errors") return !!log.error_message;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Structural Master Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-semibold mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            Backoffice Master: Faturamento & Webhooks Asaas
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Gestão de Assinaturas e Auditoria de Webhooks</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Gerencie planos de clínicas, execute overrides auditados e inspecione eventos do Asaas Sandbox.
          </p>
        </div>

        <Button
          onClick={() => {
            fetchSubscriptions();
            fetchWebhookLogs();
          }}
          variant="outline"
          className="rounded-xl h-10 px-4 text-xs font-semibold shrink-0"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="subscriptions" className="rounded-lg text-xs font-semibold">
            <Building2 className="w-4 h-4 mr-2" /> Assinaturas das Clínicas ({subscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-lg text-xs font-semibold">
            <Receipt className="w-4 h-4 mr-2" /> Logs de Webhooks Asaas ({webhookLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Gestão de Assinaturas & Overrides */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card className="border bg-card shadow-lg rounded-2xl">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Assinaturas Ativas na Plataforma</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Ajuste manualmente cotas, planos e status com registro auditado.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar clínica, ID ou cupom..."
                    value={subQuery}
                    onChange={(e) => setSubQuery(e.target.value)}
                    className="h-10 pl-9 rounded-xl text-xs bg-muted/50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma assinatura encontrada.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider font-semibold border-b">
                    <tr>
                      <th className="p-4">Clínica</th>
                      <th className="p-4">Plano</th>
                      <th className="p-4">Cotas (Vagas / Concorrentes)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Cupom</th>
                      <th className="p-4 text-right">Ação Master</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSubscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-foreground">{sub.clinic_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{sub.clinic_id}</p>
                        </td>
                        <td className="p-4">
                          <Badge variant={sub.plan_type === "clinic" ? "default" : "secondary"}>
                            {sub.plan_type === "clinic" ? "Clínica com Equipe" : "Profissional Solo"}
                          </Badge>
                        </td>
                        <td className="p-4 font-mono">
                          <span className="font-semibold text-foreground">{sub.subaccount_limit} Vagas</span> •{" "}
                          <span className="text-blue-500 font-semibold">{sub.concurrent_access_limit} Conexões</span>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={
                              sub.status === "active"
                                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                : "border-yellow-500/30 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
                            }
                          >
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {sub.coupon_code ? (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-500 font-mono">
                              <Tag className="w-3 h-3 mr-1" />
                              {sub.coupon_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenOverrideModal(sub)}
                            className="h-8 text-xs rounded-lg border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                            Override Master
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Leitor de Logs de Webhooks Asaas */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card className="border bg-card shadow-lg rounded-2xl">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Auditoria de Webhooks Asaas Sandbox</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Logs de eventos recebidos em tempo real para rastreabilidade de pagamentos e falhas.
                  </CardDescription>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={webhookFilter === "all" ? "default" : "outline"}
                    onClick={() => setWebhookFilter("all")}
                    className="h-9 text-xs rounded-xl"
                  >
                    Todos os Eventos
                  </Button>
                  <Button
                    size="sm"
                    variant={webhookFilter === "errors" ? "destructive" : "outline"}
                    onClick={() => setWebhookFilter("errors")}
                    className="h-9 text-xs rounded-xl"
                  >
                    Somente Falhas / Erros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {filteredWebhookLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum log de webhook encontrado.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider font-semibold border-b">
                    <tr>
                      <th className="p-4">Data / Hora</th>
                      <th className="p-4">Evento Asaas</th>
                      <th className="p-4">IDs de Referência</th>
                      <th className="p-4">Status / Erro</th>
                      <th className="p-4 text-right">Payload JSON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-[11px]">
                    {filteredWebhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-4 font-bold text-foreground">
                          <Badge variant="outline" className="border-blue-500/30 text-blue-500 bg-blue-500/10">
                            {log.event}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <div>Payment: {log.payment_id || "-"}</div>
                          <div>Customer: {log.customer_id || "-"}</div>
                        </td>
                        <td className="p-4">
                          {log.error_message ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <XCircle className="w-3 h-3 mr-1" />
                              {log.error_message}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Processado
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedWebhook(log)}
                            className="h-8 text-xs rounded-lg hover:bg-muted"
                          >
                            <FileCode className="w-3.5 h-3.5 mr-1 text-blue-500" />
                            Ver JSON
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal 1: Override Manual Auditado */}
      <Dialog open={!!selectedSub} onOpenChange={(open) => !open && setSelectedSub(null)}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-500" />
              Override Auditado: {selectedSub?.clinic_name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Altere diretamente as cotas e status da clínica no banco de dados. Exige motivo auditável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Plano de Assinatura</Label>
                <Select value={overridePlan} onValueChange={(v) => setOverridePlan(v as "solo" | "clinic")}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Profissional Solo</SelectItem>
                    <SelectItem value="clinic">Clínica com Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status do Acesso</Label>
                <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="payment_pending">Pagamento Pendente</SelectItem>
                    <SelectItem value="temporarily_paused">Pausada Temporariamente</SelectItem>
                    <SelectItem value="banned">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Limite de Colaboradores (Vagas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={overrideSubaccounts}
                  onChange={(e) => setOverrideSubaccounts(parseInt(e.target.value || "1", 10))}
                  className="h-10 rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Acessos Simultâneos</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={overrideConcurrent}
                  onChange={(e) => setOverrideConcurrent(parseInt(e.target.value || "1", 10))}
                  className="h-10 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-semibold text-foreground">
                Motivo Auditável da Alteração <span className="text-red-500">* (mín. 8 caracteres)</span>
              </Label>
              <Textarea
                placeholder="Ex: Concessão especial de degustação estendida solicitada via suporte ticket #102..."
                value={overrideReason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                className="rounded-xl text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedSub(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleExecuteOverride}
              disabled={submitting || overrideReason.trim().length < 8}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Override Auditado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Visualizador de Payload JSON do Webhook */}
      <Dialog open={!!selectedWebhook} onOpenChange={(open) => !open && setSelectedWebhook(null)}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2 font-mono">
              <FileCode className="w-5 h-5 text-blue-500" />
              Webhook Event: {selectedWebhook?.event}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Rastreamento de payload bruto e detalhes de assinatura.
            </DialogDescription>
          </DialogHeader>

          {selectedWebhook && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-xl bg-muted/60 border font-mono space-y-1 text-[11px]">
                <div>ID: {selectedWebhook.id}</div>
                <div>Payment ID: {selectedWebhook.payment_id || "-"}</div>
                <div>Customer ID: {selectedWebhook.customer_id || "-"}</div>
                <div>Data: {new Date(selectedWebhook.created_at).toLocaleString("pt-BR")}</div>
              </div>

              <Label className="text-xs font-semibold text-foreground">Payload JSON Bruto</Label>
              <pre className="p-4 rounded-xl bg-neutral-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-64 border border-neutral-800">
                {JSON.stringify(selectedWebhook.payload || {}, null, 2)}
              </pre>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedWebhook(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
