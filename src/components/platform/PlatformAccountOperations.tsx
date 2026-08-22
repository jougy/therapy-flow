import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { AccountOperation } from "./types";
import {
  accountOperationLabels,
  callPlatformAccountAdmin,
  destructiveOperations,
  getErrorMessage,
} from "./platform-api";

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
  title: string;
}) => {
  const operations = allowedOperations?.length ? allowedOperations : (Object.keys(accountOperationLabels) as AccountOperation[]);
  const [operation, setOperation] = useState<AccountOperation>(operations[0] ?? "create_subaccount");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
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

  const updateField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

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
    if (operation === "create_subaccount") {
      return { ...base, email: form.email, fullName: form.fullName, password: form.password, role: form.role, status: form.status };
    }
    if (operation === "update_clinic_access") {
      return {
        ...base,
        concurrentAccessLimit: form.concurrentAccessLimit,
        status: form.status,
        subaccountLimit: form.subaccountLimit,
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
    try {
      await callPlatformAccountAdmin(operation, buildPayload(), reason);
      toast({ title: "Operação concluída", description: `${accountOperationLabels[operation]} foi registrada na auditoria master.` });
      setConfirmation("");
      onDone();
    } catch (error) {
      toast({
        title: "Operação administrativa falhou",
        description: getErrorMessage(error),
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
        {!clinicId && (
          <div className="space-y-1">
            <Label>ID/CNPJ da clínica</Label>
            <Input value={form.clinicId} onChange={(event) => updateField("clinicId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation.includes("subaccount") || operation === "update_owner_access" || operation === "resend_invitation" || operation === "confirm_user_email_manually" || operation === "delete_user_attempt") && operation !== "create_subaccount" && (
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
        {(operation === "create_subaccount" || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>{operation === "create_patient" ? "Nome do paciente" : "Nome da conta"}</Label>
            <Input value={operation === "create_patient" ? form.name : form.fullName} onChange={(event) => updateField(operation === "create_patient" ? "name" : "fullName", event.target.value)} maxLength={120} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_patient") && (
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
        {(operation === "create_subaccount" || operation === "update_owner_access" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>{operation === "create_subaccount" ? "Senha inicial" : "Nova senha"}</Label>
            <Input value={form.password} onChange={(event) => updateField("password", event.target.value)} type="password" maxLength={128} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>Papel operacional</Label>
            <OperationalRoleSelect value={form.role} onValueChange={(value) => updateField("role", value)} />
          </div>
        )}
        {(operation === "create_subaccount" || operation.startsWith("update_") || operation === "create_patient") && (
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
        {(operation === "create_patient" || operation === "update_patient" || operation === "update_owner_access") && (
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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-1">
          <Label>Motivo auditável</Label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </div>
        {isDestructive && (
          <div className="space-y-1">
            <Label>Confirmação</Label>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite EXCLUIR" />
            <p className="text-xs text-destructive">Ação destrutiva auditada e sem atalho visual.</p>
          </div>
        )}
      </div>
      <Button
        disabled={saving || reason.trim().length < 8 || (isDestructive && confirmation !== "EXCLUIR")}
        onClick={() => void handleSubmit()}
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Executar ação administrativa
      </Button>
    </div>
  );
};
