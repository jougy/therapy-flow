import { type FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { callPlatformAccountAdmin, callRpc, getErrorMessage } from "./platform-api";

interface SimpleClinicOption {
  clinic_id: string;
  clinic_name: string;
  clinic_cnpj: string;
}

export const CreateAccountDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [accountType, setAccountType] = useState<"clinic_owner" | "solo_owner" | "simple_user">("clinic_owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");
  const [concurrentLimit, setConcurrentLimit] = useState("4");
  const [operationalRole, setOperationalRole] = useState("professional");
  const [selectedClinicId, setSelectedClinicId] = useState("none");
  const [clinics, setClinics] = useState<SimpleClinicOption[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchClinics = async () => {
      setLoadingClinics(true);
      try {
        const { data, error } = await callRpc("list_platform_clinics");
        if (error) throw error;
        if (Array.isArray(data)) {
          setClinics(
            data.map((c: Record<string, unknown>) => ({
              clinic_id: String(c.clinic_id),
              clinic_name: String(c.clinic_name ?? "Clínica"),
              clinic_cnpj: String(c.clinic_cnpj ?? ""),
            }))
          );
        }
      } catch (err) {
        console.warn("Não foi possível carregar lista de clínicas:", err);
      } finally {
        setLoadingClinics(false);
      }
    };
    void fetchClinics();
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (accountType === "simple_user") {
        await callPlatformAccountAdmin(
          "create_simple_user",
          {
            clinicId: selectedClinicId !== "none" ? selectedClinicId : null,
            cpf: document,
            email,
            fullName,
            password,
            phone,
            role: operationalRole,
            status,
          },
          reason
        );
        toast({
          title: "Login simples criado com sucesso",
          description: selectedClinicId !== "none"
            ? "O usuário foi criado e vinculado à clínica selecionada com o papel configurado."
            : "O usuário foi criado avulso na plataforma e pode ser vinculado a clínicas a qualquer momento.",
        });
      } else {
        await callPlatformAccountAdmin(
          "create_owner_account",
          {
            cnpj: document,
            concurrentAccessLimit: Number(concurrentLimit),
            email,
            fullName,
            password,
            plan: accountType === "clinic_owner" ? "clinic" : "solo",
            status,
          },
          reason
        );
        toast({ title: "Conta criada", description: "O owner foi criado e a ação foi auditada no painel master." });
      }

      setEmail("");
      setPassword("");
      setDocument("");
      setFullName("");
      setPhone("");
      setReason("");
      setSelectedClinicId("none");
      onCreated();
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova conta master-gerenciada</DialogTitle>
            <DialogDescription>
              {accountType === "simple_user"
                ? "Crie um login simples de usuário/profissional sem ser owner e sem criar uma nova clínica."
                : "Crie uma conta owner com senha inicial pelo backend administrativo."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tipo de conta a criar</Label>
              <Select
                value={accountType}
                onValueChange={(val) => setAccountType(val as "clinic_owner" | "solo_owner" | "simple_user")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic_owner">Clínica com equipe (Conta Owner + Nova Clínica)</SelectItem>
                  <SelectItem value="solo_owner">Conta Solo (Owner + Nova Clínica Solo)</SelectItem>
                  <SelectItem value="simple_user">👤 Usuário Simples / Colaborador (Sem clínica própria)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accountType === "simple_user" ? (
              <>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Vincular a uma clínica agora? (Opcional)</Label>
                  <Select
                    value={selectedClinicId}
                    onValueChange={setSelectedClinicId}
                    disabled={loadingClinics}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingClinics ? "Carregando clínicas..." : "Selecione uma clínica"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (criar usuário avulso pronto para associação)</SelectItem>
                      {clinics.map((c) => (
                        <SelectItem key={c.clinic_id} value={c.clinic_id}>
                          {c.clinic_name} {c.clinic_cnpj ? `(${c.clinic_cnpj})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Papel operacional (Hierarquia)</Label>
                  <Select value={operationalRole} onValueChange={setOperationalRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="assistant">Assistente</SelectItem>
                      <SelectItem value="estagiario">Estagiário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label>Acessos simultâneos</Label>
                <Input
                  value={concurrentLimit}
                  onChange={(event) => setConcurrentLimit(event.target.value)}
                  disabled={accountType === "solo_owner"}
                  inputMode="numeric"
                  maxLength={3}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Status administrativo</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
                  <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
                  <SelectItem value="banned">Bloqueada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>E-mail de login</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={160} required />
            </div>

            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} maxLength={128} required />
            </div>

            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} required />
            </div>

            <div className="space-y-1">
              <Label>{accountType === "simple_user" ? "CPF (Opcional)" : "CPF/CNPJ da clínica"}</Label>
              <Input
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                maxLength={18}
                required={accountType !== "simple_user"}
              />
            </div>

            {accountType === "simple_user" && (
              <div className="space-y-1">
                <Label>Telefone (Opcional)</Label>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} />
              </div>
            )}

            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo auditável</Label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                placeholder="Informe o motivo da criação (mínimo 8 caracteres)..."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={saving || reason.trim().length < 8 || !email.trim() || password.length < 6} type="submit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
