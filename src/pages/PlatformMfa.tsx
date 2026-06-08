import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string;
};

type TotpEnrollment = {
  id: string;
  totp?: {
    qr_code?: string;
    secret?: string;
    uri?: string;
  };
};

const normalizeCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Não foi possível validar o segundo fator.";
};

const PlatformMfa = () => {
  const navigate = useNavigate();
  const { platformMfaVerified, refreshAuthState, refreshMfaAssurance, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [verifiedFactors, setVerifiedFactors] = useState<TotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);

  const activeFactor = useMemo(() => verifiedFactors[0] ?? null, [verifiedFactors]);
  const isSetupMode = !activeFactor;

  const loadFactors = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) throw error;

      const totpFactors = Array.isArray(data?.totp) ? data.totp : [];
      setVerifiedFactors(
        totpFactors
          .filter((factor) => factor.status === "verified")
          .map((factor) => ({
            id: factor.id,
            friendly_name: factor.friendly_name,
            status: factor.status,
          }))
      );
    } catch (error) {
      toast({
        title: "Segundo fator indisponível",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  useEffect(() => {
    if (platformMfaVerified) {
      navigate("/platform", { replace: true });
    }
  }, [navigate, platformMfaVerified]);

  const handleEnroll = async () => {
    setEnrolling(true);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pluri-Health Master",
      });

      if (error) throw error;

      setEnrollment(data as TotpEnrollment);
      setCode("");
    } catch (error) {
      toast({
        title: "Erro ao configurar 2FA",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollment || code.length !== 6) return;

    setSubmitting(true);

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
      if (challenge.error) throw challenge.error;

      const verification = await supabase.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.data.id,
        code,
      });

      if (verification.error) throw verification.error;

      await refreshAuthState();
      await refreshMfaAssurance();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Código inválido",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyExistingFactor = async () => {
    if (!activeFactor || code.length !== 6) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactor.id,
        code,
      });

      if (error) throw error;

      await refreshAuthState();
      await refreshMfaAssurance();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Código inválido",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSetupMode) {
      await verifyEnrollment();
      return;
    }

    await verifyExistingFactor();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>Verificação master</CardTitle>
          <CardDescription>
            Confirme o código do Ente Auth para acessar o painel administrativo global.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {isSetupMode && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Primeiro acesso master</p>
                      <p className="text-sm text-muted-foreground">
                        Cadastre este login no Ente Auth antes de entrar no painel.
                      </p>
                    </div>
                  </div>

                  {!enrollment ? (
                    <Button type="button" className="w-full" onClick={handleEnroll} disabled={enrolling}>
                      {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar QR Code"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {enrollment.totp?.qr_code && (
                        <div className="flex justify-center rounded-lg bg-white p-4">
                          <img src={enrollment.totp.qr_code} alt="QR Code para Ente Auth" className="h-48 w-48" />
                        </div>
                      )}
                      {enrollment.totp?.secret && (
                        <div className="rounded-md border bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Chave manual</p>
                          <p className="mt-1 break-all font-mono text-sm">{enrollment.totp.secret}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(!isSetupMode || enrollment) && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                    <Input
                      id="mfa-code"
                      value={code}
                      onChange={(event) => setCode(normalizeCode(event.target.value))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      className="text-center font-mono text-lg tracking-[0.35em]"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar no painel master"}
                  </Button>
                </form>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
                  Sair da conta
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformMfa;
