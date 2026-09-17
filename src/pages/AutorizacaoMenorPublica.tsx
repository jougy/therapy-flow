import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Baby,
  CheckCircle2,
  FileDown,
  FileText,
  LockKeyhole,
  Printer,
  ShieldCheck,
  Smartphone,
  Loader2,
  AlertCircle,
  Mail,
  ArrowRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import {
  formatPatientCpf,
  formatPatientPhone,
  isValidPatientEmail,
  type GuardianConsentData,
} from "@/lib/patient-registration";

interface PatientMinorData {
  id: string;
  name: string;
  date_of_birth: string | null;
  age: number | null;
  responsible_name: string | null;
  responsible_relationship: string | null;
  responsible_cpf: string | null;
  phone: string | null;
  email: string | null;
  guardian_consent: GuardianConsentData | null;
}

export const AutorizacaoMenorPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [patient, setPatient] = useState<PatientMinorData | null>(null);

  // Form states
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianCpf, setGuardianCpf] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [declaredLegalPower, setDeclaredLegalPower] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [signedAtDate, setSignedAtDate] = useState<string>("");

  const canUnlock = password.replace(/\D/g, "").length >= 6;

  const handleUnlock = async () => {
    if (!token || !canUnlock) return;
    setUnlocking(true);

    try {
      const { data, error } = await supabase.rpc("get_patient_registration_form", {
        _token: token,
        _password: password,
      });

      if (error || !data) {
        throw new Error(error?.message || "Link inválido ou senha incorreta.");
      }

      const response = data as {
        completed: boolean;
        patient: PatientMinorData;
      };

      if (!response.patient) {
        throw new Error("Dados não encontrados.");
      }

      const p = response.patient;
      setPatient(p);
      setGuardianName(p.responsible_name || "");
      setGuardianRelationship(p.responsible_relationship || "Mãe");
      setGuardianCpf(p.responsible_cpf || "");
      setGuardianEmail(p.email || "");

      // Se já estava assinado
      if (p.guardian_consent && p.guardian_consent.status === "signed") {
        setSignedSuccess(true);
        setSignedAtDate(p.guardian_consent.signed_at || new Date().toISOString());
      }

      setUnlocked(true);
    } catch (err) {
      toast({
        title: "Não foi possível acessar o termo",
        description: err instanceof Error ? err.message : "Confira a senha e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const handleSignConsent = async () => {
    if (!token || !patient || !declaredLegalPower) return;

    if (guardianName.trim().length < 3) {
      toast({
        title: "Nome incompleto",
        description: "Informe o seu nome completo como responsável legal.",
        variant: "destructive",
      });
      return;
    }

    if (guardianEmail && !isValidPatientEmail(guardianEmail)) {
      toast({
        title: "E-mail inválido",
        description: "Informe um e-mail válido para envio do comprovante.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase.rpc("authorize_minor_guardian_consent", {
        _token: token,
        _password: password,
        _consent_data: {
          method: "whatsapp",
          responsible_name: guardianName.trim(),
          responsible_relationship: guardianRelationship.trim(),
          responsible_cpf: guardianCpf ? guardianCpf.replace(/\D/g, "") : null,
          responsible_email: guardianEmail ? guardianEmail.trim().toLowerCase() : null,
          signed_at: nowIso,
          user_agent: navigator.userAgent,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSignedAtDate(nowIso);
      setSignedSuccess(true);

      toast({
        title: "Autorização Concluída!",
        description: "Seu consentimento foi registrado e vinculado ao prontuário com segurança.",
      });

      // Tenta disparar e-mail de comprovação via edge function se e-mail fornecido
      if (guardianEmail) {
        try {
          await supabase.functions.invoke("send-guardian-consent-proof", {
            body: {
              to: guardianEmail.trim().toLowerCase(),
              patientName: patient.name,
              guardianName: guardianName.trim(),
              signedAt: nowIso,
            },
          });
        } catch {
          // Falha silenciosa do e-mail de comprovante não bloqueia a conclusão
        }
      }
    } catch (err) {
      toast({
        title: "Erro na autorização",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDob = patient?.date_of_birth
    ? new Date(`${patient.date_of_birth}T12:00:00`).toLocaleDateString("pt-BR")
    : "Não informada";

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Cabeçalho da Página */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Ambiente Seguro • LGPD Art. 14
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Consentimento do Responsável Legal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Autorização expressa para tratamento de dados e atendimento clínico de menor de idade.
          </p>
        </div>

        {/* 1. Tela de Desbloqueio */}
        {!unlocked && (
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Digite a Senha de Acesso</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Para sua privacidade, digite os <strong>6 primeiros dígitos do CPF</strong> (ou documento cadastrado) do responsável ou paciente.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-xs mx-auto">
                <Label htmlFor="password-input" className="text-xs font-medium text-center block">
                  6 Primeiros Dígitos do Documento
                </Label>
                <Input
                  id="password-input"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg font-mono tracking-widest h-12"
                  autoFocus
                />
              </div>

              <Button
                type="button"
                onClick={handleUnlock}
                disabled={!canUnlock || unlocking}
                className="w-full font-semibold shadow-sm gap-2"
              >
                {unlocking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Acessar Termo de Consentimento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 2. Tela de Confirmação Concluída */}
        {unlocked && signedSuccess && (
          <Card className="rounded-2xl border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm animate-in fade-in">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-bold text-emerald-950 dark:text-emerald-100">
                Autorização Registrada com Sucesso!
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                O consentimento formal para o atendimento de <strong>{patient?.name}</strong> foi validado e arquivado no prontuário eletrônico.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Box de Auditoria */}
              <div className="p-4 rounded-xl border bg-background/80 text-xs space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Paciente:</span>
                  <span className="font-semibold text-foreground">{patient?.name}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Responsável Legitimado(a):</span>
                  <span className="font-semibold text-foreground">{guardianName || patient?.responsible_name} ({guardianRelationship})</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Data e Hora do Registro:</span>
                  <span className="font-mono text-foreground">
                    {new Date(signedAtDate).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fundamentação Legal:</span>
                  <span className="text-foreground">Art. 14 da Lei 13.709/2018 (LGPD)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full sm:w-1/2 gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Salvar PDF
                </Button>

                {token && (
                  <Button
                    type="button"
                    onClick={() => navigate(`/cadastro/paciente/${token}`)}
                    className="w-full sm:w-1/2 gap-2 font-semibold"
                  >
                    <span>Completar Ficha Cadastral</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Formulário de Assinatura Pública */}
        {unlocked && !signedSuccess && (
          <div className="space-y-6">
            {/* Cartão com dados do Menor */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Baby className="w-4 h-4 text-primary" />
                  Dados do Paciente (Menor)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Nome do Paciente:</span>
                  <span className="font-semibold text-sm">{patient?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Data de Nascimento:</span>
                  <span className="font-medium">{formattedDob}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Identificação do Responsável */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Qualificação do Responsável Legal
                </CardTitle>
                <CardDescription className="text-xs">
                  Confirme seus dados para constar formalmente no termo de consentimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="resp-name" className="text-xs font-medium">
                      Seu Nome Completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="resp-name"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Ex: Maria da Silva"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="resp-rel" className="text-xs font-medium">
                      Grau de Parentesco / Vínculo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="resp-rel"
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      placeholder="Ex: Mãe, Pai, Tutor(a) Legal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="resp-cpf" className="text-xs font-medium">
                      Seu CPF (opcional)
                    </Label>
                    <Input
                      id="resp-cpf"
                      value={guardianCpf ? formatPatientCpf(guardianCpf) : ""}
                      onChange={(e) => setGuardianCpf(formatPatientCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="resp-email" className="text-xs font-medium">
                      E-mail para receber cópia assinada (opcional)
                    </Label>
                    <Input
                      id="resp-email"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Termo Completo */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Cláusulas do Termo de Consentimento (LGPD)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-64 overflow-y-auto p-3.5 rounded-xl border bg-muted/20 text-xs leading-relaxed prose prose-xs dark:prose-invert max-w-none">
                  <ReactMarkdown>{defaultMinorTermsMarkdown}</ReactMarkdown>
                </div>

                {/* Declaração de Poder Familiar */}
                <div className="flex items-start space-x-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5">
                  <Checkbox
                    id="legal-power-decl"
                    checked={declaredLegalPower}
                    onCheckedChange={(c) => setDeclaredLegalPower(Boolean(c))}
                    className="mt-0.5"
                  />
                  <Label htmlFor="legal-power-decl" className="text-xs font-normal leading-relaxed cursor-pointer text-foreground">
                    <strong>Declaro, sob as penas da lei</strong>, que sou detentor(a) do poder familiar ou tutela/guarda legal do(a) menor <strong>{patient?.name}</strong> e possuo plena legitimidade jurídica para autorizar os atendimentos clínicos e o respectivo tratamento de dados sensíveis de saúde conforme a LGPD.
                  </Label>
                </div>

                <Button
                  type="button"
                  disabled={!declaredLegalPower || submitting || guardianName.trim().length < 3}
                  onClick={handleSignConsent}
                  className="w-full h-12 font-bold shadow-md gap-2 text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  Autorizar e Assinar Digitalmente
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <footer className="text-center text-[11px] text-muted-foreground py-4 border-t mt-8">
        Pluri-Health • Plataforma de Gestão Clínica Segura em conformidade com a LGPD e Conselhos de Classe.
      </footer>
    </div>
  );
};

export default AutorizacaoMenorPublica;
