import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, QrCode, CreditCard, Receipt, Tag, Globe, ShieldCheck, UserRound, Building2 } from "lucide-react";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function SubscriptionsConfigForm({ formData, setFormData, feature }: FeatureSubFormProps) {
  if (feature?.key === "subscription_free_trial_enabled") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            Teste Gratuito (7 dias) (Trial Volumétrico / Free Tier)
          </div>
          <p>
            Permite que novos profissionais e clínicas experimentem a plataforma sem fornecer cartão de crédito durante o onboarding.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Duração do Teste Gratuito (Dias)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              placeholder="30"
              value={formData.trialDurationDays !== undefined ? String(formData.trialDurationDays) : "30"}
              onChange={(e) => setFormData({ ...formData, trialDurationDays: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Cota Inicial de Atendimentos</Label>
            <Input
              type="number"
              min={0}
              placeholder="0 (Ilimitado)"
              value={formData.trialMaxSessions !== undefined ? String(formData.trialMaxSessions) : "0"}
              onChange={(e) => setFormData({ ...formData, trialMaxSessions: Number(e.target.value) })}
            />
            <span className="text-[11px] text-muted-foreground">0 = sem limite de atendimentos durante os dias de teste.</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-semibold">Comportamento ao Expirar o Período</Label>
          <Select
            value={(formData.expiredBehavior as string) || "read_only"}
            onValueChange={(val) => setFormData({ ...formData, expiredBehavior: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o comportamento..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read_only">Modo Somente Leitura (Bloqueia escrita mantendo prontuários acessíveis)</SelectItem>
              <SelectItem value="block_all">Bloqueio Total com Redirecionamento para Pagamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (feature?.key === "subscription_payment_methods") {
    return (
      <div className="grid gap-6">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Métodos de Pagamento Habilitados</Label>
          <p className="text-xs text-muted-foreground">
            Selecione as formas de pagamento disponíveis no checkout e defina regras de desconto e parcelamento.
          </p>
        </div>

        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                PIX Instantâneo
              </Label>
              <p className="text-xs text-muted-foreground">Geração de QR Code dinâmico e chave Copia e Cola via Asaas.</p>
            </div>
            <Switch
              checked={formData.allowPix !== false}
              onCheckedChange={(v) => setFormData({ ...formData, allowPix: v })}
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Cartão de Crédito
              </Label>
              <p className="text-xs text-muted-foreground">Processamento online com validação de algoritmo de Luhn e bandeira.</p>
            </div>
            <Switch
              checked={formData.allowCreditCard !== false}
              onCheckedChange={(v) => setFormData({ ...formData, allowCreditCard: v })}
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                Boleto Bancário
              </Label>
              <p className="text-xs text-muted-foreground">Emissão de boleto registrado com link direto gerado pelo Asaas.</p>
            </div>
            <Switch
              checked={formData.allowBoleto !== false}
              onCheckedChange={(v) => setFormData({ ...formData, allowBoleto: v })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Desconto Automático no PIX (%)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={formData.pixDiscountPercent !== undefined ? String(formData.pixDiscountPercent) : "5"}
              onChange={(e) => setFormData({ ...formData, pixDiscountPercent: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Parcelamento Máximo no Cartão Sem Juros</Label>
            <Select
              value={formData.maxCardInstallments !== undefined ? String(formData.maxCardInstallments) : "12"}
              onValueChange={(val) => setFormData({ ...formData, maxCardInstallments: Number(val) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o parcelamento..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x (À vista)</SelectItem>
                <SelectItem value="3">Até 3x (Ciclo Trimestral)</SelectItem>
                <SelectItem value="6">Até 6x</SelectItem>
                <SelectItem value="12">Até 12x (Ciclo Anual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  if (feature?.key === "subscription_coupons_enabled") {
    return (
      <div className="grid gap-6">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Políticas de Cupons Promocionais</Label>
          <p className="text-xs text-muted-foreground">
            Gerencie a validação e aplicabilidade de cupons de desconto no fluxo de compra.
          </p>
        </div>

        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" />
                Habilitar Campo de Cupom no Checkout
              </Label>
              <p className="text-xs text-muted-foreground">Exibe o input de cupom promocional durante o checkout.</p>
            </div>
            <Switch
              checked={formData.showCouponInCheckout !== false}
              onCheckedChange={(v) => setFormData({ ...formData, showCouponInCheckout: v })}
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer">
                Acumular Cupom com Desconto PIX (5%)
              </Label>
              <p className="text-xs text-muted-foreground">Aplica o desconto do cupom e calcula os 5% do PIX sobre o saldo restante.</p>
            </div>
            <Switch
              checked={formData.allowCumulativePix !== false}
              onCheckedChange={(v) => setFormData({ ...formData, allowCumulativePix: v })}
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="space-y-0.5">
              <Label className="font-semibold text-sm cursor-pointer">
                Permitir Cupons em Planos com Desconto de Ciclo (Trimestral/Anual)
              </Label>
              <p className="text-xs text-muted-foreground">Permite aplicar cupom mesmo em planos anuais (-25%) e trimestrais (-10%).</p>
            </div>
            <Switch
              checked={formData.allowOnDiscountedCycles !== false}
              onCheckedChange={(v) => setFormData({ ...formData, allowOnDiscountedCycles: v })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default: subscriptions_module (Ambiente Asaas, Matriz Oficial de Preços e Visão Geral)
  const currentAsaasEnv = (formData.asaas_environment as string) || "production";
  const isProduction = currentAsaasEnv === "production";

  return (
    <div className="grid gap-6">
      {/* Seletor de Ambiente: Produção Oficial vs Sandbox */}
      <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 ${isProduction ? "text-emerald-500" : "text-amber-500"}`} />
              <Label className="text-sm font-bold">
                Ambiente do Gateway Asaas: {isProduction ? "Oficial (Produção)" : "Sandbox (Testes)"}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {isProduction
                ? "Cobranças bancárias e cartões reais processados na API de produção (https://api.asaas.com/v3)."
                : "Transações simuladas e sem valor monetário real na API de testes (https://sandbox.asaas.com/api/v3)."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              isProduction ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}>
              {isProduction ? "PRODUÇÃO" : "SANDBOX"}
            </span>
            <Switch
              checked={isProduction}
              onCheckedChange={(checked) => setFormData({ ...formData, asaas_environment: checked ? "production" : "sandbox" })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
          <div
            onClick={() => setFormData({ ...formData, asaas_environment: "sandbox" })}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              !isProduction
                ? "border-amber-500 bg-amber-500/10 shadow-sm"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-foreground">🟡 Sandbox (Testes)</span>
              {!isProduction && <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded">Ativo</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gera QR Codes fictícios e valida fluxos de checkout sem cobrança monetária real.
            </p>
          </div>

          <div
            onClick={() => setFormData({ ...formData, asaas_environment: "production" })}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              isProduction
                ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-foreground">🟢 Oficial (Produção)</span>
              {isProduction && <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded">Ativo</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Processamento oficial com emissão de PIX real, cartão e compensação bancária.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          Ambiente Seguro & Proteção de Credenciais
        </div>
        <p className="leading-relaxed">
          As chaves de API (<code className="font-mono text-emerald-800 dark:text-emerald-300">ASAAS_API_KEY</code> para Produção Oficial e <code className="font-mono text-emerald-800 dark:text-emerald-300">ASAAS_SANDBOX_API_KEY</code> para Sandbox) e tokens de webhook são mantidos de forma estritamente segura nas Edge Functions Deno do Supabase. O front-end apenas sinaliza qual ambiente deve processar a requisição.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-base font-semibold">Tabela de Preços e Ciclos Oficiais (Matriz Canônica)</Label>
        <p className="text-xs text-muted-foreground">
          Valores base sincronizados com a calculadora oficial da plataforma (<code className="font-mono text-[11px]">subscriptionPricing.ts</code>).
        </p>
      </div>

      {/* Grupo 1: Planos Profissionais (Individuais & Apoio) */}
      <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-emerald-600" />
            <Label className="font-bold text-sm">Grupo 1: Planos Profissionais (Individuais & Apoio)</Label>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            Profissionais
          </span>
        </div>

        <div className="space-y-3">
          {/* Profissional Básico */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Básico</span>
                <span className="text-[11px] text-muted-foreground ml-2">(1 acesso, 1 formulário customizado)</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">Entrada</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 57,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-17%)</span>
                <span className="font-bold text-foreground">R$ 47,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 141,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-35%)</span>
                <span className="font-bold text-foreground">R$ 37,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 444,00</span>
              </div>
            </div>
          </div>

          {/* Profissional Médio */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Médio</span>
                <span className="text-[11px] text-muted-foreground ml-2">(1 acesso, formulários ilimitados)</span>
              </div>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded w-fit">Mais Popular</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 87,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-23%)</span>
                <span className="font-bold text-foreground">R$ 67,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 201,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-34%)</span>
                <span className="font-bold text-foreground">R$ 57,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 684,00</span>
              </div>
            </div>
          </div>

          {/* Profissional Top */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Profissional Top</span>
                <span className="text-[11px] text-muted-foreground ml-2">(2 acessos: Dono + 1 Apoio, formulários ilimitados)</span>
              </div>
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded w-fit">Dono + Apoio</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 127,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-15%)</span>
                <span className="font-bold text-foreground">R$ 107,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 321,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-31%)</span>
                <span className="font-bold text-foreground">R$ 87,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.044,00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grupo 2: Planos para Clínicas & Equipes (Colaboradores Ilimitados no Cadastro) */}
      <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <Label className="font-bold text-sm">Grupo 2: Planos para Clínicas & Equipes (Colaboradores Ilimitados no Cadastro)</Label>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
            Equipes & Clínicas
          </span>
        </div>

        <div className="space-y-3">
          {/* Clínica Básico */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Básico</span>
                <span className="text-[11px] text-muted-foreground ml-2">(2 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">2 Acessos Base</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 147,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-13%)</span>
                <span className="font-bold text-foreground">R$ 127,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 381,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-34%)</span>
                <span className="font-bold text-foreground">R$ 97,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.164,00</span>
              </div>
            </div>
          </div>

          {/* Clínica Médio */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Médio</span>
                <span className="text-[11px] text-muted-foreground ml-2">(4 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
              </div>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded w-fit">4 Acessos Base</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 267,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-15%)</span>
                <span className="font-bold text-foreground">R$ 227,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 681,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-33%)</span>
                <span className="font-bold text-foreground">R$ 177,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 2.124,00</span>
              </div>
            </div>
          </div>

          {/* Clínica Top */}
          <div className="rounded-lg border bg-background p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-bold text-foreground text-xs sm:text-sm">Clínica Top</span>
                <span className="text-[11px] text-muted-foreground ml-2">(8 acessos simultâneos base + R$ 25/mês por conexão extra)</span>
              </div>
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded w-fit">8 Acessos Base</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Mensal</span>
                <span className="font-bold text-foreground">R$ 447,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-muted-foreground block">+ R$ 25/mês conexão extra</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Trimestral (-13%)</span>
                <span className="font-bold text-foreground">R$ 387,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 1.161,00</span>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Anual (-33%)</span>
                <span className="font-bold text-foreground">R$ 297,00<span className="text-[10px] font-normal text-muted-foreground">/mês</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Total: R$ 3.564,00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
