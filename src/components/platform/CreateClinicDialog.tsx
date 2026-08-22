import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { callRpc, getErrorMessage } from "./platform-api";

export const CreateClinicDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: (routeKey: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { data, error } = await callRpc("platform_create_clinic", {
        _cnpj: cnpj,
        _name: name,
        _reason: reason,
        _subaccount_limit: 4,
        _subscription_plan: "clinic",
      });
      if (error) throw error;
      const result = (data ?? {}) as { clinic_id?: string; route_key?: string };
      if (!result.route_key) throw new Error("A clínica foi criada, mas o retorno não trouxe rota mascarada.");
      toast({ title: "Clínica criada", description: "A criação foi registrada na auditoria master." });
      onCreated(result.route_key);
      setName("");
      setCnpj("");
      setReason("");
    } catch (error) {
      toast({
        title: "Erro ao criar clínica",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova clínica</DialogTitle>
          <DialogDescription>Crie uma clínica inicial local. O vínculo de owner pode ser feito depois pelo fluxo de contas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da clínica</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label>CPF/CNPJ administrativo</Label>
            <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} maxLength={18} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || name.trim().length < 3 || cnpj.trim().length < 11} onClick={() => void handleCreate()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar clínica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
