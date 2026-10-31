import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlatformOperationPendingChanges } from "./PlatformOperationPendingChanges";
import {
  AccountStatusSelect,
  ClinicAccessStatusSelect,
  OperationalRoleSelect,
} from "./PlatformOperationFieldSelects";
import { PlatformReauthModal } from "./PlatformReauthModal";
import { PlatformOperationReasonAuditSection } from "./PlatformOperationReasonAuditSection";
import {
  PlatformSubscriptionAdjustmentPanel,
  type SubscriptionPreview,
} from "./PlatformSubscriptionAdjustmentPanel";
import type { AccountOperation, PlatformSubscriptionData } from "./types";
import {
  accountOperationLabels,
  callPlatformAccountAdmin,
  clinicStatusLabels,
  destructiveOperations,
  getErrorMessage,
  getPlanDefaultLimits,
  planLabels,
  planOptionGroups,
} from "./platform-api";

export interface PlatformAccountOperationsProps {
  allowedOperations?: AccountOperation[];
  clinicId?: string;
  clinicAccessStatus?: string;
  concurrentAccessLimit?: string;
  compact?: boolean;
  defaultIdentifier?: string;
  defaultPatientId?: string;
  availableMemberships?: Array<{ clinic_id?: string; clinic_name?: string; operational_role?: string; account_role?: string }>;
  onDone: () => void;
  subaccountLimit?: string;
  subscriptionPlan?: string;
  subscriptionData?: PlatformSubscriptionData | null;
  title: string;
}

export const PlatformAccountOperations = ({
  allowedOperations,
  clinicId,
  clinicAccessStatus = "active",
  concurrentAccessLimit = "4",
  compact = false,
  defaultIdentifier = "",
  defaultPatientId = "",
  availableMemberships = [],
  onDone,
  subaccountLimit = "4",
  subscriptionPlan: initialSubscriptionPlan = "clinica_medio",
  subscriptionData,
  title,
}: PlatformAccountOperationsProps) => {
  const operations = allowedOperations?.length ? allowedOperations : (Object.keys(accountOperationLabels) as AccountOperation[]);
  const [operation, setOperation] = useState<AccountOperation>(operations[0] ?? "reset_user_password");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>(initialSubscriptionPlan ?? "clinica_medio");
  const [isCourtesy, setIsCourtesy] = useState<boolean>(
    subscriptionData?.is_courtesy === true || subscriptionData?.status === "COURTESY"
  );
  const [daysAdjustment, setDaysAdjustment] = useState<string>("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>(
    subscriptionData?.status ?? "ACTIVE"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [forcePasswordReset, setForcePasswordReset] = useState(true);

  useEffect(() => {
    if (initialSubscriptionPlan) {
      setSubscriptionPlan(initialSubscriptionPlan);
    }
  }, [initialSubscriptionPlan]);

  useEffect(() => {
    if (subscriptionData) {
      setIsCourtesy(subscriptionData.is_courtesy === true || subscriptionData.status === "COURTESY");
      setSubscriptionStatus(subscriptionData.status ?? "ACTIVE");
    }
  }, [subscriptionData]);

  const [form, setForm] = useState<Record<string, string>>({
    clinicId: clinicId ?? availableMemberships[0]?.clinic_id ?? "",
    concurrentAccessLimit,
    cpf: "",
    dateOfBirth: "",
    email: "",
    fullName: "",
    identifier: defaultIdentifier,
    name: "",
    newEmail: "",
    password: "",
    patientId: defaultPatientId,
    phone: "",
    role: "professional",
    status: clinicAccessStatus,
    subaccountLimit,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      clinicId: clinicId || (availableMemberships[0]?.clinic_id ?? prev.clinicId),
      concurrentAccessLimit: concurrentAccessLimit || prev.concurrentAccessLimit,
      status: clinicAccessStatus || prev.status,
      subaccountLimit: subaccountLimit || prev.subaccountLimit,
    }));
  }, [clinicId, clinicAccessStatus, concurrentAccessLimit, subaccountLimit, availableMemberships]);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, password: generated }));
    setShowPassword(true);
    toast({
      title: "Senha segura gerada",
      description: "A senha aleatória foi preenchida no campo. Você pode visualizá-la ou copiá-la.",
    });
  };

  const pendingChanges = useMemo(() => {
    const changes: string[] = [];
    if (operation === "update_clinic_access") {
      const currentPlan = initialSubscriptionPlan ?? "clinic";
      if (subscriptionPlan !== currentPlan) {
        changes.push(
          `Tipo de plano: ${planLabels[currentPlan] || currentPlan} ➔ ${planLabels[subscriptionPlan] || subscriptionPlan}`
        );
      }
      const initialCourtesy = subscriptionData?.is_courtesy === true || subscriptionData?.status === "COURTESY";
      if (isCourtesy !== initialCourtesy) {
        changes.push(
          `Cortesia Parceira: ${initialCourtesy ? "Ativada" : "Desativada"} ➔ ${isCourtesy ? "Ativada" : "Desativada"}`
        );
      }
      if (daysAdjustment && daysAdjustment !== "0") {
        const days = Number(daysAdjustment);
        if (Number.isFinite(days) && days !== 0) {
          changes.push(`Dias de assinatura: ${days > 0 ? `+${days}` : days} dia(s)`);
        }
      }
      if (form.status !== clinicAccessStatus) {
        changes.push(
          `Status da clínica: ${clinicStatusLabels[clinicAccessStatus] || clinicAccessStatus} ➔ ${clinicStatusLabels[form.status] || form.status}`
        );
      }
      if (form.concurrentAccessLimit !== concurrentAccessLimit) {
        changes.push(`Acessos simultâneos: ${concurrentAccessLimit} ➔ ${form.concurrentAccessLimit}`);
      }
      if (form.subaccountLimit !== subaccountLimit) {
        changes.push(`Limite de subcontas: ${subaccountLimit} ➔ ${form.subaccountLimit}`);
      }
    }
    return changes;
  }, [
    operation,
    subscriptionPlan,
    initialSubscriptionPlan,
    subscriptionData,
    isCourtesy,
    daysAdjustment,
    form.status,
    form.concurrentAccessLimit,
    form.subaccountLimit,
    clinicAccessStatus,
    concurrentAccessLimit,
    subaccountLimit,
  ]);

  const quickReasons = useMemo(() => {
    if (operation === "update_clinic_access") {
      const suggestions: string[] = [];
      const currentPlan = initialSubscriptionPlan ?? "clinic";
      if (subscriptionPlan !== currentPlan) {
        suggestions.push(subscriptionPlan === "clinic" ? "Upgrade para Plano com Equipe" : "Downgrade para Plano Solo");
      }
      const initialCourtesy = subscriptionData?.is_courtesy === true || subscriptionData?.status === "COURTESY";
      if (isCourtesy !== initialCourtesy) {
        suggestions.push(isCourtesy ? "Concessão de Cortesia Parceira vitalícia" : "Revogação de Cortesia Parceira");
      }
      if (daysAdjustment && daysAdjustment !== "0") {
        const d = Number(daysAdjustment);
        suggestions.push(`Ajuste e extensão de ${d > 0 ? `+${d}` : d} dias na assinatura`);
      }
      if (form.status !== clinicAccessStatus) {
        suggestions.push(`Alteração de status da clínica para ${clinicStatusLabels[form.status] || form.status}`);
      }
      const fallbacks = [
        "Upgrade para Plano com Equipe",
        "Downgrade para Plano Solo",
        "Concessão de Cortesia Parceira",
        "Extensão de dias de assinatura",
        "Ajuste operacional de acesso e limites",
      ];
      for (const fb of fallbacks) {
        if (!suggestions.includes(fb) && suggestions.length < 5) {
          suggestions.push(fb);
        }
      }
      return suggestions.slice(0, 5);
    }
    return [
      "Ajuste operacional de acesso",
      "Solicitação formal do suporte",
      "Atualização cadastral autorizada",
    ];
  }, [
    operation,
    subscriptionPlan,
    initialSubscriptionPlan,
    subscriptionData,
    isCourtesy,
    daysAdjustment,
    form.status,
    clinicAccessStatus,
  ]);

  const updateField = useCallback((key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handlePlanChange = useCallback((newPlan: string) => {
    setSubscriptionPlan(newPlan);
    const limits = getPlanDefaultLimits(newPlan);
    setForm((current) => ({
      ...current,
      concurrentAccessLimit: String(limits.concurrent),
      subaccountLimit: String(limits.subaccounts),
    }));
  }, []);

  const currentExpiresAt = subscriptionData?.expires_at || subscriptionData?.current_period_end;
  const currentRemainingDays = currentExpiresAt
    ? Math.max(0, Math.ceil((new Date(currentExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const preview: SubscriptionPreview | null = useMemo(() => {
    const days = Number(daysAdjustment);
    if (!Number.isFinite(days) || days === 0) return null;
    const now = Date.now();
    const currentMs = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;
    const baseMs = currentMs > now ? currentMs : now;
    const targetMs = baseMs + days * 86400000;
    const newDate = new Date(targetMs);
    const totalRemaining = Math.max(0, Math.ceil((targetMs - now) / 86400000));
    return {
      dateStr: newDate.toLocaleDateString("pt-BR"),
      daysText: `${totalRemaining} dia(s) restante(s)`,
      diffText: days > 0 ? `+${days} dias` : `${days} dias`,
      isPositive: days > 0,
    };
  }, [daysAdjustment, currentExpiresAt]);

  const updateOperation = (value: AccountOperation) => {
    setOperation(value);
    setConfirmation("");
    setForm((current) => ({
      ...current,
      status: value === "update_clinic_access" ? clinicAccessStatus : current.status === "delete" ? "active" : current.status,
    }));
  };

  const effectiveClinicId = form.clinicId || clinicId || "";
  const isDeletingClinic = operation === "update_clinic_access" && form.status === "delete";
  const isDestructive = destructiveOperations.has(operation) || isDeletingClinic;

  const buildPayload = () => {
    const base = { clinicId: effectiveClinicId };
    if (operation === "create_subaccount" || operation === "create_simple_user") {
      return { ...base, cpf: form.cpf, email: form.email, fullName: form.fullName, password: form.password, phone: form.phone, role: form.role, status: form.status };
    }
    if (operation === "assign_user_to_clinic") {
      return { clinicId: effectiveClinicId, identifier: form.identifier, role: form.role, status: form.status };
    }
    if (operation === "remove_user_from_clinic") {
      return { clinicId: effectiveClinicId, identifier: form.identifier };
    }
    if (operation === "update_membership_role") {
      return { clinicId: effectiveClinicId, identifier: form.identifier, role: form.role, status: form.status };
    }
    if (operation === "update_clinic_access") {
      return {
        ...base,
        concurrentAccessLimit: form.concurrentAccessLimit,
        daysAdjustment: daysAdjustment ? Number(daysAdjustment) : undefined,
        isCourtesy,
        status: form.status,
        subaccountLimit: form.subaccountLimit,
        subscriptionPlan,
        subscriptionStatus: isCourtesy ? "COURTESY" : subscriptionStatus,
      };
    }
    if (operation === "update_owner_access") {
      return {
        concurrentAccessLimit: form.concurrentAccessLimit,
        cnpj: form.cpf,
        identifier: form.identifier,
        newEmail: form.newEmail,
        password: form.password,
        status: form.status,
      };
    }
    if (operation === "reset_user_password") {
      return {
        identifier: form.identifier,
        password: form.password,
        temporary: forcePasswordReset,
      };
    }
    if (operation === "update_subaccount_access") {
      return { identifier: form.identifier, newEmail: form.newEmail, password: form.password, role: form.role, status: form.status };
    }
    if (operation === "delete_subaccount") return { identifier: form.identifier };
    if (operation === "resend_invitation") return { identifier: form.identifier, invitationId: form.identifier };
    if (operation === "confirm_user_email_manually") return { identifier: form.identifier };
    if (operation === "delete_user_attempt") return { identifier: form.identifier };
    if (operation === "create_patient") {
      return { ...base, cpf: form.cpf, dateOfBirth: form.dateOfBirth, email: form.email, name: form.name, phone: form.phone, status: form.status };
    }
    if (operation === "update_patient") {
      return { cpf: form.cpf, dateOfBirth: form.dateOfBirth, email: form.email, name: form.name, patientId: form.patientId, phone: form.phone, status: form.status };
    }
    return { patientId: form.patientId };
  };

  const handleOpenReauth = () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 8) {
      toast({
        title: "Motivo auditável insuficiente",
        description: `O motivo precisa ter no mínimo 8 caracteres (atualmente ${trimmedReason.length}). Preencha para prosseguir com a reautenticação 2FA.`,
        variant: "destructive",
      });
      return;
    }
    if (isDestructive && confirmation !== "EXCLUIR") {
      toast({
        title: "Confirmação exigida",
        description: "Digite exatamente 'EXCLUIR' no campo de confirmação antes de prosseguir.",
        variant: "destructive",
      });
      return;
    }
    setIsReauthOpen(true);
  };

  const handleConfirmedExecution = async () => {
    setSaving(true);
    const actionToExecute = isDeletingClinic ? "delete_clinic_package" : operation;
    const payloadToExecute = isDeletingClinic ? { clinicId: effectiveClinicId } : buildPayload();
    try {
      // Garante sessão renovada/atualizada do Supabase Auth após o 2FA antes de chamar a Edge Function
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        throw new Error("Sessão expirada ou não autenticada após reautenticação. Faça login novamente.");
      }

      await callPlatformAccountAdmin(actionToExecute, payloadToExecute, reason);
      const successDescription = pendingChanges.length > 0
        ? `Alterações aplicadas: ${pendingChanges.join("; ")}.`
        : `${accountOperationLabels[operation] || actionToExecute} foi registrada na auditoria master.`;
      toast({
        title: "Operação concluída com sucesso",
        description: successDescription,
      });
      setConfirmation("");
      setReason("");
      setDaysAdjustment("");
      onDone();
    } catch (error) {
      toast({
        title: "Operação administrativa falhou",
        description: `${getErrorMessage(error)} (Pressione Cmd+Ctrl+D para ver o log de debug)`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3 overflow-hidden">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Espelha o Gerenciamento de Contas do script operacional, com MFA, backend seguro e motivo obrigatório.</p>
      </div>

      <PlatformOperationPendingChanges changes={pendingChanges} />

      <div className={`grid gap-3 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <div className="space-y-1">
          <Label>Ação</Label>
          <Select value={operation} onValueChange={(value) => updateOperation(value as AccountOperation)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {operations.map((key) => (
                <SelectItem key={key} value={key}>{accountOperationLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Seletor de Clínica Obrigatório / Contexto Clínico para operações que afetam relação com clínica */}
        {(operation === "update_membership_role" || operation === "assign_user_to_clinic" || operation === "remove_user_from_clinic") && (
          <div className="space-y-1">
            <Label className="flex items-center gap-1 font-semibold text-primary">
              Clínica afetada <span className="text-destructive">*</span>
            </Label>
            {availableMemberships.length > 0 ? (
              <Select
                value={form.clinicId}
                onValueChange={(val) => updateField("clinicId", val)}
              >
                <SelectTrigger className="border-primary/40 bg-background font-medium">
                  <SelectValue placeholder="Selecione a clínica..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMemberships.map((m) => (
                    <SelectItem key={String(m.clinic_id)} value={String(m.clinic_id)}>
                      {m.clinic_name || "Clínica sem nome"} ({m.operational_role || m.account_role || "membro"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="ID ou CNPJ da clínica"
                value={form.clinicId}
                onChange={(event) => updateField("clinicId", event.target.value)}
                maxLength={60}
              />
            )}
          </div>
        )}

        {!clinicId && (operation !== "create_simple_user" || form.clinicId) && operation !== "update_membership_role" && operation !== "assign_user_to_clinic" && operation !== "remove_user_from_clinic" && operation !== "reset_user_password" && (
          <div className="space-y-1">
            <Label>ID/CNPJ da clínica {operation === "create_simple_user" ? "(opcional)" : ""}</Label>
            <Input value={form.clinicId} onChange={(event) => updateField("clinicId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation.includes("subaccount") || operation.includes("user_to_clinic") || operation === "remove_user_from_clinic" || operation === "update_membership_role" || operation === "update_owner_access" || operation === "resend_invitation" || operation === "confirm_user_email_manually" || operation === "delete_user_attempt" || operation === "reset_user_password") && operation !== "create_subaccount" && operation !== "create_simple_user" && (
          <div className="space-y-1">
            <Label>E-mail, ID da conta ou convite</Label>
            <Input value={form.identifier} onChange={(event) => updateField("identifier", event.target.value)} maxLength={160} />
          </div>
        )}
        {operation.includes("patient") && operation !== "create_patient" && (
          <div className="space-y-1">
            <Label>ID do paciente</Label>
            <Input value={form.patientId} onChange={(event) => updateField("patientId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>{operation === "create_patient" ? "Nome do paciente" : "Nome da conta"}</Label>
            <Input value={operation === "create_patient" ? form.name : form.fullName} onChange={(event) => updateField(operation === "create_patient" ? "name" : "fullName", event.target.value)} maxLength={120} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(event) => updateField("email", event.target.value)} maxLength={160} />
          </div>
        )}
        {(operation === "update_owner_access" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>Novo e-mail</Label>
            <Input value={form.newEmail} onChange={(event) => updateField("newEmail", event.target.value)} maxLength={160} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "update_owner_access" || operation === "update_subaccount_access" || operation === "reset_user_password") && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>
                {operation === "reset_user_password"
                  ? "Nova senha para o usuário"
                  : operation === "create_subaccount" || operation === "create_simple_user"
                  ? "Senha inicial"
                  : "Nova senha"}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateRandomPassword}
                className="h-6 px-1.5 text-[11px] text-primary hover:text-primary/80 gap-1"
                title="Gerar senha aleatória segura"
              >
                <RefreshCw className="h-3 w-3" />
                Gerar senha
              </Button>
            </div>
            <div className="relative">
              <Input
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                type={showPassword ? "text" : "password"}
                maxLength={128}
                className="pr-10"
                placeholder={operation === "reset_user_password" ? "Digite a senha ou clique em 'Gerar senha'" : ""}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                title={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">Visualizar senha</span>
              </Button>
            </div>
          </div>
        )}

        {operation === "reset_user_password" && (
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="force-password-reset"
              checked={forcePasswordReset}
              onCheckedChange={(checked) => setForcePasswordReset(checked === true)}
            />
            <Label
              htmlFor="force-password-reset"
              className="text-xs font-normal leading-tight cursor-pointer"
            >
              Exigir redefinição no próximo login (alerta amigável para o usuário)
            </Label>
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "assign_user_to_clinic" || operation === "update_membership_role" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>Papel operacional (Hierarquia)</Label>
            <OperationalRoleSelect value={form.role} onValueChange={(value) => updateField("role", value)} />
          </div>
        )}
        {operation === "update_clinic_access" && (
          <div className="space-y-1">
            <Label>Tipo de plano</Label>
            <Select
              value={subscriptionPlan}
              onValueChange={handlePlanChange}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {planOptionGroups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "assign_user_to_clinic" || operation === "update_membership_role" || operation.startsWith("update_") || operation === "create_patient") && operation !== "update_owner_access" && (
          <div className="space-y-1">
            <Label>{operation === "update_clinic_access" ? "Status da clínica" : "Status"}</Label>
            {operation === "update_clinic_access" ? (
              <ClinicAccessStatusSelect value={form.status} onValueChange={(value) => updateField("status", value)} />
            ) : operation === "create_patient" || operation === "update_patient" ? (
              <Input value={form.status} onChange={(event) => updateField("status", event.target.value)} maxLength={50} />
            ) : (
              <AccountStatusSelect value={form.status} onValueChange={(value) => updateField("status", value)} />
            )}
          </div>
        )}
        {(operation === "create_simple_user" || operation === "create_patient" || operation === "update_patient" || operation === "update_owner_access") && (
          <div className="space-y-1">
            <Label>{operation === "update_owner_access" ? "CPF/CNPJ" : "CPF"}</Label>
            <Input value={form.cpf} onChange={(event) => updateField("cpf", event.target.value)} maxLength={18} />
          </div>
        )}
        {(operation === "create_patient" || operation === "update_patient") && (
          <>
            <div className="space-y-1">
              <Label>Nascimento</Label>
              <Input value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} placeholder="AAAA-MM-DD" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} maxLength={20} />
            </div>
          </>
        )}
        {(operation === "update_owner_access" || operation === "update_clinic_access") && (
          <div className="space-y-1">
            <Label>Acessos simultâneos</Label>
            <Input value={form.concurrentAccessLimit} onChange={(event) => updateField("concurrentAccessLimit", event.target.value)} inputMode="numeric" maxLength={6} />
          </div>
        )}
        {operation === "update_clinic_access" && (
          <div className="space-y-1">
            <Label>Limite de subcontas</Label>
            <Input value={form.subaccountLimit} onChange={(event) => updateField("subaccountLimit", event.target.value)} inputMode="numeric" maxLength={6} />
          </div>
        )}
      </div>

      {operation === "update_clinic_access" && (
        <PlatformSubscriptionAdjustmentPanel
          isCourtesy={isCourtesy}
          onCourtesyChange={(checked) => {
            setIsCourtesy(checked);
            if (checked) setDaysAdjustment("");
          }}
          daysAdjustment={daysAdjustment}
          onDaysAdjustmentChange={setDaysAdjustment}
          currentExpiresAt={currentExpiresAt}
          currentRemainingDays={currentRemainingDays}
          preview={preview}
        />
      )}

      <PlatformOperationReasonAuditSection
        reason={reason}
        onReasonChange={setReason}
        quickReasons={quickReasons}
        isDestructive={isDestructive}
        confirmation={confirmation}
        onConfirmationChange={setConfirmation}
        saving={saving}
        pendingChangesCount={pendingChanges.length}
        onOpenReauth={handleOpenReauth}
      />

      <PlatformReauthModal
        open={isReauthOpen}
        onOpenChange={setIsReauthOpen}
        pendingChanges={pendingChanges}
        reason={reason}
        actionLabel={accountOperationLabels[operation] || (isDeletingClinic ? "Excluir clínica definitivamente" : operation)}
        isDestructive={isDestructive}
        onConfirm={handleConfirmedExecution}
      />
    </div>
  );
};
