import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import defaultTermsMarkdown from "@/assets/terms-of-service.md?raw";
import { FileText, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { TermsConfigPayload, TermsDocItem } from "@/components/TermsConfigModal";

export function TermsUpdatePromptModal() {
  const { user, profile, operationalRole, isSuperAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [termsPayload, setTermsPayload] = useState<TermsConfigPayload | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);

  const checkTermsVersion = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("value")
        .eq("key", "terms_of_service_management")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao buscar termos:", error);
      }

      const val = (data?.value || {}) as TermsConfigPayload;
      const latestVersion = val.publishedVersion || null;
      setTermsPayload(val);
      setPublishedVersion(latestVersion);

      if (!latestVersion) return;

      const userAcceptedVersion =
        (profile as Record<string, unknown> | null)?.terms_accepted_version ||
        localStorage.getItem(`terms_accepted_version_${user.id}`);

      if (userAcceptedVersion !== latestVersion) {
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Erro na verificação dos termos:", err);
    }
  }, [user, profile]);

  useEffect(() => {
    void checkTermsVersion();

    const handleOpenEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener("open-terms-update-modal", handleOpenEvent);
    return () => {
      window.removeEventListener("open-terms-update-modal", handleOpenEvent);
    };
  }, [checkTermsVersion]);

  if (!user || !publishedVersion || !isOpen) {
    return null;
  }

  const isOwner = operationalRole === "owner" || isSuperAdmin;
  const isIntl =
    user.user_metadata?.language?.toLowerCase().startsWith("en") ||
    navigator.language.toLowerCase().startsWith("en");

  let activeDoc: TermsDocItem | undefined;
  if (isIntl) {
    activeDoc = isOwner
      ? termsPayload?.owner_intl || termsPayload?.user_intl
      : termsPayload?.user_intl;
  } else {
    activeDoc = isOwner
      ? termsPayload?.owner_br || termsPayload?.user_br
      : termsPayload?.user_br;
  }

  const activeContent = activeDoc?.content || defaultTermsMarkdown.replace(/^---[\s\S]*?---[\r\n]+/, "");

  const handleAccept = async () => {
    if (!hasChecked) {
      toast({ title: "Confirmação necessária", description: "Marque a caixinha declarando que leu e concorda com os termos.", variant: "destructive" });
      return;
    }

    setIsAccepting(true);
    try {
      const nowIso = new Date().toISOString();
      localStorage.setItem(`terms_accepted_version_${user.id}`, publishedVersion);

      await supabase
        .from("profiles")
        .update({
          owner_terms_accepted_at: nowIso,
          terms_accepted_version: publishedVersion,
        } as Record<string, unknown>)
        .eq("id", user.id);

      // Create notification marking terms accepted
      await supabase.rpc("create_current_user_notification", {
        _title: "Termos de Uso Aceitos",
        _body: `Você aceitou a versão atualizada dos Termos de Uso em ${new Date().toLocaleDateString("pt-BR")}.`,
        _category: "terms_update",
      });

      toast({ title: "Termos Aceitos", description: "Você aceitou a nova versão dos Termos de Uso." });
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar aceite.";
      toast({ title: "Erro ao aceitar", description: msg, variant: "destructive" });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReviewLater = async () => {
    try {
      await supabase.rpc("create_current_user_notification", {
        _title: "Termos de Uso Pendentes de Aceite",
        _body: "Há uma nova versão dos Termos de Uso que precisa ser revisada e aceita.",
        _category: "terms_update",
      });
    } catch {
      // Ignore notification creation error
    }

    toast({
      title: "Lembrete mantido nas notificações",
      description: "O aviso continuará visível no seu painel de notificações e reaparecerá no próximo login até ser aceito.",
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs tracking-wider uppercase">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Atualização Obrigatória de Termos
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Novos Termos de Uso e Consentimento
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Foram publicados novos Termos de Uso. Por favor, leia e confirme seu aceite para continuar utilizando a plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-6 overflow-y-auto max-h-[50vh] space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl border bg-card/60">
            <ReactMarkdown>{activeContent}</ReactMarkdown>
          </div>
        </div>

        <div className="p-6 pt-3 border-t bg-muted/10 space-y-4">
          <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border">
            <Checkbox
              id="terms-check"
              checked={hasChecked}
              onCheckedChange={(checked) => setHasChecked(!!checked)}
            />
            <Label htmlFor="terms-check" className="text-sm font-medium leading-none cursor-pointer">
              Li, compreendo e aceito integralmente os novos Termos de Uso e Consentimento.
            </Label>
          </div>

          <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleReviewLater()}
              disabled={isAccepting}
              className="text-muted-foreground hover:text-foreground"
            >
              <Clock className="w-4 h-4 mr-2" />
              Revisar depois
            </Button>

            <Button
              type="button"
              onClick={() => void handleAccept()}
              disabled={isAccepting || !hasChecked}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isAccepting ? "Registrando..." : "Aceitar e continuar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
