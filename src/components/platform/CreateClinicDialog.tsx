import React, { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
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

export interface CreateClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (routeKey: string) => void;
}

interface CreateClinicResult {
  clinic_id?: string;
  route_key?: string;
  name?: string;
}

const formatDocumentMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11) {
    // Máscara de CPF: 000.000.000-00
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  // Máscara de CNPJ: 00.000.000/0000-00
  const cnpjDigits = digits.slice(0, 14);
  if (cnpjDigits.length <= 2) return cnpjDigits;
  if (cnpjDigits.length <= 5) return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2)}`;
  if (cnpjDigits.length <= 8) return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5)}`;
  if (cnpjDigits.length <= 12) {
    return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8)}`;
  }
  return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8, 12)}-${cnpjDigits.slice(12)}`;
};

export const CreateClinicDialog: React.FC<CreateClinicDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const cleanDigits = cnpj.replace(/\D/g, "");
  const isDocumentValid = cleanDigits.length === 11 || cleanDigits.length === 14;
  const isNameValid = name.trim().length >= 3 && name.trim().length <= 120;

  const resetForm = () => {
    setName("");
    setCnpj("");
    setReason("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatDocumentMask(event.target.value));
  };

  const handleCreate = async () => {
    if (!isNameValid) {
      toast({
        title: "Nome inválido",
        description: "O nome da clínica deve conter entre 3 e 120 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (!isDocumentValid) {
      toast({
        title: "Documento incompleto",
        description: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) administrativo válido.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await callRpc("platform_create_clinic", {
        _cnpj: cnpj.trim(),
        _name: name.trim(),
        _reason: reason.trim() || null,
        _subaccount_limit: 4,
        _subscription_plan: "clinic",
      });

      if (error) throw error;

      const result = (data ?? {}) as CreateClinicResult;
      if (!result.route_key) {
        throw new Error("A clínica foi criada, mas o retorno do servidor não incluiu a rota mascarada.");
      }

      toast({
        title: "Clínica criada com sucesso",
        description: `A clínica "${name.trim()}" foi registrada na auditoria master.`,
      });

      resetForm();
      onCreated(result.route_key);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Nova clínica</DialogTitle>
              <DialogDescription>
                Crie uma clínica inicial local. O vínculo de owner pode ser feito depois pelo fluxo de contas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-clinic-name">Nome da clínica</Label>
            <Input
              id="new-clinic-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Clínica Bem-Estar"
              maxLength={120}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-clinic-document">CPF ou CNPJ administrativo</Label>
            <Input
              id="new-clinic-document"
              value={cnpj}
              onChange={handleDocumentChange}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              maxLength={18}
              disabled={saving}
            />
            {cnpj.length > 0 && !isDocumentValid && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                O documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-clinic-reason">Motivo da criação (auditoria master)</Label>
            <Textarea
              id="new-clinic-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex: Nova unidade criada a pedido do suporte para onboarding imediato."
              maxLength={500}
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !isNameValid || !isDocumentValid}
            onClick={() => void handleCreate()}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar clínica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
