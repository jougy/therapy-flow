import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { getErrorMessage } from "./platform-api";

export interface PlatformReauthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingChanges?: string[];
  reason: string;
  actionLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export const PlatformReauthModal = memo(({
  open,
  onOpenChange,
  pendingChanges = [],
  reason,
  actionLabel,
  isDestructive = false,
  onConfirm,
}: PlatformReauthModalProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "verifying" | "executing">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setCode("");
        setError(null);
        setStep("idle");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setLoading(false);
      setStep("idle");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(timer);
        setCode("");
      };
    } else {
      setCode("");
      setError(null);
      setStep("idle");
    }
  }, [open]);

  const handleVerifyAndConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      const invalidMsg = "Informe o código 2FA de 6 dígitos gerado pelo seu app autenticador (Ente Auth).";
      setError(invalidMsg);
      toast({
        title: "Código incompleto",
        description: invalidMsg,
        variant: "destructive",
      });
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setStep("verifying");
    setError(null);

    try {
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;

      const totpFactors = Array.isArray(factorData?.totp) ? factorData.totp : [];
      const verifiedOnly = totpFactors.filter((factor) => factor.status === "verified");
      const candidateFactors = verifiedOnly.length > 0 ? verifiedOnly : totpFactors;

      if (candidateFactors.length === 0) {
        throw new Error("Nenhum segundo fator (2FA/MFA) verificado encontrado na sua conta master.");
      }

      // Ordenar os fatores de forma decrescente por data (created_at / updated_at), colocando o mais recente primeiro
      const sortedFactors = [...candidateFactors].sort((a, b) => {
        const timeA = new Date((a as { updated_at?: string; created_at?: string }).updated_at || (a as { created_at?: string }).created_at || 0).getTime();
        const timeB = new Date((b as { updated_at?: string; created_at?: string }).updated_at || (b as { created_at?: string }).created_at || 0).getTime();
        return timeB - timeA;
      });

      let verifySuccess = false;
      let lastVerifyError: Error | null = null;

      for (let i = 0; i < sortedFactors.length; i++) {
        const factor = sortedFactors[i];
        const { data: verifyData, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: cleanCode,
        });

        if (!verifyError) {
          const mfaSession = (verifyData as { session?: Session | null })?.session;
          if (mfaSession) {
            await supabase.auth.setSession(mfaSession);
          }
          verifySuccess = true;
          break;
        }

        lastVerifyError = new Error(`Código MFA inválido ou expirado: ${verifyError.message}`);

        // Se o erro indicar TOTP inválido e houver outros fatores, tentar o próximo candidato
        const isInvalidTotp = /invalid.*totp|invalid.*code|código.*inválido/i.test(verifyError.message || "");
        if (!isInvalidTotp && i < sortedFactors.length - 1) {
          // Se for outro tipo de erro que não seja de TOTP, interrompe ou prossegue se houver outros
        }
      }

      if (!verifySuccess) {
        throw lastVerifyError || new Error("Código MFA inválido ou expirado.");
      }

      setStep("executing");
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      const errMsg = getErrorMessage(err);
      setError(errMsg);
      toast({
        title: step === "executing" ? "Erro ao aplicar alterações" : "Código 2FA inválido ou expirado",
        description: errMsg,
        variant: "destructive",
      });
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } finally {
      setLoading(false);
      setStep("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="platform-reauth-modal"
        className="w-[calc(100vw-2rem)] sm:w-full max-w-lg sm:max-w-md max-h-[90vh] overflow-y-auto overscroll-contain p-4 sm:p-6"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Reautenticação 2FA Requerida
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Confirme com seu código do Ente Auth para autorizar a operação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerifyAndConfirm} className="space-y-4 pt-1">
          {pendingChanges.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Alterações que serão aplicadas:</span>
              </div>
              <ul className="mt-1.5 max-h-36 overflow-y-auto list-disc list-inside space-y-1 font-medium pl-1">
                {pendingChanges.map((change, idx) => (
                  <li key={idx} className="break-words">{change}</li>
                ))}
              </ul>
            </div>
          ) : actionLabel ? (
            <div className="rounded-md border border-muted bg-muted/40 p-2.5 text-xs text-foreground flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Ação a executar:</span>
              <span className="font-semibold">{actionLabel}</span>
            </div>
          ) : null}

          {reason && (
            <div className="rounded-md border border-muted bg-muted/20 p-2.5 text-xs">
              <span className="font-semibold text-muted-foreground block mb-1">Motivo auditável informado:</span>
              <p className="text-foreground italic font-medium break-words bg-background/80 p-2 rounded border border-border/50 max-h-24 overflow-y-auto">
                &ldquo;{reason}&rdquo;
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium break-words">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform-reauth-code" className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              Código de 6 dígitos (Ente Auth)
            </Label>
            <Input
              ref={inputRef}
              id="platform-reauth-code"
              data-testid="platform-reauth-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="000000"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError(null);
              }}
              className="h-11 text-center font-mono text-xl tracking-[0.35em]"
              disabled={loading}
            />
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {step === "verifying"
                    ? "Validando código no Ente Auth..."
                    : "Aplicando alterações administrativas com segurança..."}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Abra o app Ente Auth no seu dispositivo e digite o código atual.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              variant={isDestructive ? "destructive" : "default"}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === "verifying"
                ? "Validando 2FA..."
                : step === "executing"
                ? "Aplicando alterações..."
                : isDestructive
                ? "Confirmar e excluir com 2FA"
                : "Confirmar e aplicar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

PlatformReauthModal.displayName = "PlatformReauthModal";
