import { type FormEvent, useState } from "react";
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
import { callPlatformAccountAdmin, getErrorMessage } from "./platform-api";

export const CreateAccountDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [plan, setPlan] = useState("clinic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState("active");
  const [concurrentLimit, setConcurrentLimit] = useState("4");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await callPlatformAccountAdmin(
        "create_owner_account",
        {
          cnpj: document,
          concurrentAccessLimit: Number(concurrentLimit),
          email,
          fullName,
          password,
          plan,
          status,
        },
        reason
      );
      toast({ title: "Conta criada", description: "O owner foi criado e a ação foi auditada no painel master." });
      setEmail("");
      setPassword("");
      setDocument("");
      setFullName("");
      setReason("");
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
              Crie uma conta owner com senha inicial pelo backend administrativo. A service role fica apenas na função segura do Supabase.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo de conta</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic">Clínica com equipe</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <Label>E-mail</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={160} required />
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} maxLength={128} required />
            </div>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>CPF/CNPJ</Label>
              <Input value={document} onChange={(event) => setDocument(event.target.value)} maxLength={18} required />
            </div>
            <div className="space-y-1">
              <Label>Acessos simultâneos</Label>
              <Input
                value={concurrentLimit}
                onChange={(event) => setConcurrentLimit(event.target.value)}
                disabled={plan === "solo"}
                inputMode="numeric"
                maxLength={3}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo auditável</Label>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={saving || reason.trim().length < 8} type="submit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
