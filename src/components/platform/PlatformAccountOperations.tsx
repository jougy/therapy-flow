import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarPlus, CheckCircle2, Gift, Info, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { AccountOperation } from "./types";
import {
  accountOperationLabels,
  callPlatformAccountAdmin,
  destructiveOperations,
  getErrorMessage,
} from "./platform-api";

const clinicStatusLabels: Record<string, string> = {
  active: "Ativa",
  payment_pending: "Pagamento pendente",
  temporarily_paused: "Pausada temporariamente",
  banned: "Bloqueada",
  delete: "Excluir definitivamente",
};

const planLabels: Record<string, string> = {
  solo: "Plano Solo (1 profissional)",
  clinic: "Plano com Equipe (Clínica)",
};

const AccountStatusSelect = ({ onValueChange, value }: { onValueChange: (value: string) => void; value: string }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Ativa</SelectItem>
      <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
      <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
      <SelectItem value="banned">Bloqueada</SelectItem>
    </SelectContent>
  </Select>
);

const ClinicAccessStatusSelect = ({ onValueChange, value }: { onValueChange: (value: string) => void; value: string }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Ativa</SelectItem>
      <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
      <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
      <SelectItem value="banned">Bloqueada</SelectItem>
      <SelectItem value="delete">Excluir definitivamente</SelectItem>
    </SelectContent>
  </Select>
);

const OperationalRoleSelect = ({ onValueChange, value }: { onValueChange: (value: string) => void; value: string }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Administrador</SelectItem>
      <SelectItem value="professional">Profissional</SelectItem>
      <SelectItem value="assistant">Assistente</SelectItem>
      <SelectItem value="estagiario">Estagiário</SelectItem>
    </SelectContent>
  </Select>
);

export const PlatformAccountOperations = ({
  allowedOperations,
  clinicId,
  clinicAccessStatus = "active",
  concurrentAccessLimit = "4",
  compact = false,
  defaultIdentifier = "",
  defaultPatientId = "",
  onDone,
  subaccountLimit = "4",
  subscriptionPlan: initialSubscriptionPlan = "clinic",
  subscriptionData,
  title,
}: {
  allowedOperations?: AccountOperation[];
  clinicId?: string;
  clinicAccessStatus?: string;
  concurrentAccessLimit?: string;
  compact?: boolean;
  defaultIdentifier?: string;
  defaultPatientId?: string;
  onDone: () => void;
  subaccountLimit?: string;
  subscriptionPlan?: "solo" | "clinic";
  subscriptionData?: any;
  title: string;
}) => {
  const operations = allowedOperations?.length ? allowedOperations : (Object.keys(accountOperationLabels) as AccountOperation[]);
  const [operation, setOperation] = useState<AccountOperation>(operations[0] ?? "create_subaccount");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState<"solo" | "clinic">(initialSubscriptionPlan ?? "clinic");
  const [isCourtesy, setIsCourtesy] = useState<boolean>(
    subscriptionData?.is_courtesy === true || subscriptionData?.status === "COURTESY"
  );
  const [daysAdjustment, setDaysAdjustment] = useState<string>("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>(
    subscriptionData?.status ?? "ACTIVE"
  );

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
    clinicId: clinicId ?? "",
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
      clinicId: clinicId ?? prev.clinicId,
      concurrentAccessLimit: concurrentAccessLimit || prev.concurrentAccessLimit,
      status: clinicAccessStatus || prev.status,
      subaccountLimit: subaccountLimit || prev.subaccountLimit,
    }));
  }, [clinicId, clinicAccessStatus, concurrentAccessLimit, subaccountLimit]);

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

  const updateField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handlePlanChange = (newPlan: "solo" | "clinic") => {
    setSubscriptionPlan(newPlan);
    if (newPlan === "solo") {
      updateField("concurrentAccessLimit", "1");
      updateField("subaccountLimit", "1");
    } else {
      updateField("concurrentAccessLimit", "2");
      updateField("subaccountLimit", "30");
    }
  };

  const currentExpiresAt = subscriptionData?.expires_at || subscriptionData?.current_period_end;
  const currentRemainingDays = currentExpiresAt
    ? Math.max(0, Math.ceil((new Date(currentExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const previewInfo = () => {
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
  };

  const preview = previewInfo();

  const updateOperation = (value: AccountOperation) => {
    setOperation(value);
    setConfirmation("");
    setMfaCode("");
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

  const handleSubmit = async () => {
    setSaving(true);
    const actionToExecute = isDeletingClinic ? "delete_clinic_package" : operation;
    const payloadToExecute = isDeletingClinic ? { clinicId: effectiveClinicId } : buildPayload();
    try {
      if (isDestructive) {
        const cleanMfaCode = mfaCode.trim().replace(/\D/g, "");
        if (cleanMfaCode.length !== 6) {
          throw new Error("Informe o código 2FA/MFA de 6 dígitos do seu autenticador (Ente Auth).");
        }

        const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;

        const totpFactors = Array.isArray(factorData?.totp) ? factorData.totp : [];
        const verifiedFactor = totpFactors.find((factor) => factor.status === "verified") ?? totpFactors[0];

        if (!verifiedFactor) {
          throw new Error("Nenhum segundo fator (2FA/MFA) verificado encontrado na sua conta master.");
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: verifiedFactor.id,
          code: cleanMfaCode,
        });

        if (verifyError) {
          throw new Error(`Código MFA inválido ou expirado: ${verifyError.message}`);
        }
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
      setMfaCode("");
      setReason("");
      setDaysAdjustment("");
      onDone();
    } catch (error) {
      toast({
        title: "Operação administrativa falhou",
        description: `${getErrorMessage(error)} (Pressione Cmd+Ctrl+D para ver o log de debug)`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Espelha o Gerenciamento de Contas do script operacional, com MFA, backend seguro e motivo obrigatório.</p>
      </div>

      {pendingChanges.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Alterações pendentes (não salvas no banco):</span>
          </div>
          <ul className="mt-1.5 list-disc list-inside space-y-1 text-xs pl-1">
            {pendingChanges.map((change, idx) => (
              <li key={idx} className="font-medium">
                {change}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-300/90">
            ⚠️ <strong>Atenção:</strong> Essas opções <strong>ainda não foram aplicadas</strong>. Para salvar definitivamente, informe o motivo auditável abaixo (mínimo de 8 caracteres) e clique em <strong>Salvar e aplicar alterações pendentes</strong>.
          </p>
        </div>
      )}
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
        {!clinicId && (operation !== "create_simple_user" || form.clinicId) && (
          <div className="space-y-1">
            <Label>ID/CNPJ da clínica {operation === "create_simple_user" ? "(opcional)" : ""}</Label>
            <Input value={form.clinicId} onChange={(event) => updateField("clinicId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation.includes("subaccount") || operation.includes("user_to_clinic") || operation === "remove_user_from_clinic" || operation === "update_membership_role" || operation === "update_owner_access" || operation === "resend_invitation" || operation === "confirm_user_email_manually" || operation === "delete_user_attempt") && operation !== "create_subaccount" && operation !== "create_simple_user" && (
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
        {(operation === "create_subaccount" || operation === "create_simple_user" || operation === "update_owner_access" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>{operation === "create_subaccount" || operation === "create_simple_user" ? "Senha inicial" : "Nova senha"}</Label>
            <Input value={form.password} onChange={(event) => updateField("password", event.target.value)} type="password" maxLength={128} />
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
              onValueChange={(value) => handlePlanChange(value as "solo" | "clinic")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Plano Solo (1 profissional)</SelectItem>
                <SelectItem value="clinic">Plano com Equipe (Clínica)</SelectItem>
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
            <Input value={form.concurrentAccessLimit} onChange={(event) => updateField("concurrentAccessLimit", event.target.value)} inputMode="numeric" maxLength={3} />
          </div>
        )}
        {operation === "update_clinic_access" && (
          <div className="space-y-1">
            <Label>Limite de subcontas</Label>
            <Input value={form.subaccountLimit} onChange={(event) => updateField("subaccountLimit", event.target.value)} inputMode="numeric" maxLength={3} />
          </div>
        )}
      </div>

      {operation === "update_clinic_access" && (
        <div className="space-y-3 rounded-lg border bg-background/80 p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <Label htmlFor="courtesy-switch" className="text-sm font-semibold cursor-pointer">
                  Plano de Cortesia Parceira
                </Label>
                {isCourtesy && (
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium border-emerald-500/30">
                    Vitalício & Gratuito
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Concede isenção permanente para clínicas parceiras/apoiadoras: nunca expira e não gera cobrança até revogação deliberada.
              </p>
            </div>
            <Switch
              id="courtesy-switch"
              checked={isCourtesy}
              onCheckedChange={(checked) => {
                setIsCourtesy(checked);
                if (checked) setDaysAdjustment("");
              }}
            />
          </div>

          {!isCourtesy && (
            <div className="space-y-2 border-t pt-2.5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5">
                  <CalendarPlus className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Dar / Tirar dias de assinatura</span>
                </div>
                {currentExpiresAt ? (
                  <span className="text-xs text-muted-foreground">
                    Vencimento atual: <strong>{new Date(currentExpiresAt).toLocaleDateString("pt-BR")}</strong> ({currentRemainingDays} dias restantes)
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem vencimento ativo registrado</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <Input
                    type="number"
                    placeholder="+/- dias (ex: 30)"
                    value={daysAdjustment}
                    onChange={(event) => setDaysAdjustment(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {[7, 15, 30, 60, 90, 365].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setDaysAdjustment(String((Number(daysAdjustment) || 0) + d))}
                    >
                      +{d}d
                    </Button>
                  ))}
                  {[-15, -30].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setDaysAdjustment(String((Number(daysAdjustment) || 0) + d))}
                    >
                      {d}d
                    </Button>
                  ))}
                  {daysAdjustment && daysAdjustment !== "0" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      onClick={() => setDaysAdjustment("")}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              {preview && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs text-foreground font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    Novo vencimento previsto: <strong>{preview.dateStr}</strong> ({preview.daysText}) [{preview.diffText}]
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className={`grid gap-3 ${isDestructive ? "lg:grid-cols-[minmax(0,1fr)_180px_180px]" : "lg:grid-cols-[minmax(0,1fr)_220px]"}`}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              <span>Motivo auditável</span>
              <span className="text-xs text-destructive">*</span>
            </Label>
            <span
              className={`text-xs font-medium ${
                reason.trim().length >= 8
                  ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {reason.trim().length >= 8 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Pronto para salvar ({reason.trim().length}/1000)
                </>
              ) : (
                `Faltam ${Math.max(0, 8 - reason.trim().length)} caractere(s) (${reason.trim().length}/8)`
              )}
            </span>
          </div>

          {quickReasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Motivos rápidos:
              </span>
              {quickReasons.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => setReason(qr)}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            placeholder="Informe a justificativa da ação administrativa (mínimo de 8 caracteres)..."
            className="min-h-[75px]"
          />
        </div>
        {isDestructive && (
          <>
            <div className="space-y-1">
              <Label>Confirmação</Label>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Digite EXCLUIR"
              />
              <p className="text-xs text-destructive">Digite EXCLUIR</p>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                Código 2FA / MFA
              </Label>
              <Input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">App autenticador (Ente Auth)</p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 pt-1">
        {reason.trim().length < 8 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Preencha a justificativa com pelo menos 8 caracteres para liberar a execução da ação.</span>
          </p>
        )}

        <Button
          disabled={
            saving ||
            reason.trim().length < 8 ||
            (isDestructive && (confirmation !== "EXCLUIR" || mfaCode.trim().length !== 6))
          }
          onClick={() => void handleSubmit()}
          variant={isDestructive ? "destructive" : "default"}
          className={
            !isDestructive && pendingChanges.length > 0 && reason.trim().length >= 8
              ? "ring-2 ring-primary ring-offset-2 font-semibold shadow-md"
              : ""
          }
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDestructive
            ? "Confirmar e excluir com 2FA"
            : pendingChanges.length > 0
            ? "Salvar e aplicar alterações pendentes"
            : "Executar ação administrativa"}
        </Button>
      </div>
    </div>
  );
};
