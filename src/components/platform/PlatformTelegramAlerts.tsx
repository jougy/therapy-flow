import { useState } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserPlus,
  CreditCard,
  MessageSquare,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TelegramTestResult {
  timestamp: string;
  status: "success" | "error";
  message?: string;
}

export function PlatformTelegramAlerts() {
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TelegramTestResult | null>(null);

  const handleSendTelegramTest = async () => {
    setTestingTelegram(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-admin-telegram", {
        body: {
          action: "SEND_TEST_NOTIFICATION",
          profession: "fisioterapeuta",
          councilNumber: "123456-F",
          councilName: "CREFITO-3",
          gender: "Feminino",
          preferredPronoun: "Ela/Dela",
          origin: "Instagram (Bio/Campanha)",
        },
      });

      if (error) {
        throw error;
      }

      if (data && data.success === false) {
        throw new Error(data.error || "Falha ao disparar teste no Telegram");
      }

      setLastTestResult({
        timestamp: new Date().toISOString(),
        status: "success",
        message: data?.message || "Mensagem de teste enviada com sucesso.",
      });
      toast.success("Mensagem de teste enviada com sucesso para o Telegram!");
    } catch (err: unknown) {
      console.error("Erro ao testar notificação Telegram:", err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "error" in err
          ? String((err as { error: unknown }).error)
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Falha ao disparar teste no Telegram. Verifique os secrets.";

      setLastTestResult({
        timestamp: new Date().toISOString(),
        status: "error",
        message: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setTestingTelegram(false);
    }
  };

  return (
    <Card className="border bg-card shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="p-4 sm:p-6 pb-4 border-b bg-gradient-to-r from-blue-500/5 via-sky-500/5 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-semibold mb-2">
              <Send className="w-3.5 h-3.5" /> Bot de Mensageria em Tempo Real
            </div>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              Central de Alertas & Notificações Telegram
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Monitoramento instantâneo de novos cadastros orgânicos e vendas de planos Asaas com link de WhatsApp para contato e conversão imediata.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Informative Status Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Rule 1: Novo Cadastro Orgânico */}
          <div className="p-4 rounded-xl border bg-muted/30 dark:bg-muted/10 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Novo Cadastro Orgânico</h4>
                  <p className="text-xs text-muted-foreground">Disparado no signup de novos profissionais/clínicas</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                Ativo
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Notificação no Telegram</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Sino do Backoffice</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Link WhatsApp para contato direto</span>
              </div>
            </div>
          </div>

          {/* Rule 2: Pagamento de Plano Asaas */}
          <div className="p-4 rounded-xl border bg-muted/30 dark:bg-muted/10 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Pagamento de Plano Asaas</h4>
                  <p className="text-xs text-muted-foreground">Disparado na confirmação de faturas via Webhook</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]">
                Ativo
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Notificação no Telegram</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Sino do Backoffice</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Link WhatsApp para boas-vindas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Seção Interativa de Disparo de Teste */}
        <div className="p-5 rounded-2xl border bg-gradient-to-br from-blue-500/5 via-background to-sky-500/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Ambiente de Testes e Diagnóstico
              </h3>
              <p className="text-xs text-muted-foreground">
                Envie um alerta simulado para o canal configurado no Telegram para testar a integração da Edge Function.
              </p>
            </div>

            <Button
              onClick={handleSendTelegramTest}
              disabled={testingTelegram}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-11 px-5 text-xs shadow-sm transition-all hover:shadow shrink-0"
            >
              {testingTelegram ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando Teste...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Disparar Mensagem de Teste no Telegram
                </>
              )}
            </Button>
          </div>

          {/* Exibição do Último Resultado do Teste */}
          {lastTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                lastTestResult.status === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {lastTestResult.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>
                  <strong>Status:</strong> {lastTestResult.status === "success" ? "Sucesso no envio" : "Falha no envio"} &mdash;{" "}
                  {lastTestResult.message}
                </span>
              </div>
              <span className="text-[11px] opacity-80 shrink-0 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {new Date(lastTestResult.timestamp).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
        </div>

        {/* Card de Pré-visualização com Layout Exato das Mensagens */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-foreground">Pré-visualização do Layout no Telegram</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Card Mockup Telegram 1: Novo Cadastro */}
            <div className="rounded-2xl border bg-slate-900 text-slate-100 p-4 font-sans space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs text-slate-400">
                <span className="font-semibold text-sky-400">🤖 Pluri-Health Bot</span>
                <span>agora</span>
              </div>
              <div className="text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-emerald-400 text-sm">🌱 NOVO CADASTRO NA PLATAFORMA</p>
                <p>Um novo profissional ou clínica acabou de criar uma conta!</p>
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 space-y-1 font-mono text-[11px] text-slate-300">
                  <div>
                    <strong>👤 Nome:</strong> Dra. Ana Fisioterapeuta
                  </div>
                  <div>
                    <strong>📧 Email:</strong> ana.fisio@exemplo.com
                  </div>
                  <div>
                    <strong>📱 WhatsApp:</strong> +55 11 98765-4321
                  </div>
                  <div>
                    <strong>🩺 Profissão:</strong> Fisioterapeuta (CREFITO-3: 123456-F)
                  </div>
                  <div>
                    <strong>⚧️ Identidade:</strong> Feminino (Ela/Dela)
                  </div>
                  <div>
                    <strong>🏢 Clínica:</strong> Consultório Dra. Ana
                  </div>
                  <div>
                    <strong>🌐 Origem:</strong> Instagram (Bio/Campanha)
                  </div>
                  <div>
                    <strong>📅 Horário:</strong> 02/10/2026 21:22
                  </div>
                </div>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <div className="w-full py-2 px-3 bg-emerald-600 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default">
                  <Smartphone className="w-3.5 h-3.5" />
                  Conversar no WhatsApp 💬
                </div>
                <div className="w-full py-2 px-3 bg-slate-800 rounded-lg text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default border border-slate-700">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no Backoffice 🌐
                </div>
              </div>
            </div>

            {/* Card Mockup Telegram 2: Nova Venda */}
            <div className="rounded-2xl border bg-slate-900 text-slate-100 p-4 font-sans space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs text-slate-400">
                <span className="font-semibold text-sky-400">🤖 Pluri-Health Bot</span>
                <span>agora</span>
              </div>
              <div className="text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-blue-400 text-sm">💰 NOVA VENDA / PAGAMENTO CONFIRMADO</p>
                <p>Uma fatura de assinatura foi paga e confirmada via Asaas!</p>
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 space-y-1 font-mono text-[11px] text-slate-300">
                  <div>
                    <strong>🏢 Clínica:</strong> Clínica Fisioterapia Viva
                  </div>
                  <div>
                    <strong>💎 Plano:</strong> Médio Porte (30 vagas)
                  </div>
                  <div>
                    <strong>💵 Valor:</strong> R$ 139,00 (PIX)
                  </div>
                  <div>
                    <strong>💳 ID Asaas:</strong> pay_pix_real_888
                  </div>
                  <div>
                    <strong>📱 Contato:</strong> +55 11 99999-8888
                  </div>
                </div>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <div className="w-full py-2 px-3 bg-emerald-600 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default">
                  <Smartphone className="w-3.5 h-3.5" />
                  Falar com Cliente no WhatsApp 💬
                </div>
                <div className="w-full py-2 px-3 bg-slate-800 rounded-lg text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default border border-slate-700">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver Fatura no Backoffice 🌐
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
