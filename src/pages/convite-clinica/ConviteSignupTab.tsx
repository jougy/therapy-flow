import React from "react";
import {
  Calendar,
  Check,
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
          <div className="flex items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="relative flex-1 min-w-0">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="signup-pass"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
                className="h-11 border-0 bg-transparent pl-9 pr-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <button
              type="button"
              className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
              title={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-pass-confirm">Confirmar senha</Label>
          <div className="flex items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="relative flex-1 min-w-0">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="signup-pass-confirm"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
                minLength={8}
                required
                className="h-11 border-0 bg-transparent pl-9 pr-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <button
              type="button"
              className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Ver confirmação de senha"}
              title={showConfirmPassword ? "Ocultar confirmação de senha" : "Ver confirmação de senha"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Termo de Consentimento LGPD */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
        <div className="flex items-start gap-2">
          <button
            id="invite-terms-consent"
            type="button"
            role="checkbox"
            aria-checked={termsAccepted}
            aria-label="Li, compreendi e concordo integralmente com os Termos de Uso e a Política de Privacidade e Proteção de Dados (LGPD)"
            onClick={() => setTermsAccepted(!termsAccepted)}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-colors ${
                termsAccepted ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              {termsAccepted && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>
          </button>
          <div className="flex-1 min-w-0 space-y-1.5 pt-2.5">
            <label
              htmlFor="invite-terms-consent"
              className="block text-xs leading-relaxed text-muted-foreground cursor-pointer select-none"
            >
              Li, compreendi e concordo integralmente com os Termos de Uso e a Política de Privacidade e Proteção de Dados (LGPD).
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenTermsModal}
                className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-md px-2 text-xs font-semibold text-primary underline underline-offset-2 hover:bg-primary/5 hover:text-primary/80"
              >
                Termos de Uso
              </button>
              <button
                type="button"
                onClick={onOpenTermsModal}
                className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-md px-2 text-xs font-semibold text-primary underline underline-offset-2 hover:bg-primary/5 hover:text-primary/80"
              >
                Política de Privacidade e Proteção de Dados (LGPD)
              </button>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
        disabled={submitting || !termsAccepted}
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
        Concluir cadastro e entrar na clínica
      </Button>

      <div className="pt-1 text-center">
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center px-2 text-xs text-primary hover:underline font-medium"
          onClick={onSwitchToLogin}
        >
          Já tem uma conta cadastrada? Entrar com minha senha
        </button>
      </div>
    </form>
  );
};
