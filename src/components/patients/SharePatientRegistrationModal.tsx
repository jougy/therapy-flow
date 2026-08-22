import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPatientRegistrationUrl,
  buildPatientShareMessages,
  formatPatientPhone,
} from "@/lib/patient-registration";

export interface SharePatientData {
  id: string;
  name: string;
  cpf?: string | null;
  responsible_cpf?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  pronoun?: string | null;
  patient_code?: string | null;
}

interface SharePatientRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: SharePatientData | null;
  clinicName?: string;
  initialToken?: string | null;
  initialPassword?: string | null;
  onContinueToPatient?: () => void;
  continueButtonLabel?: string;
}

export const SharePatientRegistrationModal = ({
  open,
  onOpenChange,
  patient,
  clinicName = "nossa clínica",
  initialToken,
  initialPassword,
  onContinueToPatient,
  continueButtonLabel = "Ir para o Prontuário",
}: SharePatientRegistrationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [passwordPrefix, setPasswordPrefix] = useState<string | null>(initialPassword ?? null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const generateLink = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("create_patient_registration_link", {
        _patient_id: patient.id,
      });

      if (error || !data || typeof data !== "object") {
        throw new Error(error?.message || "Erro ao gerar link de cadastro");
      }

      const response = data as { token: string; password_prefix: string };
      setToken(response.token);
      setPasswordPrefix(response.password_prefix);
      toast({
        title: "Link de cadastro gerado",
        description: "Novo link exclusivo e pronto para compartilhamento.",
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Não foi possível gerar o link agora.";
      toast({
        title: "Erro ao gerar link",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    if (open) {
      if (initialToken && initialPassword) {
        setToken(initialToken);
        setPasswordPrefix(initialPassword);
      } else if (!token && patient?.id) {
        void generateLink();
      }
    } else {
      setCopiedLink(false);
      setCopiedMessage(false);
    }
  }, [open, initialToken, initialPassword, patient?.id, generateLink, token]);

  const shareUrl = useMemo(() => {
    if (!token) return "";
    return buildPatientRegistrationUrl(window.location.origin, token);
  }, [token]);

  const shareMessages = useMemo(() => {
    if (!patient || !shareUrl || !passwordPrefix) return null;

    return buildPatientShareMessages({
      clinicName,
      email: patient.email,
      gender: patient.gender,
      passwordPrefix,
      patientName: patient.name,
      phone: patient.phone,
      pronoun: patient.pronoun,
      shareUrl,
    });
  }, [patient, shareUrl, passwordPrefix, clinicName]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast({ title: "Link copiado para a área de transferência!" });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  const handleCopyMessage = async () => {
    if (!shareMessages?.whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessages.whatsappMessage);
      setCopiedMessage(true);
      toast({ title: "Mensagem completa copiada!" });
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      toast({ title: "Não foi possível copiar a mensagem", variant: "destructive" });
    }
  };

  const handleOpenWhatsApp = () => {
    if (!shareMessages?.whatsappUrl) return;
    window.open(shareMessages.whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenEmail = () => {
    if (!shareMessages?.mailtoUrl) return;
    window.location.href = shareMessages.mailtoUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary font-medium text-xs tracking-wide uppercase">
            <Share2 className="h-4 w-4" />
            <span>Compartilhamento Seguro</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Ficha de Pré-Cadastro: {patient?.name}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Envie o link exclusivo de uso único para o paciente preencher a ficha cadastral antes do atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Gerando link exclusivo de cadastro...</p>
            </div>
          ) : (
            <>
              {/* Link Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="share-link" className="text-xs font-semibold uppercase text-muted-foreground">
                    Link de Acesso Seguro
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => void generateLink()}
                    className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Gerar novo link
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="share-link"
                    value={shareUrl}
                    readOnly
                    className="font-mono text-xs bg-muted/40 selection:bg-primary/20"
                  />
                  <Button
                    type="button"
                    variant={copiedLink ? "default" : "secondary"}
                    onClick={() => void handleCopyLink()}
                    className="shrink-0 gap-1.5 transition-all"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {copiedLink ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>

              {/* Password Box */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Senha de acesso do paciente:</span>
                    <span className="font-mono font-bold text-base px-2 py-0.5 rounded bg-background border border-primary/30 text-primary">
                      {passwordPrefix || "------"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Oriente o paciente a digitar os 6 primeiros dígitos do CPF (ou documento cadastrado) para desbloquear a ficha pelo celular.
                  </p>
                </div>
              </div>

              {/* Quick Actions (WhatsApp & Email) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Canais de Envio Rápido
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenWhatsApp}
                    className="h-auto p-3.5 justify-start text-left border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-950 dark:text-emerald-300 gap-3 group transition-all"
                  >
                    <div className="h-9 w-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-sm flex items-center gap-1">
                        WhatsApp
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient?.phone ? formatPatientPhone(patient.phone) : "Abrir conversa"}
                      </p>
                    </div>
                  </Button>

                  {/* Email Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenEmail}
                    className="h-auto p-3.5 justify-start text-left border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10 text-blue-950 dark:text-blue-300 gap-3 group transition-all"
                  >
                    <div className="h-9 w-9 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-sm flex items-center gap-1">
                        E-mail
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient?.email || "Aplicativo de e-mail"}
                      </p>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Collapsible Message Preview */}
              <div className="rounded-xl border border-border/70 overflow-hidden bg-muted/10">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <span>Pré-visualizar texto da mensagem</span>
                  {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showPreview && (
                  <div className="p-4 pt-1 border-t border-border/40 space-y-3">
                    <pre className="text-xs font-sans text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background p-3 rounded-lg border">
                      {shareMessages?.whatsappMessage}
                    </pre>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleCopyMessage()}
                      className="w-full text-xs gap-1.5"
                    >
                      {copiedMessage ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedMessage ? "Texto copiado!" : "Copiar texto da mensagem"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex sm:flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          {onContinueToPatient && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onContinueToPatient();
              }}
              className="font-semibold shadow-sm"
            >
              {continueButtonLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
