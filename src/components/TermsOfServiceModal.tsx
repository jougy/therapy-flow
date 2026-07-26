import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import termsMarkdown from "../../core/Pluri-Health/60 - Juridico e Compliance/Termos de Uso e Consentimento - Owner (PT-BR).md?raw";
import { useAuth } from "@/hooks/useAuth";

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
}

export function TermsOfServiceModal({ isOpen, onClose, planId }: TermsOfServiceModalProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);

  const handleDecline = () => {
    toast.error("Você precisa aceitar os Termos de Uso para prosseguir com a contratação do plano.");
    onClose();
  };

  const handleAccept = async () => {
    if (!session?.user?.id || !planId) return;

    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ owner_terms_accepted_at: new Date().toISOString() })
        .eq("id", session.user.id);

      if (error) {
        throw error;
      }

      toast.success("Termos aceitos com sucesso!");
      onClose();
      navigate(`/onboarding-clinica?plan=${planId}`);
    } catch (error) {
      console.error("Error accepting terms:", error);
      toast.error("Ocorreu um erro ao aceitar os termos. Tente novamente.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-neutral-900/90 border-neutral-800 backdrop-blur-xl text-neutral-100 p-0 overflow-hidden flex flex-col rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-neutral-800/50">
          <DialogTitle className="text-2xl font-bold tracking-tight">Termos de Uso e Consentimento</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Leia atentamente os termos antes de prosseguir com a contratação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="prose prose-invert prose-neutral max-w-none">
            <ReactMarkdown>{termsMarkdown.replace(/^---[\s\S]*?---[\r\n]+/, '')}</ReactMarkdown>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-neutral-800/50 flex items-center justify-between gap-4 sm:justify-end">
          <Button variant="ghost" onClick={handleDecline} disabled={isAccepting} className="text-neutral-400 hover:text-white hover:bg-neutral-800">
            Recusar
          </Button>
          <Button onClick={handleAccept} disabled={isAccepting} className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium">
            {isAccepting ? "Processando..." : "Li e Aceito os Termos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
