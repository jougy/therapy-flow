import { useState, useCallback } from "react";

import {
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserPlus,
  CreditCard,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Send,
  CalendarCheck,
  Compass,
  Building2,
  ShieldCheck,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhone } from "@/lib/profile-settings";

export interface WhatsAppTestResult {
  timestamp: string;
  status: "success" | "error";
  message?: string;
  messageId?: string;
  data?: unknown;
}

export function PlatformWhatsAppAlerts() {
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<WhatsAppTestResult | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Form State
  const [recipientPhone, setRecipientPhone] = useState("(11) 96047-4566");
  const [templateType, setTemplateType] = useState<"welcome" | "plan_thank_you">("welcome");
  const [recipientName, setRecipientName] = useState("Dra. Patrícia Lima");
  const [clinicName, setClinicName] = useState("Consultório Fisio Saúde");
  const [planName, setPlanName] = useState("Degustação Gratuita (7 dias)");

  // Preview tab state
  const [previewTemplate, setPreviewTemplate] = useState<"welcome" | "plan_thank_you">("welcome");

  const businessPhoneFormatted = "+55 (11) 96047-4566";
  const businessPhoneDigits = "5511960474566";

  const handleCopyBusinessPhone = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(businessPhoneFormatted);
      setCopiedPhone(true);
      toast.success("Número comercial copiado com sucesso!");
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      toast.error("Falha ao copiar número.");
    }
  }, [businessPhoneFormatted]);

  const handleSendWhatsAppTest = useCallback(async () => {
    const rawDigits = recipientPhone.replace(/\D/g, "");
    if (rawDigits.length < 10) {
      toast.error("Informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).");
      return;
    }

    setTestingWhatsApp(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-admin-telegram", {
        body: {
          action: "SEND_TEST_WHATSAPP",
          templateType,
          phone: recipientPhone,
          name: recipientName.trim() || "Dra. Patrícia Lima",
          clinicName: clinicName.trim() || "Consultório Fisio Saúde",
          plan: planName.trim() || "Pluri Fisio Pro",
        },
      });

      if (error) {
        throw error;
      }

      if (data && data.success === false) {
        throw new Error(data.error || "Falha ao disparar teste no WhatsApp");
      }

      const messageId = data?.messageId || data?.whatsapp?.messageId;
      const successMsg = data?.message || (messageId ? `Mensagem disparada com sucesso! ID: ${messageId}` : "Mensagem de teste enviada com sucesso para o WhatsApp.");

      setLastTestResult({
        timestamp: new Date().toISOString(),
        status: "success",
        message: successMsg,
        messageId,
        data,
      });

      toast.success("Mensagem de teste disparada com sucesso no WhatsApp!");
    } catch (err: unknown) {
      console.error("Erro ao testar envio de WhatsApp:", err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "error" in err
          ? String((err as { error: unknown }).error)
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Falha ao disparar teste no WhatsApp. Verifique as credenciais da Meta Cloud API.";

      setLastTestResult({
        timestamp: new Date().toISOString(),
        status: "error",
        message: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setTestingWhatsApp(false);
    }
  }, [recipientPhone, templateType, recipientName, clinicName, planName]);

  return (
    <Card className="border bg-card shadow-lg rounded-2xl overflow-hidden">
      {/* Header com identidade WhatsApp Oficial */}
      <CardHeader className="p-4 sm:p-6 pb-4 border-b bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Mensageria WhatsApp (Pluri Fisio)
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Meta Cloud API Oficial (Graph API)
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              Automação & Notificações via WhatsApp
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
              Acolhimento automatizado de onboarding para novos cadastros e confirmação instantânea de ativação de planos.
            </CardDescription>
          </div>

          {/* Destaque do Número Comercial Ativo */}
          <div className="flex flex-col sm:items-end gap-1.5 p-3 rounded-xl bg-background/80 border border-emerald-500/20 shadow-sm shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Número Comercial Oficial
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                {businessPhoneFormatted}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyBusinessPhone}
                className="h-7 w-7 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"
                title="Copiar número"
                aria-label="Copiar número comercial"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
              <a
                href={`https://wa.me/${businessPhoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir Chat
              </a>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Callout Informativo da Conexão Oficial Meta Cloud API */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/5 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                  Conexão Meta WhatsApp Business Cloud API Ativa
                </h4>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] h-4 px-1.5 border-0">
                  Infraestrutura Oficial Meta
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Sem dependência de servidores locais ou VPS • Infraestrutura direta da Meta (Graph API) • Alta disponibilidade e entrega instantânea com SLA corporativo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <div className="text-right hidden md:block">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">SLA & Entregabilidade</span>
              <span className="text-xs font-semibold text-foreground">99.9% Uptime</span>
            </div>
          </div>
        </div>
        {/* Regras Automatizadas de Disparo */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Regra 1: Onboarding Imediato */}
          <div className="p-4 rounded-xl border bg-muted/30 dark:bg-muted/10 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">1. Onboarding de Novos Cadastros</h4>
                  <p className="text-xs text-muted-foreground">Disparo no cadastro de fisioterapeutas e clínicas</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                Ativo
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Apresentação personalizada com nome do profissional</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Botões interativos para agendar tour ou explorar sozinho</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Fallback inteligente caso o WhatsApp do cliente não suporte botões</span>
              </div>
            </div>
          </div>

          {/* Regra 2: Agradecimento de Plano */}
          <div className="p-4 rounded-xl border bg-muted/30 dark:bg-muted/10 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">2. Agradecimento e Ativação de Plano</h4>
                  <p className="text-xs text-muted-foreground">Disparo na confirmação de faturas via Webhook Asaas</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]">
                Ativo
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Confirmação da liberação dos recursos da clínica</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Link direto para acesso ao sistema</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Canal direto para suporte prioritário</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Pré-visualização Interativa dos Templates (Mockup WhatsApp) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Pré-visualização Interativa dos Templates</h3>
            </div>
            <Tabs
              value={previewTemplate}
              onValueChange={(val) => setPreviewTemplate(val as "welcome" | "plan_thank_you")}
              className="w-auto"
            >
              <TabsList className="bg-muted h-8 p-0.5 rounded-lg">
                <TabsTrigger value="welcome" className="text-xs h-7 px-2.5 rounded-md">
                  1. Boas-Vindas (Onboarding)
                </TabsTrigger>
                <TabsTrigger value="plan_thank_you" className="text-xs h-7 px-2.5 rounded-md">
                  2. Ativação de Plano
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Container do Mockup Celular / WhatsApp */}
          <div className="max-w-2xl mx-auto rounded-2xl border border-emerald-500/20 bg-slate-900 text-slate-100 shadow-xl overflow-hidden font-sans">
            {/* Barra Superior do Chat WhatsApp */}
            <div className="bg-emerald-800 dark:bg-emerald-950 px-4 py-3 flex items-center justify-between border-b border-emerald-700/40">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-800" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white">Pluri Fisio</span>
                    <Badge className="bg-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-[10px] h-4 px-1 border-0">
                      Oficial
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-200/80">Conta comercial oficial • Online</p>
                </div>
              </div>
              <div className="text-[11px] text-emerald-200/70 font-mono hidden sm:block">
                {businessPhoneFormatted}
              </div>
            </div>

            {/* Corpo do Chat com Papel de Parede Estilo WhatsApp */}
            <div className="p-4 sm:p-6 bg-[#0b141a] space-y-4 min-h-[260px] flex flex-col justify-end">
              {/* Badge de Criptografia */}
              <div className="text-center">
                <span className="inline-block px-3 py-1 rounded-lg bg-[#182229] text-[#ffd279] text-[10px] shadow-sm">
                  🔒 As mensagens são protegidas com a criptografia de ponta a ponta do WhatsApp.
                </span>
              </div>

              {/* Balão de Mensagem de Boas-Vindas */}
              {previewTemplate === "welcome" && (
                <div className="max-w-md space-y-2">
                  <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm leading-relaxed shadow space-y-2 border border-slate-700/40">
                    <p>
                      Olá <strong className="text-emerald-300">Dra. Patrícia</strong>, tudo bem? Sou seu assistente da <strong className="text-emerald-300">PluriFisio</strong>! 👋
                    </p>
                    <p>
                      Vimos que você criou sua conta no plano <strong className="text-emerald-300">Degustação Gratuita (7 dias)</strong>. Seja muito bem-vinda!
                    </p>
                    <p className="text-slate-300 text-xs">
                      Sei que o dia a dia na clínica é corrido, então passei para me colocar 100% à sua disposição.
                    </p>
                    <p className="text-slate-300 text-xs">
                      Se você quiser, posso fazer uma chamada rápida de 15 minutinhos com você para te mostrar os primeiros passos. Ou, se preferir explorar por conta própria e surgir qualquer pergunta, é só me mandar uma mensagem por aqui.
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                      <span>14:32</span>
                      <span className="text-sky-400 font-bold">✓✓</span>
                    </div>
                  </div>

                  {/* Botões Interativos Simulados do WhatsApp */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full py-2 px-3 bg-[#202c33] hover:bg-[#2a3942] border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow">
                      <CalendarCheck className="w-4 h-4 text-emerald-400" />
                      📞 Agendar Introdução
                    </div>
                    <div className="w-full py-2 px-3 bg-[#202c33] hover:bg-[#2a3942] border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow">
                      <Compass className="w-4 h-4 text-sky-400" />
                      🚀 Seguir por conta própria
                    </div>
                  </div>
                </div>
              )}

              {/* Balão de Mensagem de Agradecimento de Plano */}
              {previewTemplate === "plan_thank_you" && (
                <div className="max-w-md space-y-2">
                  <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm leading-relaxed shadow space-y-2 border border-slate-700/40">
                    <p>
                      Parabéns, <strong className="text-emerald-300">Dra. Patrícia</strong>! 🎉
                    </p>
                    <p>
                      Confirmamos com sucesso a ativação do seu plano <strong className="text-emerald-300">Pluri Fisio Pro</strong> no <strong className="text-emerald-300">Pluri Fisio</strong>.
                    </p>
                    <p className="text-slate-300 text-xs">
                      Seus novos recursos e capacidade já foram liberados instantaneamente na sua clínica (<em className="text-emerald-200">Consultório Fisio Saúde</em>).
                    </p>
                    <p className="text-slate-300 text-xs">
                      Muito obrigado pela confiança em nossa plataforma! Se precisar de suporte prioritário, conte conosco por este canal.
                    </p>
                    <div className="p-2.5 rounded-lg bg-[#111b21] border border-slate-700/60 flex items-center gap-2.5 mt-2">
                      <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] truncate">
                        <div className="font-semibold text-emerald-300">Pluri Fisio App</div>
                        <div className="text-slate-400 truncate">https://app.plurifisio.com.br</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                      <span>14:35</span>
                      <span className="text-sky-400 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Informativo */}
            <div className="bg-[#111b21] px-4 py-2 text-[11px] text-slate-400 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span>Variáveis suportadas: <code className="text-emerald-400">{"{{nome}}"}</code>, <code className="text-emerald-400">{"{{plano}}"}</code>, <code className="text-emerald-400">{"{{clinica}}"}</code></span>
              <span className="text-emerald-400/80 font-medium">Meta Cloud API (Graph v21.0)</span>
            </div>
          </div>
        </div>

        {/* Seção de Disparo de Teste em Tempo Real */}
        <div className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Disparo de Teste em Tempo Real no WhatsApp
            </h3>
            <p className="text-xs text-muted-foreground">
              Envie uma mensagem real pelo WhatsApp comercial para testar templates, botões e respostas da Meta Cloud API Oficial.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Input de Telefone com Máscara */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-test-phone" className="text-xs font-semibold">
                Telefone de Destino <span className="text-emerald-600">*</span>
              </Label>
              <Input
                id="whatsapp-test-phone"
                placeholder="(11) 98765-4321"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                maxLength={15}
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>

            {/* Seleção do Tipo de Teste */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Mensagem</Label>
              <Select
                value={templateType}
                onValueChange={(val) => {
                  const t = val as "welcome" | "plan_thank_you";
                  setTemplateType(t);
                  setPreviewTemplate(t);
                }}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">Boas-Vindas (Onboarding com Botões)</SelectItem>
                  <SelectItem value="plan_thank_you">Agradecimento de Plano (Ativação)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome do Profissional */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-test-name" className="text-xs font-semibold">
                Nome do Profissional
              </Label>
              <Input
                id="whatsapp-test-name"
                placeholder="Dra. Patrícia Lima"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={80}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            {/* Nome da Clínica */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp-test-clinic" className="text-xs font-semibold">
                Nome da Clínica
              </Label>
              <Input
                id="whatsapp-test-clinic"
                placeholder="Consultório Fisio Saúde"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                maxLength={80}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            {/* Nome do Plano */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="whatsapp-test-plan" className="text-xs font-semibold">
                Plano Simulado
              </Label>
              <Input
                id="whatsapp-test-plan"
                placeholder="Pluri Fisio Pro ou Degustação Gratuita (7 dias)"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                maxLength={80}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              Disparo realizado a partir da Meta Cloud API Oficial ({businessPhoneFormatted})
            </span>

            <Button
              onClick={handleSendWhatsAppTest}
              disabled={testingWhatsApp || recipientPhone.replace(/\D/g, "").length < 10}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-11 px-5 text-xs shadow-sm transition-all hover:shadow shrink-0"
            >
              {testingWhatsApp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disparando Mensagem...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Disparar Mensagem de Teste no WhatsApp
                </>
              )}
            </Button>
          </div>

          {/* Resultado do Teste */}
          {lastTestResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                lastTestResult.status === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                  : "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  {lastTestResult.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span>
                    <strong>Status:</strong> {lastTestResult.status === "success" ? "Sucesso no disparo" : "Falha no disparo"} &mdash;{" "}
                    {lastTestResult.message}
                  </span>
                </div>
                <span className="text-[11px] opacity-80 shrink-0 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(lastTestResult.timestamp).toLocaleString("pt-BR")}
                </span>
              </div>

              {lastTestResult.messageId && (
                <div className="text-[11px] font-mono text-muted-foreground pt-1 border-t border-emerald-500/20 flex items-center gap-2">
                  <span>ID da Mensagem: <code>{lastTestResult.messageId}</code></span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
