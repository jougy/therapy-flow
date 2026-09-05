import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, RotateCcw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { callPlatformAccountAdmin, getErrorMessage } from "@/components/platform/platform-api";
import { toast } from "@/hooks/use-toast";

interface ResetRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ResetRegistrationDialog: React.FC<ResetRegistrationDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [searchMode, setSearchMode] = useState<"email" | "cpf">("email");
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("Reset de cadastro solicitado pelo suporte/administração");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "confirm">("input");

  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (searchMode === "cpf") {
      setIdentifier(formatCpf(val));
    } else {
      setIdentifier(val.trim());
    }
  };

  const handleClose = () => {
    setIdentifier("");
    setStep("input");
    setReason("Reset de cadastro solicitado pelo suporte/administração");
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast({
        title: "Campo obrigatório",
        description: `Informe o ${searchMode === "cpf" ? "CPF" : "E-mail"} a ser resetado.`,
        variant: "destructive",
      });
      return;
    }

    if (searchMode === "cpf" && identifier.replace(/\D/g, "").length !== 11) {
      toast({
        title: "CPF incompleto",
        description: "O CPF deve conter exatamente 11 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (step === "input") {
      setStep("confirm");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        identifier: searchMode === "cpf" ? identifier.replace(/\D/g, "") : identifier.toLowerCase(),
      };

      await callPlatformAccountAdmin(
        "delete_user_attempt",
        payload,
        reason || "Reset administrativo de cadastro autorizado pelo platform_owner"
      );

      toast({
        title: "Cadastro resetado com sucesso!",
        description: `Os dados associados a ${identifier} foram limpos. A pessoa pode se registrar novamente do zero.`,
      });

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast({
        title: "Erro ao resetar cadastro",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Resetar Cadastro de Usuário</DialogTitle>
              <DialogDescription>
                Limpe tentativas de cadastro presas ou dados com conflito para permitir novo registro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {step === "input" ? (
            <>
              <div className="flex rounded-lg border bg-muted/30 p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    searchMode === "email" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setSearchMode("email");
                    setIdentifier("");
                  }}
                >
                  Por E-mail
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    searchMode === "cpf" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setSearchMode("cpf");
                    setIdentifier("");
                  }}
                >
                  Por CPF
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-identifier">
                  {searchMode === "email" ? "E-mail cadastrado" : "CPF do titular"}
                </Label>
                <Input
                  id="reset-identifier"
                  value={identifier}
                  onChange={handleInputChange}
                  placeholder={searchMode === "email" ? "usuario@exemplo.com" : "000.000.000-00"}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-reason">Motivo do reset (auditoria master)</Label>
                <Textarea
                  id="reset-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Usuário relatou erro de e-mail já existente sem ter conta completa."
                  rows={2}
                  required
                />
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
                <p className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>
                    Isso cancelará convites pendentes e removerá o perfil e credenciais do Auth associados a este identificador.
                  </span>
                </p>
              </div>

              <DialogFooter className="gap-2 pt-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Continuar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <ShieldAlert className="h-5 w-5" />
                  <span>Confirmar exclusão definitiva do cadastro?</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Você está prestes a limpar o registro de: <strong className="text-foreground">{identifier}</strong>.
                </p>
                <div className="rounded border bg-background p-2.5 text-xs space-y-1">
                  <p className="font-medium text-foreground">Ações executadas:</p>
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    <li>Exclusão do usuário no serviço de autenticação (`auth.users`)</li>
                    <li>Remoção do perfil (`profiles`) e permissões</li>
                    <li>Cancelamento de convites pendentes de clínicas</li>
                    <li>Liberação imediata para o titular se cadastrar do zero</li>
                  </ul>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setStep("input")} disabled={loading}>
                  Voltar
                </Button>
                <Button type="submit" variant="destructive" disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Confirmar e resetar
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
