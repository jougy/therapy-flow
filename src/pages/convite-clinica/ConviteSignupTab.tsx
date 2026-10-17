import React from "react";
import {
  Calendar,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  LockKeyhole,
  Phone,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InviteSummary } from "./types";
import { formatCpf, formatPhone } from "./utils";

interface ConviteSignupTabProps {
  invite: InviteSummary;
  fullName: string;
  setFullName: (value: string) => void;
  cpf: string;
  setCpf: (value: string) => void;
  birthDate: string;
  setBirthDate: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  onOpenTermsModal: () => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToLogin: () => void;
}

export const ConviteSignupTab = ({
  invite,
  fullName,
  setFullName,
  cpf,
  setCpf,
  birthDate,
  setBirthDate,
  phone,
  setPhone,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  termsAccepted,
  setTermsAccepted,
  onOpenTermsModal,
  submitting,
  onSubmit,
  onSwitchToLogin,
}: ConviteSignupTabProps) => {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950">
        <p className="font-semibold text-sky-900">Finalização de Cadastro</p>
        <p className="mt-0.5 text-sky-800">
          Seu e-mail <strong>{invite.email}</strong> já está validado. Preencha seus dados para ingressar na equipe de{" "}
          <strong>{invite.clinic_name}</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="signup-name">Nome completo</Label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Dra. Maria Santos"
              required
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-cpf">CPF</Label>
          <div className="relative">
            <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-cpf"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
              className="pl-9 font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-birth">Data de nascimento</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="signup-phone">Telefone / WhatsApp</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              required
              className="pl-9 font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-pass">Criar senha</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-pass"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
              className="pl-9 pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-pass-confirm">Confirmar senha</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-pass-confirm"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita sua senha"
              minLength={8}
              required
              className="pl-9 pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Termo de Consentimento LGPD */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="invite-terms-consent"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
            className="mt-0.5"
          />
          <label
            htmlFor="invite-terms-consent"
            className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none"
          >
            Li, compreendi e concordo integralmente com os{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onOpenTermsModal();
              }}
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Termos de Uso
            </button>{" "}
            e a{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onOpenTermsModal();
              }}
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Política de Privacidade e Proteção de Dados (LGPD)
            </button>
            .
          </label>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
        disabled={submitting || !termsAccepted}
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
        Concluir cadastro e entrar na clínica
      </Button>

      <div className="pt-1 text-center">
        <button
          type="button"
          className="text-xs text-primary hover:underline font-medium"
          onClick={onSwitchToLogin}
        >
          Já tem uma conta cadastrada? Entrar com minha senha
        </button>
      </div>
    </form>
  );
};
