import React, { useState } from "react";
import { CheckCircle2, Loader2, Phone, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCpf, formatPhone } from "@/lib/profile-settings";
import { validateCPF } from "@/lib/owner-document";

interface CompleteProfileModalProps {
  isOpen: boolean;
  userId: string;
  userEmail: string;
  currentName?: string | null;
  onCompleted: () => Promise<void>;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  isOpen,
  userId,
  userEmail,
  currentName = "",
  onCompleted,
}) => {
  const [fullName, setFullName] = useState(currentName || "");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [profession, setProfession] = useState<string>("fisioterapeuta");
  const [councilNumber, setCouncilNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const cleanPhone = phone.replace(/\D/g, "");
  const cleanCpf = cpf.replace(/\D/g, "");

  const isPhoneValid = cleanPhone.length === 10 || cleanPhone.length === 11;
  const isCpfValid = validateCPF(cleanCpf);
  const canSubmit = isPhoneValid && isCpfValid && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ phone: true, cpf: true });

    if (!isPhoneValid) {
      toast({
        title: "Celular inválido",
        description: "Informe seu número de WhatsApp com DDD (10 ou 11 dígitos).",
        variant: "destructive",
      });
      return;
    }

    if (!isCpfValid) {
      toast({
        title: "CPF inválido",
        description: "Informe um CPF válido com 11 dígitos para a titularidade da sua conta.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const finalName = fullName.trim() || currentName || "Profissional";

      // 1. Invocar a RPC canônica handle_personal_signup
      const { error: rpcError } = await supabase.rpc("handle_personal_signup", {
        _user_id: userId,
        _email: userEmail,
        _full_name: finalName,
        _cpf: cleanCpf,
        _phone: cleanPhone,
        _profession: profession || null,
        _council_number: councilNumber.trim() || null,
      } as any);

      if (rpcError) {
        if (rpcError.message?.includes("23505") || rpcError.message?.includes("já está cadastrado")) {
          toast({
            title: "CPF já cadastrado",
            description: "Este CPF já está associado a outra conta na plataforma.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Fallback direto via UPDATE na tabela profiles
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: finalName,
            phone: cleanPhone,
            cpf: cleanCpf,
            profession: profession || null,
            professional_license: councilNumber.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          throw updateError;
        }
      }

      toast({
        title: "Cadastro concluído com sucesso!",
        description: "Seu consultório gratuito de 7 dias foi configurado.",
      });

      await onCompleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar cadastro.";
      toast({
        title: "Erro ao salvar dados",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md max-h-[95dvh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Quase lá! Complete seu cadastro
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Conta Google conectada com sucesso. Preencha seus dados de contato para liberar seu acesso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificação vinculada ao Google (Leitura) */}
          <div className="rounded-xl border border-muted/80 bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                Conta Google identificada
              </span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="h-3 w-3" /> Verificado
              </span>
            </div>
            <p className="font-medium text-foreground truncate">{userEmail}</p>
          </div>

          {/* Nome Completo */}
          <div className="space-y-1.5">
            <Label htmlFor="complete-name" className="text-xs font-semibold">
              Nome Completo
            </Label>
            <Input
              id="complete-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome e sobrenome"
              className="h-10 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Celular / WhatsApp (Obrigatório) */}
            <div className="space-y-1.5">
              <Label htmlFor="complete-phone" className="text-xs font-semibold flex items-center justify-between">
                <span>Celular (WhatsApp) <span className="text-destructive">*</span></span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="complete-phone"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  placeholder="(00) 00000-0000"
                  className={`pl-9 h-10 text-sm ${touched.phone && !isPhoneValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  required
                />
              </div>
              {touched.phone && !isPhoneValid && (
                <p className="text-[11px] text-destructive">DDD + 8 ou 9 dígitos</p>
              )}
            </div>

            {/* CPF (Obrigatório) */}
            <div className="space-y-1.5">
              <Label htmlFor="complete-cpf" className="text-xs font-semibold flex items-center justify-between">
                <span>CPF <span className="text-destructive">*</span></span>
              </Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="complete-cpf"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  onBlur={() => setTouched((prev) => ({ ...prev, cpf: true }))}
                  placeholder="000.000.000-00"
                  className={`pl-9 h-10 text-sm ${touched.cpf && !isCpfValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  required
                />
              </div>
              {touched.cpf && !isCpfValid && (
                <p className="text-[11px] text-destructive">CPF inválido</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Profissão (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="complete-profession" className="text-xs font-medium text-muted-foreground">
                Profissão
              </Label>
              <Select value={profession} onValueChange={setProfession}>
                <SelectTrigger id="complete-profession" className="h-10 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisioterapeuta">Fisioterapeuta</SelectItem>
                  <SelectItem value="terapeuta_ocupacional">Terapeuta Ocupacional</SelectItem>
                  <SelectItem value="medico">Médico(a)</SelectItem>
                  <SelectItem value="psicologo">Psicólogo(a)</SelectItem>
                  <SelectItem value="fonoaudiologo">Fonoaudiólogo(a)</SelectItem>
                  <SelectItem value="nutricionista">Nutricionista</SelectItem>
                  <SelectItem value="outro">Outro Profissional de Saúde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Registro de Classe (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="complete-council" className="text-xs font-medium text-muted-foreground">
                CREFITO / Registro (Opcional)
              </Label>
              <Input
                id="complete-council"
                value={councilNumber}
                onChange={(e) => setCouncilNumber(e.target.value)}
                placeholder="Ex: 123456-F"
                className="h-10 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold text-sm mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configurando sua conta...
              </>
            ) : (
              "Concluir cadastro e acessar espaço"
            )}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground leading-tight pt-1">
            Seus dados são protegidos por criptografia de ponta a ponta e em conformidade rigorosa com a LGPD.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
