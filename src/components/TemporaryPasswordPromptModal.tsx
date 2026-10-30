import React, { useState } from "react";
import { AlertCircle, KeyRound, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function TemporaryPasswordPromptModal() {
  const { profile, refreshAuthState, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTemporary = Boolean(profile?.password_temporary);
  const isOpen = isTemporary && !dismissed;

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleOpenChangePassword = () => {
    setIsChangingPassword(true);
  };

  const handleSaveNewPassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação da nova senha deve ser idêntica.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Senha muito curta",
        description: "Sua nova senha deve ter no mínimo 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      if (user?.id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            password_temporary: false,
            last_password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (profileError) {
          console.warn("[TemporaryPasswordPromptModal] Erro ao desmarcar senha temporária no perfil:", profileError.message);
        }

        // Registra evento de auditoria
        try {
          await supabase.from("security_events").insert({
            actor_user_id: user.id,
            target_user_id: user.id,
            event_type: "password_changed",
            visibility_scope: "personal",
            payload: {
              method: "temporary_password_prompt_update",
              timestamp: new Date().toISOString(),
            },
          });
        } catch {
          // ignora falha secundária de auditoria
        }
      }

      toast({
        title: "Senha atualizada com sucesso!",
        description: "Sua senha pessoal definitiva foi cadastrada e sua conta está protegida.",
      });

      setIsChangingPassword(false);
      setDismissed(true);
      await refreshAuthState?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível atualizar a senha.";
      toast({
        title: "Erro ao trocar senha",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <KeyRound className="h-5 w-5" />
            <DialogTitle className="text-foreground">
              {isChangingPassword ? "Definir Nova Senha" : "Senha Provisória Identificada"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {isChangingPassword
              ? "Crie uma senha forte e de uso exclusivo para acessar a plataforma."
              : "Sua senha foi redefinida recentemente pela administração da plataforma. Por segurança, recomendamos que você defina uma nova senha de sua preferência agora."}
          </DialogDescription>
        </DialogHeader>

        {isChangingPassword ? (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo de 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Visualizar senha</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveNewPassword();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">Visualizar senha</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 my-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              Você pode continuar utilizando a plataforma normalmente com a senha atual ou trocá-la agora mesmo para uma senha definitiva.
            </span>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          {isChangingPassword ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsChangingPassword(false)}
                disabled={saving}
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={handleSaveNewPassword}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Salvar nova senha
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDismiss}
              >
                Farei isso mais tarde
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground"
                onClick={handleOpenChangePassword}
              >
                <Lock className="h-3.5 w-3.5" />
                Trocar senha agora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
