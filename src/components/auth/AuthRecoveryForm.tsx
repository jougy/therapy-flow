import { useState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCpf } from "@/lib/profile-settings";
import { buildPublicAppUrl } from "@/lib/public-app-url";

const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

interface AuthRecoveryFormProps {
  initialEmail: string;
  onSuccess: () => void;
}

export const AuthRecoveryForm = ({ initialEmail, onSuccess }: AuthRecoveryFormProps) => {
  const [recoveryEmail, setRecoveryEmail] = useState(initialEmail);
  const [recoveryCpf, setRecoveryCpf] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<"email" | "cpf">("email");

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (recoveryTab === "cpf") {
      const normalizedCpf = normalizeCpf(recoveryCpf);
      if (normalizedCpf.length !== 11) {
        toast({
          title: "CPF inválido",
          description: "Informe os 11 dígitos do CPF cadastrado.",
          variant: "destructive",
        });
        return;
      }

      setRecovering(true);
      try {
        const { data: statusRes, error: rpcError } = await supabase.rpc("request_account_recovery_status", {
          _identifier: normalizedCpf,
        });

        if (rpcError) {
          toast({
            title: "Erro na verificação",
            description: rpcError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const res = statusRes as Record<string, unknown> | null;
        const status = String(res?.status ?? "");

        if (status === "cpf_not_found" || status === "invalid_cpf" || !res?.email) {
          toast({
            title: "CPF não registrado",
            description: "Não encontramos nenhuma conta com o CPF informado. Verifique os dados ou crie uma conta.",
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const targetEmail = String(res.email);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: buildPublicAppUrl("/auth/redefinir-senha"),
        });

        if (resetError) {
          const isSmtpLimit = /Error sending recovery email|rate limit|email rate limit/i.test(resetError.message);
          toast({
            title: "Erro ao enviar e-mail",
            description: isSmtpLimit
              ? "Serviço de envio de e-mails momentaneamente ocupado. Por favor, aguarde alguns instantes antes de tentar novamente."
              : resetError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        toast({
          title: "Recuperação enviada",
          description: `Um e-mail de recuperação foi enviado para o endereço ${targetEmail}.`,
        });
        setRecovering(false);
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
        toast({
          title: "Erro ao solicitar recuperação",
          description: msg,
          variant: "destructive",
        });
        setRecovering(false);
      }
    } else {
      const targetEmail = recoveryEmail.trim().toLowerCase();
      if (!targetEmail) {
        toast({
          title: "E-mail obrigatório",
          description: "Informe seu e-mail cadastrado.",
          variant: "destructive",
        });
        return;
      }

      setRecovering(true);
      try {
        const { data: statusRes, error: rpcError } = await supabase.rpc("request_account_recovery_status", {
          _identifier: targetEmail,
        });

        if (rpcError) {
          toast({
            title: "Erro na verificação",
            description: rpcError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const res = statusRes as Record<string, unknown> | null;
        const status = String(res?.status ?? "");

        if (status === "email_not_found") {
          toast({
            title: "E-mail não registrado",
            description: "Não encontramos nenhuma conta com o e-mail informado. Verifique a digitação ou crie uma conta.",
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        if (status === "email_found_without_cpf") {
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: buildPublicAppUrl("/auth/redefinir-senha?regularizar=true"),
          });

          if (resetError) {
            const isSmtpLimit = /Error sending recovery email|rate limit|email rate limit/i.test(resetError.message);
            toast({
              title: "Erro ao enviar e-mail",
              description: isSmtpLimit
                ? "Serviço de envio de e-mails momentaneamente ocupado. Por favor, aguarde alguns instantes antes de tentar novamente."
                : resetError.message,
              variant: "destructive",
            });
            setRecovering(false);
            return;
          }

          toast({
            title: "Instruções enviadas",
            description: "Identificamos que seu cadastro precisa ser completado. Enviamos um link para você definir sua senha e registrar seus dados com segurança.",
          });
          setRecovering(false);
          onSuccess();
          return;
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: buildPublicAppUrl("/auth/redefinir-senha"),
        });

        if (resetError) {
          const isSmtpLimit = /Error sending recovery email|rate limit|email rate limit/i.test(resetError.message);
          toast({
            title: "Erro ao enviar recuperação",
            description: isSmtpLimit
              ? "Serviço de envio de e-mails momentaneamente ocupado. Por favor, aguarde alguns instantes antes de tentar novamente."
              : resetError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        toast({
          title: "E-mail enviado",
          description: "Abra o e-mail de recuperação e siga o botão para criar uma nova senha.",
        });
        setRecovering(false);
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
        toast({
          title: "Erro ao solicitar recuperação",
          description: msg,
          variant: "destructive",
        });
        setRecovering(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleRecoverySubmit} className="space-y-4">
        <Tabs
          value={recoveryTab}
          onValueChange={(val) => setRecoveryTab(val as "email" | "cpf")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Por E-mail
            </TabsTrigger>
            <TabsTrigger value="cpf" className="text-xs">
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              Por CPF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-3 mt-0">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">E-mail cadastrado</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required={recoveryTab === "email"}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enviaremos um link de redefinição ou instruções caso seu cadastro precise de regularização.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cpf" className="space-y-3 mt-0">
            <div className="space-y-2">
              <Label htmlFor="recovery-cpf">CPF cadastrado</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recovery-cpf"
                  inputMode="numeric"
                  value={recoveryCpf}
                  onChange={(e) => setRecoveryCpf(formatCpf(normalizeCpf(e.target.value)))}
                  placeholder="000.000.000-00"
                  required={recoveryTab === "cpf"}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Localizaremos sua conta e enviaremos o link de recuperação para o e-mail associado.
              </p>
            </div>
          </TabsContent>

          <Button type="submit" className="w-full mt-4" disabled={recovering}>
            {recovering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {recoveryTab === "email" ? "Enviar e-mail de recuperação" : "Localizar conta e enviar link"}
              </>
            )}
          </Button>
        </Tabs>
      </form>
    </div>
  );
};
