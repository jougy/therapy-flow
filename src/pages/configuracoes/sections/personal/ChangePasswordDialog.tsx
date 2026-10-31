import React from "react";
import { Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
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
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: "verify_current" | "set_new";
  currentPassword: string;
  onCurrentPasswordChange: (val: string) => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (val: string) => void;
  showCurrentPassword: boolean;
  onToggleShowCurrentPassword: () => void;
  showNewPassword: boolean;
  onToggleShowNewPassword: () => void;
  verifyingCurrent: boolean;
  updatingPassword: boolean;
  sendingResetEmail: boolean;
  onVerifyCurrentPassword: () => void;
  onUpdatePassword: () => void;
  onSendResetEmail: () => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  step,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  showCurrentPassword,
  onToggleShowCurrentPassword,
  showNewPassword,
  onToggleShowNewPassword,
  verifyingCurrent,
  updatingPassword,
  sendingResetEmail,
  onVerifyCurrentPassword,
  onUpdatePassword,
  onSendResetEmail,
}: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Trocar Senha de Acesso
          </DialogTitle>
          <DialogDescription>
            {step === "verify_current"
              ? "Por segurança, confirme sua senha atual antes de prosseguir com a alteração."
              : "Defina sua nova senha forte para proteger seu login em todas as clínicas."}
          </DialogDescription>
        </DialogHeader>

        {step === "verify_current" ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha atual</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => onCurrentPasswordChange(e.target.value)}
                  autoFocus
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onVerifyCurrentPassword();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleShowCurrentPassword}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                  title={showCurrentPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Visualizar senha</span>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Esqueceu sua senha atual? Você pode receber um link de redefinição seguro por e-mail.
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSendResetEmail}
                disabled={sendingResetEmail || verifyingCurrent}
                className="gap-1.5 w-full sm:w-auto text-xs"
              >
                {sendingResetEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Enviar link por e-mail
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onVerifyCurrentPassword}
                disabled={verifyingCurrent || !currentPassword}
                className="gap-1.5 w-full sm:w-auto text-xs bg-primary text-primary-foreground"
              >
                {verifyingCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Verificar e prosseguir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  autoFocus
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleShowNewPassword}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                  title={showNewPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Visualizar senha</span>
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onUpdatePassword();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleShowNewPassword}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                  title={showNewPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Visualizar senha</span>
                </Button>
              </div>
            </div>

            <DismissibleInfoTip
              id="personal-security-password-rule-tip"
              variant="muted"
            >
              Sua nova senha deve ter no mínimo 8 caracteres. Ao salvar, se você estiver usando senha provisória, ela será marcada como definitiva.
            </DismissibleInfoTip>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={updatingPassword}
                className="w-full sm:w-auto text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onUpdatePassword}
                disabled={updatingPassword || !newPassword || !confirmPassword}
                className="gap-1.5 w-full sm:w-auto text-xs bg-primary text-primary-foreground"
              >
                {updatingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Salvar nova senha
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
