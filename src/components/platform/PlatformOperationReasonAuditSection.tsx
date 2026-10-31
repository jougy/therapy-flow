import React from "react";
import { CheckCircle2, Sparkles, Info, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PlatformOperationReasonAuditSectionProps {
  reason: string;
  onReasonChange: (val: string) => void;
  quickReasons: string[];
  isDestructive: boolean;
  confirmation: string;
  onConfirmationChange: (val: string) => void;
  saving: boolean;
  pendingChangesCount: number;
  onOpenReauth: () => void;
}

export function PlatformOperationReasonAuditSection({
  reason,
  onReasonChange,
  quickReasons,
  isDestructive,
  confirmation,
  onConfirmationChange,
  saving,
  pendingChangesCount,
  onOpenReauth,
}: PlatformOperationReasonAuditSectionProps) {
  const isReady = reason.trim().length >= 8;

  return (
    <>
      <div className={`grid gap-3 ${isDestructive ? "lg:grid-cols-[minmax(0,1fr)_200px]" : "lg:grid-cols-1"}`}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              <span>Motivo auditável</span>
              <span className="text-xs text-destructive">*</span>
            </Label>
            <span
              className={`text-xs font-medium ${
                isReady
                  ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isReady ? (
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
                  onClick={() => onReasonChange(qr)}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          <Textarea
            id="platform-audit-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={1000}
            placeholder="Informe a justificativa da ação administrativa (mínimo de 8 caracteres)..."
            className={`min-h-[75px] transition-colors ${
              reason.trim().length > 0 && !isReady
                ? "border-amber-500/80 focus-visible:ring-amber-500"
                : isReady
                ? "border-emerald-500/60 focus-visible:ring-emerald-500"
                : ""
            }`}
            aria-invalid={reason.trim().length > 0 && !isReady}
          />
        </div>
        {isDestructive && (
          <div className="space-y-1">
            <Label>Confirmação</Label>
            <Input
              value={confirmation}
              onChange={(event) => onConfirmationChange(event.target.value)}
              placeholder="Digite EXCLUIR"
            />
            <p className="text-xs text-destructive">Digite EXCLUIR</p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        {!isReady && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Preencha a justificativa com pelo menos 8 caracteres para liberar a execução da ação.</span>
          </p>
        )}

        <Button
          disabled={saving || !isReady || (isDestructive && confirmation !== "EXCLUIR")}
          onClick={onOpenReauth}
          variant={isDestructive ? "destructive" : "default"}
          className={
            !isDestructive && pendingChangesCount > 0 && isReady
              ? "ring-2 ring-primary ring-offset-2 font-semibold shadow-md"
              : ""
          }
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDestructive
            ? "Confirmar e excluir com 2FA"
            : pendingChangesCount > 0
            ? "Salvar e aplicar alterações pendentes"
            : "Executar ação administrativa"}
        </Button>
      </div>
    </>
  );
}
