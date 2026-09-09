import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Calendar,
  Activity,
  SlidersHorizontal,
  Sparkles,
  MapPin,
  RefreshCcw,
  Percent,
  DollarSign,
  Gift,
  ShieldCheck,
  UserCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_DAYS";
export type DiscountDurationType = "FOREVER" | "ONCE" | "REPEATING";

export interface EligibilityRules {
  account_creation?: {
    mode: "any" | "after" | "before" | "between";
    after_date?: string;
    before_date?: string;
  };
  collaborators?: {
    enabled: boolean;
    operator: "gte" | "lte" | "eq";
    value: number;
  };
  sessions?: {
    enabled: boolean;
    operator: "gte" | "lte" | "eq";
    value: number;
  };
  first_subscription_only?: boolean;
  patients?: {
    enabled: boolean;
    operator: "gte" | "lte" | "eq";
    value: number;
  };
  target_billing_cycles?: string[] | null;
  winback_only?: boolean;
  allowed_states?: string[] | null;
}

export interface SubscriptionCouponItem {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  discount_duration_type?: DiscountDurationType;
  discount_duration_months?: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  applicable_plans: string[] | null;
  eligibility_rules?: EligibilityRules | null;
  created_at: string;
  updated_at: string;
}

interface CouponFormData {
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  discount_duration_type: DiscountDurationType;
  discount_duration_months: string;
  max_redemptions: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  // Regras de Elegibilidade
  account_creation_mode: "any" | "after" | "before" | "between";
  account_creation_after: string;
  account_creation_before: string;
  collaborators_enabled: boolean;
  collaborators_operator: "gte" | "lte" | "eq";
  collaborators_value: number;
  sessions_enabled: boolean;
  sessions_operator: "gte" | "lte" | "eq";
  sessions_value: number;
  first_subscription_only: boolean;
  patients_enabled: boolean;
  patients_operator: "gte" | "lte" | "eq";
  patients_value: number;
  target_billing_cycles: string[];
  winback_only: boolean;
  allowed_states: string;
}

const initialFormData: CouponFormData = {
  code: "",
  description: "",
  discount_type: "PERCENTAGE",
  discount_value: 10,
  discount_duration_type: "FOREVER",
  discount_duration_months: "",
  max_redemptions: "",
  valid_from: "",
  valid_until: "",
  is_active: true,
  account_creation_mode: "any",
  account_creation_after: "",
  account_creation_before: "",
  collaborators_enabled: false,
  collaborators_operator: "gte",
  collaborators_value: 1,
  sessions_enabled: false,
  sessions_operator: "gte",
  sessions_value: 10,
  first_subscription_only: false,
  patients_enabled: false,
  patients_operator: "gte",
  patients_value: 15,
  target_billing_cycles: [],
  winback_only: false,
  allowed_states: "",
};

export function PlatformCouponsManager() {
  const [coupons, setCoupons] = useState<SubscriptionCouponItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<SubscriptionCouponItem | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<SubscriptionCouponItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CouponFormData>(initialFormData);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoupons((data as SubscriptionCouponItem[]) || []);
    } catch (err) {
      console.error("Erro ao carregar cupons:", err);
      toast.error("Não foi possível carregar a lista de cupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  // Avaliação automática de status
  const getCouponStatus = useCallback((coupon: SubscriptionCouponItem) => {
    const now = new Date();
    if (!coupon.is_active) {
      return { key: "paused", label: "Pausado Manual", color: "text-muted-foreground bg-muted border-border" };
    }
    if (coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions) {
      return { key: "exhausted", label: "Esgotado", color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { key: "expired", label: "Expirado por Data", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" };
    }
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { key: "scheduled", label: "Agendado", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" };
    }
    return { key: "active", label: "Ativo e Vigente", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  }, []);

  // KPIs
  const stats = useMemo(() => {
    let activeCount = 0;
    let scheduledOrExpired = 0;
    let totalRedemptions = 0;

    for (const c of coupons) {
      totalRedemptions += c.times_redeemed || 0;
      const st = getCouponStatus(c);
      if (st.key === "active") activeCount++;
      if (st.key === "scheduled" || st.key === "expired" || st.key === "exhausted") scheduledOrExpired++;
    }

    return {
      total: coupons.length,
      active: activeCount,
      scheduledOrExpired,
      totalRedemptions,
    };
  }, [coupons, getCouponStatus]);

  // Filtros
  const filteredCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const matchesSearch =
        !q ||
        coupon.code.toLowerCase().includes(q) ||
        (coupon.description && coupon.description.toLowerCase().includes(q));

      const st = getCouponStatus(coupon);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && st.key === "active") ||
        (statusFilter === "paused" && st.key === "paused") ||
        (statusFilter === "scheduled" && st.key === "scheduled") ||
        (statusFilter === "expired" && st.key === "expired") ||
        (statusFilter === "exhausted" && st.key === "exhausted");

      const matchesType = typeFilter === "all" || coupon.discount_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [coupons, searchQuery, statusFilter, typeFilter, getCouponStatus]);

  const handleOpenCreate = () => {
    setSelectedCoupon(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon: SubscriptionCouponItem) => {
    setSelectedCoupon(coupon);
    const rules = coupon.eligibility_rules || {};
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_duration_type: coupon.discount_duration_type || "FOREVER",
      discount_duration_months: coupon.discount_duration_months ? String(coupon.discount_duration_months) : "",
      max_redemptions: coupon.max_redemptions ? String(coupon.max_redemptions) : "",
      valid_from: coupon.valid_from ? coupon.valid_from.split("T")[0] : "",
      valid_until: coupon.valid_until ? coupon.valid_until.split("T")[0] : "",
      is_active: coupon.is_active,
      account_creation_mode: rules.account_creation?.mode || "any",
      account_creation_after: rules.account_creation?.after_date || "",
      account_creation_before: rules.account_creation?.before_date || "",
      collaborators_enabled: !!rules.collaborators?.enabled,
      collaborators_operator: rules.collaborators?.operator || "gte",
      collaborators_value: rules.collaborators?.value || 1,
      sessions_enabled: !!rules.sessions?.enabled,
      sessions_operator: rules.sessions?.operator || "gte",
      sessions_value: rules.sessions?.value || 10,
      first_subscription_only: !!rules.first_subscription_only,
      patients_enabled: !!rules.patients?.enabled,
      patients_operator: rules.patients?.operator || "gte",
      patients_value: rules.patients?.value || 15,
      target_billing_cycles: rules.target_billing_cycles || [],
      winback_only: !!rules.winback_only,
      allowed_states: rules.allowed_states?.join(", ") || "",
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (coupon: SubscriptionCouponItem) => {
    setSelectedCoupon(null);
    const rules = coupon.eligibility_rules || {};
    setFormData({
      code: `${coupon.code}_COPIA`,
      description: coupon.description ? `${coupon.description} (Cópia)` : "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_duration_type: coupon.discount_duration_type || "FOREVER",
      discount_duration_months: coupon.discount_duration_months ? String(coupon.discount_duration_months) : "",
      max_redemptions: coupon.max_redemptions ? String(coupon.max_redemptions) : "",
      valid_from: "",
      valid_until: "",
      is_active: true,
      account_creation_mode: rules.account_creation?.mode || "any",
      account_creation_after: rules.account_creation?.after_date || "",
      account_creation_before: rules.account_creation?.before_date || "",
      collaborators_enabled: !!rules.collaborators?.enabled,
      collaborators_operator: rules.collaborators?.operator || "gte",
      collaborators_value: rules.collaborators?.value || 1,
      sessions_enabled: !!rules.sessions?.enabled,
      sessions_operator: rules.sessions?.operator || "gte",
      sessions_value: rules.sessions?.value || 10,
      first_subscription_only: !!rules.first_subscription_only,
      patients_enabled: !!rules.patients?.enabled,
      patients_operator: rules.patients?.operator || "gte",
      patients_value: rules.patients?.value || 15,
      target_billing_cycles: rules.target_billing_cycles || [],
      winback_only: !!rules.winback_only,
      allowed_states: rules.allowed_states?.join(", ") || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formData.code.trim().toUpperCase().replace(/\s+/g, "");
    if (cleanCode.length < 3) {
      toast.error("O código do cupom deve ter pelo menos 3 caracteres.");
      return;
    }
    if (formData.discount_value <= 0) {
      toast.error("O valor do desconto deve ser maior que zero.");
      return;
    }
    if (formData.discount_type === "PERCENTAGE" && formData.discount_value > 100) {
      toast.error("O desconto percentual não pode ser maior que 100%.");
      return;
    }

    setSubmitting(true);
    try {
      const parsedMaxRedemptions = formData.max_redemptions.trim()
        ? parseInt(formData.max_redemptions, 10)
        : null;

      const parsedValidFrom = formData.valid_from
        ? new Date(`${formData.valid_from}T00:00:00.000Z`).toISOString()
        : new Date().toISOString();

      const parsedValidUntil = formData.valid_until
        ? new Date(`${formData.valid_until}T23:59:59.999Z`).toISOString()
        : null;

      const parsedDurationMonths =
        formData.discount_duration_type === "REPEATING" && formData.discount_duration_months.trim()
          ? parseInt(formData.discount_duration_months, 10)
          : null;

      // Montagem do JSONB de regras de elegibilidade
      const eligibilityRules: EligibilityRules = {};

      if (formData.account_creation_mode !== "any") {
        eligibilityRules.account_creation = {
          mode: formData.account_creation_mode,
          after_date: formData.account_creation_after || undefined,
          before_date: formData.account_creation_before || undefined,
        };
      }

      if (formData.collaborators_enabled) {
        eligibilityRules.collaborators = {
          enabled: true,
          operator: formData.collaborators_operator,
          value: formData.collaborators_value,
        };
      }

      if (formData.sessions_enabled) {
        eligibilityRules.sessions = {
          enabled: true,
          operator: formData.sessions_operator,
          value: formData.sessions_value,
        };
      }

      if (formData.first_subscription_only) {
        eligibilityRules.first_subscription_only = true;
      }

      if (formData.patients_enabled) {
        eligibilityRules.patients = {
          enabled: true,
          operator: formData.patients_operator,
          value: formData.patients_value,
        };
      }

      if (formData.target_billing_cycles.length > 0) {
        eligibilityRules.target_billing_cycles = formData.target_billing_cycles;
      }

      if (formData.winback_only) {
        eligibilityRules.winback_only = true;
      }

      if (formData.allowed_states.trim()) {
        eligibilityRules.allowed_states = formData.allowed_states
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      }

      const payload = {
        code: cleanCode,
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        discount_duration_type: formData.discount_duration_type,
        discount_duration_months: parsedDurationMonths,
        max_redemptions: parsedMaxRedemptions && parsedMaxRedemptions > 0 ? parsedMaxRedemptions : null,
        valid_from: parsedValidFrom,
        valid_until: parsedValidUntil,
        is_active: formData.is_active,
        eligibility_rules: eligibilityRules,
        updated_at: new Date().toISOString(),
      };

      if (selectedCoupon) {
        const { error } = await supabase
          .from("subscription_coupons")
          .update(payload)
          .eq("id", selectedCoupon.id);
        if (error) throw error;
        toast.success(`Cupom ${cleanCode} atualizado com sucesso!`);
      } else {
        const { error } = await supabase
          .from("subscription_coupons")
          .insert(payload);
        if (error) throw error;
        toast.success(`Cupom ${cleanCode} criado com sucesso!`);
      }

      setIsModalOpen(false);
      void fetchCoupons();
    } catch (err: any) {
      console.error("Erro ao salvar cupom:", err);
      toast.error(err.message || "Erro ao salvar cupom promocional.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: SubscriptionCouponItem) => {
    try {
      const nextStatus = !coupon.is_active;
      const { error } = await supabase
        .from("subscription_coupons")
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", coupon.id);
      if (error) throw error;

      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: nextStatus } : c))
      );
      toast.success(`Cupom ${coupon.code} ${nextStatus ? "ativado" : "pausado"} manualmente!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status do cupom.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    try {
      const { error } = await supabase
        .from("subscription_coupons")
        .delete()
        .eq("id", couponToDelete.id);
      if (error) throw error;

      toast.success(`Cupom ${couponToDelete.code} excluído com sucesso!`);
      setCoupons((prev) => prev.filter((c) => c.id !== couponToDelete.id));
      setCouponToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir cupom.");
    }
  };

  const renderEligibilitySummaryBadges = (coupon: SubscriptionCouponItem) => {
    const rules = coupon.eligibility_rules;
    if (!rules || Object.keys(rules).length === 0) {
      return <span className="text-muted-foreground text-[11px]">Sem restrições de conta</span>;
    }

    const badges: React.ReactNode[] = [];

    if (rules.account_creation && rules.account_creation.mode !== "any") {
      badges.push(
        <Badge key="acc" variant="outline" className="text-[10px] bg-background text-foreground gap-1">
          <Calendar className="w-3 h-3 text-blue-500" />
          {rules.account_creation.mode === "after" && `Criada após ${rules.account_creation.after_date}`}
          {rules.account_creation.mode === "before" && `Criada antes de ${rules.account_creation.before_date}`}
          {rules.account_creation.mode === "between" &&
            `${rules.account_creation.after_date} a ${rules.account_creation.before_date}`}
        </Badge>
      );
    }

    if (rules.collaborators?.enabled) {
      badges.push(
        <Badge key="collab" variant="outline" className="text-[10px] bg-background text-foreground gap-1">
          <Users className="w-3 h-3 text-purple-500" />
          Colabs {rules.collaborators.operator === "gte" ? "≥" : rules.collaborators.operator === "lte" ? "≤" : "="}{" "}
          {rules.collaborators.value}
        </Badge>
      );
    }

    if (rules.sessions?.enabled) {
      badges.push(
        <Badge key="sess" variant="outline" className="text-[10px] bg-background text-foreground gap-1">
          <Activity className="w-3 h-3 text-emerald-500" />
          Atendimentos {rules.sessions.operator === "gte" ? "≥" : rules.sessions.operator === "lte" ? "≤" : "="}{" "}
          {rules.sessions.value}
        </Badge>
      );
    }

    if (rules.first_subscription_only) {
      badges.push(
        <Badge key="first" variant="outline" className="text-[10px] bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
          <Sparkles className="w-3 h-3" />
          1ª Assinatura
        </Badge>
      );
    }

    if (rules.patients?.enabled) {
      badges.push(
        <Badge key="pts" variant="outline" className="text-[10px] bg-background text-foreground gap-1">
          <UserCheck className="w-3 h-3 text-indigo-500" />
          Pacientes {rules.patients.operator === "gte" ? "≥" : rules.patients.operator === "lte" ? "≤" : "="}{" "}
          {rules.patients.value}
        </Badge>
      );
    }

    if (rules.target_billing_cycles && rules.target_billing_cycles.length > 0) {
      badges.push(
        <Badge key="cyc" variant="outline" className="text-[10px] bg-background text-foreground gap-1 uppercase">
          <TrendingUp className="w-3 h-3 text-amber-500" />
          {rules.target_billing_cycles.join("/")}
        </Badge>
      );
    }

    if (rules.winback_only) {
      badges.push(
        <Badge key="winback" variant="outline" className="text-[10px] bg-background text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
          <RefreshCcw className="w-3 h-3" />
          Winback
        </Badge>
      );
    }

    if (rules.allowed_states && rules.allowed_states.length > 0) {
      badges.push(
        <Badge key="geo" variant="outline" className="text-[10px] bg-background text-foreground gap-1">
          <MapPin className="w-3 h-3 text-rose-500" />
          UF: {rules.allowed_states.join(", ")}
        </Badge>
      );
    }

    return <div className="flex flex-wrap gap-1 max-w-xs">{badges}</div>;
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIs Rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total de Cupons</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">{stats.total}</p>
        </Card>

        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Ativos e Vigentes</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.active}
          </p>
        </Card>

        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Agendados / Expirados</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2">
            {stats.scheduledOrExpired}
          </p>
        </Card>

        <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total de Resgates</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-2">
            {stats.totalRedemptions}
          </p>
        </Card>
      </div>

      {/* 2. Barra de Busca, Filtros e Ação de Criação */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="p-4 sm:p-5 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Catálogo de Cupons Promocionais
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Gestão centralizada de campanhas, ativação automática/manual e condições de elegibilidade da conta.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={fetchCoupons}
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl text-xs shrink-0"
                title="Recarregar"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={handleOpenCreate}
                className="h-9 px-4 rounded-xl text-xs font-semibold shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                Novo Cupom
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border">
                  <SelectValue placeholder="Filtrar por Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo e Vigente</SelectItem>
                  <SelectItem value="paused">Pausado Manual</SelectItem>
                  <SelectItem value="scheduled">Agendado no Futuro</SelectItem>
                  <SelectItem value="expired">Expirado por Data</SelectItem>
                  <SelectItem value="exhausted">Esgotado por Limite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border">
                  <SelectValue placeholder="Filtrar por Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos de Desconto</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="TRIAL_DAYS">Dias Grátis (Trial/Beta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {filteredCoupons.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <Tag className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>Nenhum cupom promocional corresponde aos filtros selecionados.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider font-semibold border-b text-[11px]">
                <tr>
                  <th className="p-3.5 sm:p-4">Cupom</th>
                  <th className="p-3.5 sm:p-4">Desconto & Valor</th>
                  <th className="p-3.5 sm:p-4">Duração</th>
                  <th className="p-3.5 sm:p-4">Vigência & Status</th>
                  <th className="p-3.5 sm:p-4">Condições da Conta</th>
                  <th className="p-3.5 sm:p-4">Resgates</th>
                  <th className="p-3.5 sm:p-4">Ativo</th>
                  <th className="p-3.5 sm:p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCoupons.map((coupon) => {
                  const statusInfo = getCouponStatus(coupon);
                  return (
                    <tr key={coupon.id} className="hover:bg-muted/30 transition-colors">
                      {/* 1. Código e Descrição */}
                      <td className="p-3.5 sm:p-4">
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="border-primary/30 text-primary font-mono text-xs font-bold bg-primary/5"
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {coupon.code}
                          </Badge>
                          {coupon.description && (
                            <p className="text-[11px] text-muted-foreground max-w-[220px] truncate">
                              {coupon.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 2. Tipo & Valor */}
                      <td className="p-3.5 sm:p-4">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {coupon.discount_type === "PERCENTAGE" && `${coupon.discount_value}% OFF`}
                            {coupon.discount_type === "FIXED_AMOUNT" &&
                              `R$ ${coupon.discount_value.toFixed(2)} OFF`}
                            {coupon.discount_type === "TRIAL_DAYS" && `${coupon.discount_value} dias grátis`}
                          </span>
                          <div>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${
                                coupon.discount_type === "TRIAL_DAYS"
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                  : coupon.discount_type === "PERCENTAGE"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              }`}
                            >
                              {coupon.discount_type === "TRIAL_DAYS"
                                ? "Trial / Beta"
                                : coupon.discount_type === "PERCENTAGE"
                                ? "Percentual"
                                : "Valor Fixo"}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* 3. Duração do Desconto */}
                      <td className="p-3.5 sm:p-4">
                        <Badge variant="outline" className="text-[11px] font-medium bg-background text-foreground">
                          {coupon.discount_duration_type === "ONCE" && "Apenas 1ª fatura"}
                          {coupon.discount_duration_type === "REPEATING" &&
                            `Por ${coupon.discount_duration_months || 1} meses`}
                          {(!coupon.discount_duration_type || coupon.discount_duration_type === "FOREVER") &&
                            "Vitalício / Todas"}
                        </Badge>
                      </td>

                      {/* 4. Vigência e Status Automático */}
                      <td className="p-3.5 sm:p-4">
                        <div className="space-y-1">
                          <Badge variant="outline" className={`text-[10px] font-semibold border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground">
                            {coupon.valid_until ? (
                              <span>Até {new Date(coupon.valid_until).toLocaleDateString("pt-BR")}</span>
                            ) : (
                              <span>Sem data limite</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Condições da Conta */}
                      <td className="p-3.5 sm:p-4">{renderEligibilitySummaryBadges(coupon)}</td>

                      {/* 6. Resgates */}
                      <td className="p-3.5 sm:p-4 font-mono">
                        <span className="font-semibold text-foreground">{coupon.times_redeemed}</span>
                        <span className="text-muted-foreground">
                          {" "}/ {coupon.max_redemptions ? coupon.max_redemptions : "∞"}
                        </span>
                      </td>

                      {/* 7. Switch Ativo Manual */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={coupon.is_active}
                            onCheckedChange={() => handleToggleStatus(coupon)}
                            aria-label={`Alternar status do cupom ${coupon.code}`}
                          />
                        </div>
                      </td>

                      {/* 8. Ações */}
                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicate(coupon)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Duplicar / Clonar Cupom"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(coupon)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Editar Cupom"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCouponToDelete(coupon)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title="Excluir Cupom"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal: Criação / Edição Completa de Cupom */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                {selectedCoupon ? `Editar Cupom: ${selectedCoupon.code}` : "Criar Novo Cupom Promocional"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Configure os parâmetros financeiros, ciclo de vida automático e regras de elegibilidade da conta.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-3 h-10 p-1 bg-muted/60 rounded-xl">
                <TabsTrigger value="basic" className="rounded-lg text-xs font-semibold">
                  1. Desconto
                </TabsTrigger>
                <TabsTrigger value="schedule" className="rounded-lg text-xs font-semibold">
                  2. Vigência & Ciclo
                </TabsTrigger>
                <TabsTrigger value="eligibility" className="rounded-lg text-xs font-semibold">
                  3. Condições da Conta
                </TabsTrigger>
              </TabsList>

              {/* Aba 1: Dados Básicos & Desconto */}
              <TabsContent value="basic" className="space-y-4 py-3 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="coupon_code_field" className="font-semibold text-foreground">
                    Código do Cupom *
                  </Label>
                  <Input
                    id="coupon_code_field"
                    placeholder="EX: PROMO2026"
                    value={formData.code}
                    disabled={!!selectedCoupon}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "") })
                    }
                    className="bg-background border-border text-foreground font-mono tracking-wider uppercase h-10 rounded-xl"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Alfanumérico sem espaços. Letras maiúsculas automáticas.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="coupon_desc_field" className="font-semibold text-foreground">
                    Descrição do Benefício
                  </Label>
                  <Input
                    id="coupon_desc_field"
                    placeholder="Ex: Parceria CRP - 20% de Desconto por 6 meses"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-background border-border text-foreground h-10 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-semibold text-foreground">Tipo de Desconto *</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(val: DiscountType) => setFormData({ ...formData, discount_type: val })}
                    >
                      <SelectTrigger className="bg-background border-border h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                        <SelectItem value="FIXED_AMOUNT">Valor Fixo em Reais (R$)</SelectItem>
                        <SelectItem value="TRIAL_DAYS">Dias Grátis (Trial/Beta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-semibold text-foreground">
                      {formData.discount_type === "PERCENTAGE"
                        ? "Percentual (%) *"
                        : formData.discount_type === "FIXED_AMOUNT"
                        ? "Valor em R$ *"
                        : "Dias de Isenção *"}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={formData.discount_type === "PERCENTAGE" ? 100 : undefined}
                      value={formData.discount_value}
                      onChange={(e) =>
                        setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })
                      }
                      className="bg-background border-border text-foreground font-mono h-10 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="font-semibold text-foreground">Duração do Desconto *</Label>
                    <Select
                      value={formData.discount_duration_type}
                      onValueChange={(val: DiscountDurationType) =>
                        setFormData({ ...formData, discount_duration_type: val })
                      }
                    >
                      <SelectTrigger className="bg-background border-border h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOREVER">Vitalício (Todas as faturas)</SelectItem>
                        <SelectItem value="ONCE">Apenas 1ª Fatura / Adesão</SelectItem>
                        <SelectItem value="REPEATING">Temporário (Por X meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.discount_duration_type === "REPEATING" ? (
                    <div className="space-y-1">
                      <Label className="font-semibold text-foreground">Quantidade de Meses *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        placeholder="Ex: 6"
                        value={formData.discount_duration_months}
                        onChange={(e) =>
                          setFormData({ ...formData, discount_duration_months: e.target.value })
                        }
                        className="bg-background border-border text-foreground font-mono h-10 rounded-xl"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 opacity-50 pointer-events-none">
                      <Label className="font-semibold text-foreground">Quantidade de Meses</Label>
                      <Input disabled value="Não aplicável" className="h-10 rounded-xl bg-muted" />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Aba 2: Vigência & Ativação Automática */}
              <TabsContent value="schedule" className="space-y-4 py-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Ciclo de Vida Automático
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Se você preencher datas de início e término, o cupom será ativado e desativado automaticamente
                    sem necessidade de intervenção manual.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="valid_from_field" className="font-semibold text-foreground">
                      Válido a partir de (Início)
                    </Label>
                    <Input
                      id="valid_from_field"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className="bg-background border-border text-foreground h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="valid_until_field" className="font-semibold text-foreground">
                      Válido até (Expiração Automática)
                    </Label>
                    <Input
                      id="valid_until_field"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      className="bg-background border-border text-foreground h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="max_redemptions_field" className="font-semibold text-foreground">
                    Limite Máximo de Resgates Globais (Opcional)
                  </Label>
                  <Input
                    id="max_redemptions_field"
                    type="number"
                    min={1}
                    placeholder="Deixe em branco para ilimitado"
                    value={formData.max_redemptions}
                    onChange={(e) => setFormData({ ...formData, max_redemptions: e.target.value })}
                    className="bg-background border-border text-foreground font-mono h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ao atingir o número máximo, o cupom é bloqueado automaticamente para novos resgates.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-foreground cursor-pointer">
                      Ativação Manual Imediata
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Permitir aplicação agora (se estiver dentro da janela de datas).
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                  />
                </div>
              </TabsContent>

              {/* Aba 3: Condições de Elegibilidade da Conta */}
              <TabsContent value="eligibility" className="space-y-4 py-3 text-xs">
                {/* 1. Data de Criação da Clínica */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Data de Cadastro da Clínica
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select
                      value={formData.account_creation_mode}
                      onValueChange={(val: any) => setFormData({ ...formData, account_creation_mode: val })}
                    >
                      <SelectTrigger className="h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer data (Livre)</SelectItem>
                        <SelectItem value="after">Cadastrada a partir de</SelectItem>
                        <SelectItem value="before">Cadastrada antes de</SelectItem>
                        <SelectItem value="between">No intervalo entre datas</SelectItem>
                      </SelectContent>
                    </Select>

                    {(formData.account_creation_mode === "after" ||
                      formData.account_creation_mode === "between") && (
                      <Input
                        type="date"
                        placeholder="A partir de"
                        value={formData.account_creation_after}
                        onChange={(e) => setFormData({ ...formData, account_creation_after: e.target.value })}
                        className="h-9 rounded-xl"
                      />
                    )}

                    {(formData.account_creation_mode === "before" ||
                      formData.account_creation_mode === "between") && (
                      <Input
                        type="date"
                        placeholder="Até data"
                        value={formData.account_creation_before}
                        onChange={(e) => setFormData({ ...formData, account_creation_before: e.target.value })}
                        className="h-9 rounded-xl"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Quantidade de Colaboradores Registrados */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Users className="w-4 h-4 text-purple-500" />
                      Quantidade de Colaboradores Registrados
                    </div>
                    <Switch
                      checked={formData.collaborators_enabled}
                      onCheckedChange={(val) => setFormData({ ...formData, collaborators_enabled: val })}
                    />
                  </div>

                  {formData.collaborators_enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Select
                        value={formData.collaborators_operator}
                        onValueChange={(val: any) =>
                          setFormData({ ...formData, collaborators_operator: val })
                        }
                      >
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gte">Maior ou Igual (≥)</SelectItem>
                          <SelectItem value="lte">Menor ou Igual (≤)</SelectItem>
                          <SelectItem value="eq">Exatamente Igual (=)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={formData.collaborators_value}
                        onChange={(e) =>
                          setFormData({ ...formData, collaborators_value: parseInt(e.target.value, 10) || 0 })
                        }
                        className="h-9 rounded-xl font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Quantidade de Atendimentos Realizados */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      Quantidade de Atendimentos Realizados
                    </div>
                    <Switch
                      checked={formData.sessions_enabled}
                      onCheckedChange={(val) => setFormData({ ...formData, sessions_enabled: val })}
                    />
                  </div>

                  {formData.sessions_enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Select
                        value={formData.sessions_operator}
                        onValueChange={(val: any) => setFormData({ ...formData, sessions_operator: val })}
                      >
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gte">Maior ou Igual (≥)</SelectItem>
                          <SelectItem value="lte">Menor ou Igual (≤)</SelectItem>
                          <SelectItem value="eq">Exatamente Igual (=)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={formData.sessions_value}
                        onChange={(e) =>
                          setFormData({ ...formData, sessions_value: parseInt(e.target.value, 10) || 0 })
                        }
                        className="h-9 rounded-xl font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Sugestão 1: Primeira Assinatura / Novos Clientes */}
                <div className="p-3.5 rounded-xl border bg-card flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Apenas Primeira Assinatura (Novos Clientes)
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Bloqueia a aplicação para clínicas que já tenham pago qualquer fatura prévia.
                    </p>
                  </div>
                  <Switch
                    checked={formData.first_subscription_only}
                    onCheckedChange={(val) => setFormData({ ...formData, first_subscription_only: val })}
                  />
                </div>

                {/* 5. Sugestão 2: Volume de Pacientes Cadastrados */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <UserCheck className="w-4 h-4 text-indigo-500" />
                      Volume de Pacientes Cadastrados
                    </div>
                    <Switch
                      checked={formData.patients_enabled}
                      onCheckedChange={(val) => setFormData({ ...formData, patients_enabled: val })}
                    />
                  </div>

                  {formData.patients_enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Select
                        value={formData.patients_operator}
                        onValueChange={(val: any) => setFormData({ ...formData, patients_operator: val })}
                      >
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gte">Maior ou Igual (≥)</SelectItem>
                          <SelectItem value="lte">Menor ou Igual (≤)</SelectItem>
                          <SelectItem value="eq">Exatamente Igual (=)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={formData.patients_value}
                        onChange={(e) =>
                          setFormData({ ...formData, patients_value: parseInt(e.target.value, 10) || 0 })
                        }
                        className="h-9 rounded-xl font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Sugestão 3: Ciclos de Cobrança Elegíveis */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Ciclos de Faturamento Elegíveis
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Deixe desmarcado para valer em qualquer ciclo. Marque para restringir:
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    {(["monthly", "quarterly", "annual"] as const).map((cycle) => (
                      <label key={cycle} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={formData.target_billing_cycles.includes(cycle)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                target_billing_cycles: [...formData.target_billing_cycles, cycle],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                target_billing_cycles: formData.target_billing_cycles.filter((c) => c !== cycle),
                              });
                            }
                          }}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="capitalize">
                          {cycle === "monthly" ? "Mensal" : cycle === "quarterly" ? "Trimestral" : "Anual"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 7. Sugestão 4: Campanha Winback (Reativação) */}
                <div className="p-3.5 rounded-xl border bg-card flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <RefreshCcw className="w-4 h-4 text-amber-500" />
                      Campanha Winback (Apenas Clínicas Inativas/Canceladas)
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Exclusivo para recuperação de contas que cancelaram ou foram suspensas.
                    </p>
                  </div>
                  <Switch
                    checked={formData.winback_only}
                    onCheckedChange={(val) => setFormData({ ...formData, winback_only: val })}
                  />
                </div>

                {/* 8. Sugestão 5: Restrição Regional (Estados/UFs) */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    Parceria Regional / Estados Permitidos (UFs)
                  </div>
                  <Input
                    placeholder="Ex: SP, RJ, MG (separados por vírgula)"
                    value={formData.allowed_states}
                    onChange={(e) => setFormData({ ...formData, allowed_states: e.target.value.toUpperCase() })}
                    className="h-9 rounded-xl uppercase font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Deixe em branco para permitir todos os estados brasileiros.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
              >
                {submitting ? "Salvando..." : selectedCoupon ? "Salvar Alterações" : "Criar Cupom"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <Dialog open={!!couponToDelete} onOpenChange={(open) => !open && setCouponToDelete(null)}>
        <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Excluir Cupom Promocional
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Tem certeza que deseja excluir permanentemente o cupom{" "}
              <strong className="text-foreground">{couponToDelete?.code}</strong>? Clínicas que já resgataram
              manterão seus registros históricos, mas ninguém mais poderá utilizá-lo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCouponToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
