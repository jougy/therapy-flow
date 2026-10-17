import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  Layers, 
  MessageSquare, 
  PhoneForwarded, 
  Receipt, 
  Send, 
  BellRing, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Download 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SAMPLE_WHATSAPP_FLOW_JSON } from "./featureConfigConstants";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function WhatsAppNotificationsConfigForm({ formData, setFormData, feature }: FeatureSubFormProps) {
  // WhatsApp Flows
  if (feature?.key === "whatsapp_flows_enabled") {
    const handleCopyFlowJson = () => {
      navigator.clipboard.writeText(SAMPLE_WHATSAPP_FLOW_JSON);
      toast({
        title: "JSON do Flow Copiado!",
        description: "Estrutura do Flow copiada para a área de transferência. Cole no Flow Builder da Meta.",
      });
    };

    const handleDownloadFlowJson = () => {
      const blob = new Blob([SAMPLE_WHATSAPP_FLOW_JSON], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp-flow-${(formData.flow_id as string) || "pluri-triage"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download Concluído",
        description: "Arquivo JSON gerado e pronto para upload no Gerenciador do WhatsApp.",
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            WhatsApp Flows (Formulários Nativos Deslizantes)
          </div>
          <p>
            Permite que os pacientes preencham triagens, dados cadastrais e preferências de consulta diretamente em formulários nativos com gavetas deslizantes dentro do WhatsApp, sem precisar sair do app ou abrir navegadores externos.
          </p>
        </div>

        {/* Ativação Geral */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="wa-flows-enabled" className="font-semibold text-sm cursor-pointer">
              Ativação Geral do WhatsApp Flows
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando habilitado, o sistema envia formulários interativos nativos deslizantes em vez de menus de texto fixos.
            </p>
          </div>
          <Switch
            id="wa-flows-enabled"
            checked={Boolean(formData.enabled ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, enabled: val })}
          />
        </div>

        {/* Campo Meta Flow ID */}
        <div className="space-y-2">
          <Label htmlFor="wa-flows-id" className="text-xs font-semibold">
            Meta Flow ID (Gerenciador do WhatsApp)
          </Label>
          <Input
            id="wa-flows-id"
            placeholder="Ex: 1234567890123456"
            value={(formData.flow_id as string) || ""}
            onChange={(e) => setFormData({ ...formData, flow_id: e.target.value })}
            className="font-mono text-xs"
          />
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Onde encontrar:</strong> Acesse o <em>Meta Business Suite</em> &gt; <em>Gerenciador do WhatsApp</em> &gt; <em>Ferramentas de Conta</em> &gt; <strong>Flows</strong>. Copie o ID numérico gerado após criar seu Flow.
              </span>
            </div>
          </div>
        </div>

        {/* Seletor de Modo: Draft vs Published */}
        <div className="space-y-2">
          <Label htmlFor="wa-flows-mode" className="text-xs font-semibold">
            Modo de Operação do Flow
          </Label>
          <Select
            value={(formData.mode as string) || "draft"}
            onValueChange={(val: "draft" | "published") => setFormData({ ...formData, mode: val })}
          >
            <SelectTrigger id="wa-flows-mode">
              <SelectValue placeholder="Selecione o modo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Rascunho / Teste (Draft) - Apenas números de teste e desenvolvedores</span>
                </span>
              </SelectItem>
              <SelectItem value="published">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Publicado / Produção (Published) - Disponível para todos os pacientes</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            No modo Rascunho, a Meta permite testar o Flow sem exigir publicação oficial da conta de WhatsApp Business.
          </span>
        </div>

        {/* Switch de Fallback Automático */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="wa-flows-fallback" className="font-semibold text-xs cursor-pointer">
              Fallback Automático para Chat Conversacional
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Permitir preenchimento conversacional no chat caso o aparelho do paciente não suporte WhatsApp Flows (versões antigas do WhatsApp ou WhatsApp Web/Desktop sem suporte).
            </p>
          </div>
          <Switch
            id="wa-flows-fallback"
            checked={formData.fallback_to_chat !== false}
            onCheckedChange={(val) => setFormData({ ...formData, fallback_to_chat: val })}
          />
        </div>

        {/* Template JSON auxiliar e Botões de Ação */}
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/10 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Especificação JSON do Flow (Meta Flow Builder)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyFlowJson}
                className="h-7 text-xs gap-1"
              >
                <Copy className="w-3 h-3" />
                Copiar JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadFlowJson}
                className="h-7 text-xs gap-1"
              >
                <Download className="w-3 h-3" />
                Baixar .json
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Utilize este esquema JSON pré-formatado de triagem clínica para importar diretamente no editor de Flows da Meta ou testar no Endpoint interativo.
          </p>
        </div>
      </div>
    );
  }

  // Onboarding
  if (feature?.key === "notifications_whatsapp_onboarding") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <MessageSquare className="w-4 h-4" />
            WhatsApp: Boas-Vindas & Onboarding Automático
          </div>
          <p>
            Envia automaticamente mensagem receptiva com instruções e link de primeiro acesso quando um novo usuário ou clínica é cadastrado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wa-onboarding-phone" className="text-xs font-semibold">Número do Bot (Com DDI)</Label>
            <Input
              id="wa-onboarding-phone"
              placeholder="5511980113936"
              value={(formData.botPhoneNumber as string) || "5511980113936"}
              onChange={(e) => setFormData({ ...formData, botPhoneNumber: e.target.value })}
            />
            <span className="text-[11px] text-muted-foreground">Número de WhatsApp oficial que enviará os disparos.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-onboarding-delay" className="text-xs font-semibold">Delay do Disparo (Segundos)</Label>
            <Input
              id="wa-onboarding-delay"
              type="number"
              min={0}
              max={300}
              placeholder="15"
              value={formData.delaySeconds !== undefined ? String(formData.delaySeconds) : "15"}
              onChange={(e) => setFormData({ ...formData, delaySeconds: Number(e.target.value) })}
            />
            <span className="text-[11px] text-muted-foreground">Tempo de espera antes de engatilhar a mensagem.</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-onboarding-template" className="text-xs font-semibold">Texto da Mensagem de Boas-Vindas</Label>
          <Textarea
            id="wa-onboarding-template"
            rows={3}
            placeholder="Olá {{nome}}! Seja muito bem-vindo(a) ao Pluri Health..."
            value={(formData.welcomeMessageTemplate as string) || "Olá {{nome}}! Seja muito bem-vindo(a) ao Pluri Health. Seu espaço clínico seguro já está pronto para uso: {{link_acesso}}"}
            onChange={(e) => setFormData({ ...formData, welcomeMessageTemplate: e.target.value })}
            className="text-xs"
          />
          <span className="text-[11px] text-muted-foreground">Variáveis disponíveis: <code>{"{{nome}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{link_acesso}}"}</code>.</span>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-send-first-link" className="font-semibold text-xs cursor-pointer">
                Incluir Link Seguro de Primeiro Acesso
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Gera token temporário seguro para definição rápida de senha.
              </p>
            </div>
            <Switch
              id="wa-send-first-link"
              checked={formData.sendFirstAccessLink !== false}
              onCheckedChange={(val) => setFormData({ ...formData, sendFirstAccessLink: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-weekend" className="font-semibold text-xs cursor-pointer">
                Disparar nos Finais de Semana
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Se desligado, cadastros feitos no sábado/domingo recebem mensagem na segunda-feira às 08h.
              </p>
            </div>
            <Switch
              id="wa-notify-weekend"
              checked={Boolean(formData.notifyOnWeekend ?? false)}
              onCheckedChange={(val) => setFormData({ ...formData, notifyOnWeekend: val })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Transbordo Comercial
  if (feature?.key === "notifications_whatsapp_transbordo") {
    const alertTypes = (formData.alertTypes as Record<string, boolean>) || {
      suporte: true,
      novos_agendamentos: true,
      duvidas_planos: true,
      reclamacoes: true,
    };

    const toggleAlertType = (type: string, checked: boolean) => {
      setFormData({
        ...formData,
        alertTypes: {
          ...alertTypes,
          [type]: checked,
        },
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-blue-700 dark:text-blue-400 font-semibold text-sm">
            <PhoneForwarded className="w-4 h-4" />
            Transbordo para Atendimento Comercial Humano
          </div>
          <p>
            Redireciona conversas complexas, suporte e dúvidas de contratação do bot direto para o WhatsApp oficial do time comercial.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transbordo-dest-number" className="text-xs font-semibold">Número de Destino do Transbordo Comercial</Label>
          <Input
            id="transbordo-dest-number"
            placeholder="5511980113936"
            value={(formData.destinationPhoneNumber as string) || "5511980113936"}
            onChange={(e) => setFormData({ ...formData, destinationPhoneNumber: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">Número comercial oficial: <strong>5511980113936</strong></span>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Tipos de Alerta & Transbordo</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-suporte"
                checked={alertTypes.suporte !== false}
                onCheckedChange={(v) => toggleAlertType("suporte", !!v)}
              />
              <Label htmlFor="alert-suporte" className="text-xs cursor-pointer">Suporte Técnico</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-agendamentos"
                checked={alertTypes.novos_agendamentos !== false}
                onCheckedChange={(v) => toggleAlertType("novos_agendamentos", !!v)}
              />
              <Label htmlFor="alert-agendamentos" className="text-xs cursor-pointer">Novos Agendamentos</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-planos"
                checked={alertTypes.duvidas_planos !== false}
                onCheckedChange={(v) => toggleAlertType("duvidas_planos", !!v)}
              />
              <Label htmlFor="alert-planos" className="text-xs cursor-pointer">Dúvidas de Planos / Vendas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="alert-reclamacoes"
                checked={alertTypes.reclamacoes !== false}
                onCheckedChange={(v) => toggleAlertType("reclamacoes", !!v)}
              />
              <Label htmlFor="alert-reclamacoes" className="text-xs cursor-pointer">Reclamações & Cancelamento</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transbordo-fallback-msg" className="text-xs font-semibold">Mensagem de Fallback / Transferência</Label>
          <Textarea
            id="transbordo-fallback-msg"
            rows={2}
            placeholder="Entendido! Estou transferindo seu atendimento para o nosso especialista humano..."
            value={(formData.fallbackMessage as string) || "Entendido! Estou transferindo seu atendimento para o nosso especialista humano. Em instantes você será atendido."}
            onChange={(e) => setFormData({ ...formData, fallbackMessage: e.target.value })}
            className="text-xs"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="transbordo-office-hours" className="font-semibold text-xs cursor-pointer">
              Transbordar Apenas no Horário Comercial
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Fora do horário, avisa o lead que a equipe entrará em contato na manhã seguinte.
            </p>
          </div>
          <Switch
            id="transbordo-office-hours"
            checked={Boolean(formData.officeHoursOnly ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, officeHoursOnly: val })}
          />
        </div>
      </div>
    );
  }

  // Billing (Asaas)
  if (feature?.key === "notifications_whatsapp_billing") {
    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
            <Receipt className="w-4 h-4" />
            WhatsApp: Confirmação de Assinaturas & Upgrade (Asaas)
          </div>
          <p>
            Disparos automáticos pós-aprovação de pagamento pelo gateway Asaas (Cartão, PIX ou Boleto) confirmando liberação de planos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-billing-thanks" className="text-xs font-semibold">Texto de Agradecimento e Boas-Vindas ao Plano</Label>
          <Textarea
            id="wa-billing-thanks"
            rows={3}
            placeholder="Olá {{nome}}, confirmamos com sucesso a sua assinatura..."
            value={(formData.thankYouMessageTemplate as string) || "Olá {{nome}}, confirmamos com sucesso a sua assinatura do plano {{plano}} via Asaas! Obrigado por confiar no Pluri Health."}
            onChange={(e) => setFormData({ ...formData, thankYouMessageTemplate: e.target.value })}
            className="text-xs"
          />
          <span className="text-[11px] text-muted-foreground">Variáveis suportadas: <code>{"{{nome}}"}</code>, <code>{"{{plano}}"}</code>, <code>{"{{valor}}"}</code>.</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-billing-link" className="text-xs font-semibold">Link Direto de Login no Sistema</Label>
          <Input
            id="wa-billing-link"
            placeholder="https://plurihealth.com.br/login"
            value={(formData.systemLoginLink as string) || "https://plurihealth.com.br/login"}
            onChange={(e) => setFormData({ ...formData, systemLoginLink: e.target.value })}
          />
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-upgrade" className="font-semibold text-xs cursor-pointer">
                Disparar Alerta em Upgrades de Plano
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Envia parabéns e resumo das novas capacidades liberadas na clínica.
              </p>
            </div>
            <Switch
              id="wa-notify-upgrade"
              checked={formData.notifyUpgrade !== false}
              onCheckedChange={(val) => setFormData({ ...formData, notifyUpgrade: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wa-notify-failed" className="font-semibold text-xs cursor-pointer">
                Aviso de Falha ou Recusa de Cobrança
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Notifica o gestor amigavelmente com link para atualizar a forma de pagamento.
              </p>
            </div>
            <Switch
              id="wa-notify-failed"
              checked={formData.notifyPaymentFailed !== false}
              onCheckedChange={(val) => setFormData({ ...formData, notifyPaymentFailed: val })}
            />
          </div>
        </div>
      </div>
    );
  }

  // Telegram Admin
  if (feature?.key === "notifications_telegram_admin") {
    const events = (formData.events as Record<string, boolean>) || {
      newRegistrations: true,
      newBookings: true,
      asaasPayments: true,
      errorAlerts: true,
    };

    const toggleEvent = (eventKey: string, checked: boolean) => {
      setFormData({
        ...formData,
        events: {
          ...events,
          [eventKey]: checked,
        },
      });
    };

    return (
      <div className="grid gap-6">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1 text-sky-700 dark:text-sky-400 font-semibold text-sm">
            <Send className="w-4 h-4" />
            Telegram: Alertas em Tempo Real do Administrador
          </div>
          <p>
            Transmissão de telemetria e eventos estratégicos diretamente no grupo ou chat dos administradores do sistema.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram-chat-id" className="text-xs font-semibold">Chat ID do Grupo / Administrador</Label>
          <Input
            id="telegram-chat-id"
            placeholder="-100234567890"
            value={(formData.chatId as string) || "-100234567890"}
            onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">ID numérico do chat no Telegram (ex: canal, supergrupo ou ID pessoal).</span>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Eventos Monitorados</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-reg"
                checked={events.newRegistrations !== false}
                onCheckedChange={(v) => toggleEvent("newRegistrations", !!v)}
              />
              <Label htmlFor="event-reg" className="text-xs cursor-pointer">Novos Cadastros de Clínicas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-bookings"
                checked={events.newBookings !== false}
                onCheckedChange={(v) => toggleEvent("newBookings", !!v)}
              />
              <Label htmlFor="event-bookings" className="text-xs cursor-pointer">Novos Agendamentos de Onboarding</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-payments"
                checked={events.asaasPayments !== false}
                onCheckedChange={(v) => toggleEvent("asaasPayments", !!v)}
              />
              <Label htmlFor="event-payments" className="text-xs cursor-pointer">Pagamentos Confirmados Asaas</Label>
            </div>
            <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
              <Checkbox
                id="event-errors"
                checked={events.errorAlerts !== false}
                onCheckedChange={(v) => toggleEvent("errorAlerts", !!v)}
              />
              <Label htmlFor="event-errors" className="text-xs cursor-pointer">Alertas de Erros Críticos (Sentry/Logs)</Label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="tg-silent" className="font-semibold text-xs cursor-pointer">
              Notificações Silenciosas
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Envia as mensagens sem emitir som ou vibração no celular do administrador.
            </p>
          </div>
          <Switch
            id="tg-silent"
            checked={Boolean(formData.silentNotifications ?? false)}
            onCheckedChange={(val) => setFormData({ ...formData, silentNotifications: val })}
          />
        </div>
      </div>
    );
  }

  // Patient Reminders (default for notifications_patient_reminders)
  const channels = (formData.channels as Record<string, boolean>) || {
    whatsapp: true,
    sms: false,
    email: true,
  };

  const toggleChannel = (channelKey: string, checked: boolean) => {
    setFormData({
      ...formData,
      channels: {
        ...channels,
        [channelKey]: checked,
      },
    });
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1 text-violet-700 dark:text-violet-400 font-semibold text-sm">
          <BellRing className="w-4 h-4" />
          Lembretes de Consultas e Atendimentos (WhatsApp/SMS)
        </div>
        <p>
          Redução proativa de faltas com envio automático de confirmação prévia e lembretes multicanal aos pacientes.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold">Canais de Disparo Habilitados</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
            <Checkbox
              id="chan-rem-wa"
              checked={channels.whatsapp !== false}
              onCheckedChange={(v) => toggleChannel("whatsapp", !!v)}
            />
            <Label htmlFor="chan-rem-wa" className="text-xs cursor-pointer">WhatsApp</Label>
          </div>
          <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
            <Checkbox
              id="chan-rem-sms"
              checked={Boolean(channels.sms ?? false)}
              onCheckedChange={(v) => toggleChannel("sms", !!v)}
            />
            <Label htmlFor="chan-rem-sms" className="text-xs cursor-pointer">SMS Direto</Label>
          </div>
          <div className="flex items-center space-x-2 p-2.5 rounded-lg border bg-muted/20">
            <Checkbox
              id="chan-rem-email"
              checked={channels.email !== false}
              onCheckedChange={(v) => toggleChannel("email", !!v)}
            />
            <Label htmlFor="chan-rem-email" className="text-xs cursor-pointer">E-mail</Label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold">Janelas de Antecedência</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-2">
              <Label htmlFor="rem-24h" className="text-xs font-medium cursor-pointer">Lembrete com 24 Horas de Antecedência</Label>
              <p className="text-[10px] text-muted-foreground">Disparado no dia anterior à sessão.</p>
            </div>
            <Switch
              id="rem-24h"
              checked={formData.remind24hBefore !== false}
              onCheckedChange={(val) => setFormData({ ...formData, remind24hBefore: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5 pr-2">
              <Label htmlFor="rem-2h" className="text-xs font-medium cursor-pointer">Lembrete com 2 Horas de Antecedência</Label>
              <p className="text-[10px] text-muted-foreground">Alerta final antes do atendimento.</p>
            </div>
            <Switch
              id="rem-2h"
              checked={formData.remind2hBefore !== false}
              onCheckedChange={(val) => setFormData({ ...formData, remind2hBefore: val })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rem-template" className="text-xs font-semibold">Template da Mensagem de Lembrete</Label>
        <Textarea
          id="rem-template"
          rows={3}
          placeholder="Olá {{paciente}}, lembramos de sua consulta..."
          value={(formData.reminderMessageTemplate as string) || "Olá {{paciente}}, lembramos de sua consulta agendada para {{data_hora}} com {{profissional}}. Responda 1 para confirmar ou 2 para remarcar."}
          onChange={(e) => setFormData({ ...formData, reminderMessageTemplate: e.target.value })}
          className="text-xs"
        />
        <span className="text-[11px] text-muted-foreground">Variáveis: <code>{"{{paciente}}"}</code>, <code>{"{{data_hora}}"}</code>, <code>{"{{profissional}}"}</code>.</span>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="rem-allow-confirm" className="font-semibold text-xs cursor-pointer">
            Permitir Confirmação Interativa do Paciente (1/2)
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Atualiza automaticamente o status do agendamento para confirmado na agenda.
          </p>
        </div>
        <Switch
          id="rem-allow-confirm"
          checked={formData.allowPatientConfirmation !== false}
          onCheckedChange={(val) => setFormData({ ...formData, allowPatientConfirmation: val })}
        />
      </div>
    </div>
  );
}
