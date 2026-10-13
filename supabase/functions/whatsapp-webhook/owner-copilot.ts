// supabase/functions/whatsapp-webhook/owner-copilot.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { WhatsAppClient, WhatsAppListSection, WhatsAppListRow, sanitizeMessageInput, sanitizeWhatsAppNumber } from '../_shared/whatsapp-client.ts';
import { TelegramClient, escapeHtml } from '../_shared/telegram-client.ts';
import {
  getNextBusinessDays,
  getAvailableWindowsForDay,
  formatAvailableWindowsText,
  validateSelectedTime,
  generateGoogleCalendarUrl,
  createBrasiliaDate,
  formatMinutesToTime,
  getBrasiliaMinutesOfDay,
  ExistingMeeting,
} from '../_shared/calendar-utils.ts';

export interface OwnerCustomerContext {
  userId: string | null;
  clinicId: string | null;
  userName: string;
  userEmail: string;
  clinicName: string;
  planName: string;
  professionInfo: string;
  isOwnerOrAdmin: boolean;
  isSoloPlan: boolean;
  isClinicPlan: boolean;
  activeRole: string;
}

export const RESTRICTED_NON_OWNER_MESSAGE =
  'Olá! O copiloto de gestão via WhatsApp é uma ferramenta exclusiva para titulares e responsáveis pelas clínicas no PluriFisio.\n\n' +
  'Para acessar seus atendimentos, prontuários e agenda, acesse a plataforma web: https://app.plurifisio.com.br\n\n' +
  'Se você precisa de ajuda com seu acesso, entre em contato com o responsável pela sua clínica.';

const MAX_COMMAND_LENGTH = 60;

/**
 * Conjunto estático de comandos de cancelamento e escape (alocado uma única vez na inicialização do módulo).
 */
const GLOBAL_CANCEL_COMMANDS = new Set([
  'cancelar',
  'cancela',
  'cancel',
  'desistir',
  'desisto',
  'sair',
  'parar',
  'interromper',
  'abortar',
  'menu',
  'inicio',
  'comecar',
  'opcoes',
]);

/**
 * Conjunto estático de comandos de retorno (alocado uma única vez na inicialização do módulo).
 */
const GLOBAL_BACK_COMMANDS = new Set([
  'voltar',
  'volta',
  'anterior',
  'retornar',
  'passo anterior',
  'voltar atras',
]);

/**
 * Normaliza texto removendo acentos, pontuação, múltiplos espaços e convertendo para minúsculas.
 * Executa em O(M) estrito com limitador de tamanho contra ReDoS / buffer abuse.
 */
export function normalizeCommandText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Se o texto for maior que o tamanho máximo esperado para um comando curto, não normaliza além do limite
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_COMMAND_LENGTH) {
    return '';
  }

  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ') // remove pontuações mantendo palavras e espaços
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconhece comandos globais de cancelamento e escape:
 * 'cancelar', 'cancela', 'cancel', 'desistir', 'desisto', 'sair', 'parar', 'interromper', 'abortar',
 * 'menu', 'inicio', 'início', 'comecar', 'começar', 'opcoes', 'opções'.
 * Complexidade: O(M) com busca em Set estático O(1).
 */
export function isGlobalCancelCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  return GLOBAL_CANCEL_COMMANDS.has(normalized);
}

/**
 * Reconhece comandos globais de retorno:
 * 'voltar', 'volta', 'anterior', 'retornar', 'passo anterior', 'voltar atras', 'voltar atrás'.
 * Complexidade: O(M) com busca em Set estático O(1).
 */
export function isGlobalBackCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  return GLOBAL_BACK_COMMANDS.has(normalized);
}

/**
 * Envia o Menu Principal Interativo do Copiloto do Titular (Meta List Message)
 */
export async function sendOwnerMainMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { userName, clinicName, planName, isSoloPlan } = context;
  const planBadge = isSoloPlan ? 'Plano Solo' : 'Plano Clínica';

  const bodyText =
    `Olá, *${userName}*! 👋\n` +
    `Aqui é o seu *Copiloto de Gestão PluriFisio* para a clínica *${clinicName}* (${planBadge}).\n\n` +
    `Como posso ajudar você hoje? Selecione uma das opções abaixo no menu:`;

  const sections: WhatsAppListSection[] = [
    {
      title: '🩺 Gestão Clínica',
      rows: [
        {
          id: 'btn_menu_records',
          title: 'Prontuários & Termos',
          description: 'Acessar fichas, histórico e termos de consentimento',
        },
        {
          id: 'btn_menu_agenda',
          title: 'Agenda & Atendimentos',
          description: 'Ver horários agendados e próximos atendimentos',
        },
      ],
    },
    {
      title: '🛟 Suporte & Financeiro',
      rows: [
        {
          id: 'btn_menu_support',
          title: 'Ajuda & Suporte Técnico',
          description: 'Reportar erro, tirar dúvidas ou falar com suporte',
        },
        {
          id: 'btn_menu_finance',
          title: 'Financeiro & Assinatura',
          description: '2ª via PIX/Boleto, notas fiscais e upgrade',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Ver Opções', sections, {
    title: 'Copiloto PluriFisio',
    footer: `Clínica: ${clinicName.slice(0, 30)}`,
  });
}

/**
 * Envia o submenu de Suporte Técnico
 */
export async function sendSupportMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  userName: string
): Promise<void> {
  const bodyText =
    `Olá, *${userName}*! 🛟\n\n` +
    `Como podemos te ajudar hoje? Selecione abaixo:`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Opções de Suporte',
      rows: [
        {
          id: 'support_report_bug',
          title: 'Reportar Erro ou Bug',
          description: 'Envie relato e prints de erros na plataforma',
        },
        {
          id: 'support_faq',
          title: 'Dúvidas de Uso / FAQ',
          description: 'Orientações ou agendar 15 min com consultor',
        },
        {
          id: 'support_human',
          title: 'Falar com Atendimento',
          description: 'Conversar com nosso time humano no WhatsApp',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Opções de Suporte', sections, {
    title: 'Ajuda & Suporte',
    footer: 'Equipe de Suporte PluriFisio',
  });
}

/**
 * Envia o submenu do Financeiro adaptado ao plano
 */
export async function sendFinanceMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { userName, isSoloPlan } = context;
  const upgradeDesc = isSoloPlan ? 'Mude para planos Solo superiores ou Clínica' : 'Expanda sua equipe e limites da clínica';

  const bodyText =
    `Olá, *${userName}*! 💳\n\n` +
    `Aqui estão as opções financeiras da sua assinatura PluriFisio:`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Financeiro & Assinatura',
      rows: [
        {
          id: 'finance_pix_invoice',
          title: '2ª Via de Pagamento',
          description: 'PIX Copia e Cola / Boleto da fatura aberta',
        },
        {
          id: 'finance_nfse',
          title: 'Notas Fiscais & Recibos',
          description: 'Comprovantes e notas de faturas quitadas',
        },
        {
          id: 'finance_upgrade',
          title: 'Trocar de Plano (Upgrade)',
          description: upgradeDesc.slice(0, 72),
        },
        {
          id: 'finance_human',
          title: 'Consultor Financeiro',
          description: 'Fale com nosso consultor comercial/financeiro',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Opções Financeiras', sections, {
    title: 'Financeiro PluriFisio',
    footer: 'Gestão da Assinatura',
  });
}

/**
 * Consulta e formata faturas abertas em subscription_invoices
 */
export async function handleFinancePixInvoice(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { clinicId, userName } = context;

  if (!clinicId) {
    await whatsAppClient.sendTextMessage(
      phone,
      `Olá, ${userName}! Não localizamos uma clínica vinculada para consulta financeira. Entre em contato com o suporte.`
    );
    return;
  }

  // 1. Buscar faturas com status pendente ou vencida
  const { data: openInvoices, error } = await supabase
    .from('subscription_invoices')
    .select('id, value, due_date, status, pix_copy_paste, bank_slip_url, invoice_url')
    .eq('clinic_id', clinicId)
    .in('status', ['PENDING', 'OVERDUE', 'AWAITING_PAYMENT'])
    .order('due_date', { ascending: true })
    .limit(3);

  if (error) {
    console.error('[owner-copilot] Erro ao buscar subscription_invoices:', error);
  }

  if (openInvoices && openInvoices.length > 0) {
    const inv = openInvoices[0];
    const valFormatted = Number(inv.value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dueDateFormatted = inv.due_date ? String(inv.due_date).split('-').reverse().join('/') : 'Em aberto';

    let msg =
      `📄 *2ª VIA DE FATURA - PLURIFISIO*\n\n` +
      `Olá, *${userName}*! Identificamos a seguinte fatura em aberto:\n\n` +
      `💰 *Valor:* ${valFormatted}\n` +
      `📅 *Vencimento:* ${dueDateFormatted}\n` +
      `📌 *Status:* ${inv.status === 'OVERDUE' ? '⚠️ Vencida' : 'Aguardando Pagamento'}\n\n`;

    if (inv.pix_copy_paste) {
      msg += `🔑 *PIX Copia e Cola:*\n\`${inv.pix_copy_paste}\`\n\n`;
    }

    if (inv.bank_slip_url) {
      msg += `🔗 *Boleto Bancário:* ${inv.bank_slip_url}\n\n`;
    } else if (inv.invoice_url) {
      msg += `🔗 *Visualizar Fatura:* ${inv.invoice_url}\n\n`;
    }

    msg += `Após efetuar o pagamento, a compensação via PIX ocorre em poucos minutos! 🚀`;

    await whatsAppClient.sendTextMessage(phone, msg, { linkPreview: true });
    return;
  }

  // 2. Nenhuma fatura aberta: consultar próxima data de vencimento em clinic_subscriptions
  const { data: subscription } = await supabase
    .from('clinic_subscriptions')
    .select('next_due_date, current_period_end, status')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextDue = subscription?.next_due_date || subscription?.current_period_end;
  const nextDueFormatted = nextDue ? String(nextDue).split('T')[0].split('-').reverse().join('/') : 'no próximo ciclo';

  const allGoodMsg =
    `✅ *Sua conta está 100% em dia!*\n\n` +
    `Olá, *${userName}*! Não encontramos nenhuma fatura pendente para a sua assinatura.\n` +
    `📅 *Próximo vencimento previsto:* ${nextDueFormatted}.\n\n` +
    `Muito obrigado pela confiança no PluriFisio! 🌟`;

  await whatsAppClient.sendTextMessage(phone, allGoodMsg);
}

/**
 * Consulta e formata faturas pagas / recibos
 */
export async function handleFinanceNfse(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { clinicId, userName } = context;

  if (!clinicId) {
    await whatsAppClient.sendTextMessage(
      phone,
      `Olá, ${userName}! Não localizamos uma clínica vinculada para consulta de recibos.`
    );
    return;
  }

  const { data: paidInvoices } = await supabase
    .from('subscription_invoices')
    .select('id, value, payment_date, paid_at, invoice_url, bank_slip_url')
    .eq('clinic_id', clinicId)
    .in('status', ['RECEIVED', 'CONFIRMED', 'PAID'])
    .order('created_at', { ascending: false })
    .limit(3);

  if (!paidInvoices || paidInvoices.length === 0) {
    const noReceiptsMsg =
      `🧾 *Comprovantes & Notas Fiscais*\n\n` +
      `Olá, *${userName}*! Ainda não constam faturas quitadas registradas nesta conta.\n` +
      `Se você acabou de assinar ou está em período de teste gratuito, os recibos serão gerados a partir do primeiro pagamento.`;
    await whatsAppClient.sendTextMessage(phone, noReceiptsMsg);
    return;
  }

  let msg = `🧾 *ÚLTIMOS RECIBOS & COMPROVANTES FISCAIS*\n\nOlá, *${userName}*! Seguem os comprovantes das faturas quitadas:\n\n`;

  paidInvoices.forEach((inv, idx) => {
    const val = Number(inv.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const rawDate = inv.paid_at || inv.payment_date;
    const dateFormatted = rawDate ? String(rawDate).split('T')[0].split('-').reverse().join('/') : 'Quitado';
    msg += `*${idx + 1}. Fatura ${val}* (Pago em ${dateFormatted})\n`;
    if (inv.invoice_url) {
      msg += `   🔗 Download: ${inv.invoice_url}\n`;
    }
    msg += `\n`;
  });

  msg += `Para notas fiscais adicionais ou relatórios contábeis, solicite ao consultor financeiro.`;

  await whatsAppClient.sendTextMessage(phone, msg, { linkPreview: true });
}

/**
 * Exibe opções de upgrade de plano adaptadas ao perfil
 */
export async function handleFinanceUpgrade(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { userName, planName, isSoloPlan } = context;
  const adminCommercialPhone = whatsAppClient.getAdminCommercialPhone();

  let msg = `🔄 *UPGRADE DE PLANO - PLURIFISIO*\n\nOlá, *${userName}*!\nSeu plano atual: *${planName}*\n\n`;

  if (isSoloPlan) {
    msg +=
      `*Opções recomendadas para você:*\n\n` +
      `1️⃣ *Plano Solo Top:* Prontuário eletrônico completo, termos digitais ilimitados e copiloto de WhatsApp prioritário.\n` +
      `2️⃣ *Migração para Plano Clínica:* Adicione secretárias, assistentes e outros fisioterapeutas com permissões granulares e agenda compartilhada.\n\n`;
  } else {
    msg +=
      `*Expansão para sua Clínica:*\n\n` +
      `1️⃣ *Acessos Simultâneos Adicionais:* Libere novos acessos de profissionais e estagiários.\n` +
      `2️⃣ *Pacote Clínico Top / Enterprise:* Relatórios avançados, suporte dedicado e múltiplos consultórios.\n\n`;
  }

  msg +=
    `👉 Para simular valores e ativar condições promocionais, fale diretamente com nosso consultor comercial: https://wa.me/${adminCommercialPhone}`;

  await whatsAppClient.sendTextMessage(phone, msg, { linkPreview: true });
}

/**
 * Sanitiza e valida URLs de imagem contra XSS, javascript: e caracteres maliciosos.
 */
export function sanitizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  // Aceita apenas URLs HTTP e HTTPS bem formadas
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // URL inválida
  }
  return null;
}

/**
 * Salva o bug report na tabela de auditoria platform_error_logs,
 * notifica Telegram e WhatsApp comercial e responde calorosamente ao titular.
 */
export async function handleBugReportSubmission(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  telegramClient: TelegramClient,
  phone: string,
  context: OwnerCustomerContext,
  bugText: string,
  imageUrl?: string | null
): Promise<void> {
  const { userId, clinicId, userName, clinicName, userEmail, planName } = context;
  const sanitizedText = sanitizeMessageInput(bugText, 2000);
  const validatedImageUrl = sanitizeImageUrl(imageUrl);
  const adminCommercialPhone = whatsAppClient.getAdminCommercialPhone();

  // 1. Salvar na tabela de telemetria/auditoria platform_error_logs
  try {
    const { error: logErr } = await supabase.from('platform_error_logs').insert({
      user_id: userId,
      clinic_id: clinicId,
      error_type: 'WhatsApp Bug Report',
      scope: 'whatsapp_bug_report',
      message: sanitizedText || (validatedImageUrl ? 'Bug report com print enviado via WhatsApp' : 'Bug report via WhatsApp'),
      context: {
        source: 'whatsapp_bug_report',
        reporter_phone: phone,
        user_name: userName,
        user_email: userEmail,
        clinic_name: clinicName,
        plan_name: planName,
        has_image: Boolean(validatedImageUrl),
        image_url: validatedImageUrl,
        reported_at: new Date().toISOString(),
      },
    });

    if (logErr) {
      console.error('[owner-copilot] Erro ao registrar bug report em platform_error_logs:', logErr);
    }
  } catch (err) {
    console.error('[owner-copilot] Exceção ao gravar erro em platform_error_logs:', err);
  }

  // 2. Notificar WhatsApp Comercial do Admin (+55 11 98011-3936)
  try {
    const waLink = `https://wa.me/${phone}`;
    let adminMsg =
      `🐛 *NOVO REPORTE DE ERRO / BUG (WHATSAPP)*\n\n` +
      `👤 *Titular:* ${userName}\n` +
      `📱 *WhatsApp:* +${phone}\n` +
      `🏥 *Clínica:* ${clinicName}\n` +
      `📧 *E-mail:* ${userEmail}\n` +
      `📦 *Plano:* ${planName}\n\n` +
      `📝 *Descrição do Erro:*\n"${sanitizedText}"\n\n`;

    if (validatedImageUrl) {
      adminMsg += `🖼️ *Mídia/Print anexado:* ${validatedImageUrl}\n\n`;
    }

    adminMsg += `👉 *Falar com o Titular:* ${waLink}`;

    await whatsAppClient.sendTextMessage(adminCommercialPhone, adminMsg, { linkPreview: true });
  } catch (err) {
    console.error('[owner-copilot] Erro ao notificar admin WhatsApp sobre bug report:', err);
  }

  // 3. Notificar Telegram do Admin
  try {
    const waLink = `https://wa.me/${phone}`;
    let tgMsg =
      `🐛 <b>Novo Bug Report via WhatsApp!</b>\n\n` +
      `👤 <b>Titular:</b> ${escapeHtml(userName)} (${escapeHtml(phone)})\n` +
      `🏥 <b>Clínica:</b> ${escapeHtml(clinicName)}\n` +
      `📦 <b>Plano:</b> ${escapeHtml(planName)}\n\n` +
      `📝 <b>Descrição:</b> <i>"${escapeHtml(sanitizedText)}"</i>\n`;

    if (validatedImageUrl) {
      tgMsg += `🖼️ <b>Print/Imagem:</b> <a href="${escapeHtml(validatedImageUrl)}">Ver Imagem</a>\n`;
    }

    tgMsg += `\n👉 <a href="${waLink}">Chamar no WhatsApp</a>`;

    await telegramClient.sendMessage(tgMsg, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '💬 Responder no WhatsApp',
              url: waLink,
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error('[owner-copilot] Erro ao notificar Telegram sobre bug report:', err);
  }

  // 4. Resposta de confirmação calorosa ao titular
  const confirmationMsg =
    `Recebido com sucesso, ${userName}! 🛠️\n\n` +
    `Nossa equipe de engenharia já foi notificada do erro reportado. Analisaremos com prioridade máxima.\n\n` +
    `Se precisar de suporte emergencial imediato, você também pode chamar nosso canal direto: https://wa.me/${adminCommercialPhone}\n\n` +
    `Obrigado por nos ajudar a melhorar o PluriFisio! 🙏`;

  await whatsAppClient.sendTextMessage(phone, confirmationMsg, { linkPreview: true });
}

// =====================================================================================
// FASE B: PRONTUÁRIO RÁPIDO, TERMOS DE CONSENTIMENTO E PRÉ-CADASTRO DE PACIENTE
// =====================================================================================

export interface PreRegistrationStateData {
  patientName?: string;
  birthDate?: string; // YYYY-MM-DD
  birthDateFormatted?: string; // DD/MM/AAAA
  ageYears?: number;
  isMinor?: boolean;
  documentType?: 'CPF' | 'RG' | 'Passaporte';
  documentNumber?: string;
  parentCpf?: string;
  phone?: string;
  email?: string;
}

/**
 * Envia o submenu interativo de Prontuário Rápido (Meta List Message)
 */
export async function sendRecordsMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { userName, clinicName } = context;

  const bodyText =
    `Olá, *${userName}*! 🩺\n\n` +
    `Bem-vindo ao módulo de *Prontuário & Pacientes* da clínica *${clinicName}*.\n` +
    `Selecione uma das opções abaixo:`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Ações Rápidas',
      rows: [
        {
          id: 'records_terms',
          title: '📄 Termos de Consentimento',
          description: 'Modelos TCLE Adulto e Pediátrico da clínica',
        },
        {
          id: 'records_quick_patient',
          title: '⚡ Pré-Cadastro Rápido',
          description: 'Cadastrar novo paciente em poucos passos',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Opções de Prontuário', sections, {
    title: 'Prontuário & Pacientes',
    footer: 'PluriFisio',
  });
}

/**
 * Envia o submenu de Termos de Consentimento (Meta List Message)
 */
export async function sendTermsMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  userName: string
): Promise<void> {
  const bodyText =
    `Olá, *${userName}*! 📄\n\n` +
    `Qual modelo de *Termo de Consentimento Livre e Esclarecido (TCLE)* você deseja gerar?`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Modelos de Termo',
      rows: [
        {
          id: 'terms_adult',
          title: '👤 Termo Adulto (TCLE)',
          description: 'Para pacientes maiores de 18 anos',
        },
        {
          id: 'terms_pediatric',
          title: '🧒 Termo Responsável (Menor)',
          description: 'Para pacientes menores com responsável',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Selecionar Modelo', sections, {
    title: 'Termos de Consentimento',
    footer: 'PluriFisio',
  });
}

/**
 * Gera e envia o link direto para impressão/visualização do Termo com dados da clínica
 */
export async function handleTermsOption(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  termType: 'adult' | 'pediatric'
): Promise<void> {
  const { userName, clinicId, clinicName } = context;
  const isAdult = termType === 'adult';
  const termTitle = isAdult ? 'Termo de Consentimento - Adulto' : 'Termo de Consentimento do Responsável (Menor)';
  const termUrl = `https://app.plurifisio.com.br/clinica/${clinicId || 'default'}/termos?type=${termType}`;

  const message =
    `📄 *${termTitle.toUpperCase()}*\n\n` +
    `Olá, *${userName}*! Aqui está o link oficial do modelo de consentimento configurado para a sua clínica (*${clinicName}*):\n\n` +
    `🔗 *Acessar / Imprimir Termo:* ${termUrl}\n\n` +
    `📌 *Orientações:*\n` +
    `• Você pode abrir o link no celular ou no computador da clínica para impressão imediata em A4.\n` +
    `• Em caso de menores de 18 anos, certifique-se da assinatura e CPF do responsável legal.\n` +
    `• Os termos também podem ser assinados digitalmente diretamente pelo prontuário eletrônico.`;

  await whatsAppClient.sendTextMessage(phone, message, { linkPreview: true });
}

/**
 * Sanitiza o nome do paciente removendo caracteres de controle, emojis, números e caracteres especiais,
 * preservando espaços únicos e acentuação da língua portuguesa (LGPD & Integridade).
 */
export function sanitizePatientName(input?: string | null, maxLength = 160): string {
  if (!input) return '';
  const cleaned = sanitizeMessageInput(input, maxLength);
  // Mantém apenas letras (incluindo acentos latinos) e espaços
  return cleaned
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normaliza o nome do paciente exatamente igual à função do banco de dados PostgreSQL
 * public.normalize_patient_name_key(_value text).
 * Garante compatibilidade O(1) com os índices compostos idx_patients_clinic_name_birth_lookup
 * e idx_patients_clinic_name_key_lookup.
 */
export function normalizePatientNameKey(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // mantém apenas alfanuméricos
}

/**
 * Sanitiza números de documentos genéricos (RG, Passaporte) removendo caracteres de controle e SQL.
 */
export function sanitizeDocumentNumber(input?: string | null, maxLength = 40): string {
  if (!input) return '';
  const cleaned = sanitizeMessageInput(input, maxLength);
  // Permite apenas letras, números, hífen, pontos e barras comuns em RGs e passaportes
  return cleaned
    .replace(/[^a-zA-Z0-9\.\-\/]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validador e formatador de CPF (algoritmo dos 11 dígitos com validação de dígitos verificadores)
 */
export function validateAndFormatCpf(input: string): { isValid: boolean; cleanDigits: string; formatted: string } {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return { isValid: false, cleanDigits: digits, formatted: input };
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) {
    return { isValid: false, cleanDigits: digits, formatted: input };
  }

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) {
    return { isValid: false, cleanDigits: digits, formatted: input };
  }

  const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return { isValid: true, cleanDigits: digits, formatted };
}

/**
 * Validador e parser de data de nascimento DD/MM/AAAA
 */
export function parseAndValidateBirthDate(input: string): {
  isValid: boolean;
  isoDate?: string;
  formattedDate?: string;
  ageYears?: number;
  isMinor?: boolean;
  errorMessage?: string;
} {
  const trimmed = input.trim();
  let day: number;
  let month: number;
  let year: number;

  // Suporte a DD/MM/AAAA ou DD-MM-AAAA
  const brMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  // Suporte a YYYY-MM-DD (usado nativamente por WhatsApp Flows DatePicker)
  const isoMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);

  if (brMatch) {
    day = parseInt(brMatch[1], 10);
    month = parseInt(brMatch[2], 10);
    year = parseInt(brMatch[3], 10);
  } else if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    return {
      isValid: false,
      errorMessage: 'Formato inválido. Por favor, digite a data no formato DD/MM/AAAA (exemplo: 15/04/1990).',
    };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, errorMessage: 'Mês inválido. Por favor, digite uma data válida.' };
  }

  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { isValid: false, errorMessage: 'Dia inválido para o mês informado.' };
  }

  const now = new Date();
  if (dateObj > now) {
    return { isValid: false, errorMessage: 'A data de nascimento não pode estar no futuro.' };
  }

  if (year < now.getFullYear() - 130) {
    return { isValid: false, errorMessage: 'Data de nascimento além do limite aceito (máximo 130 anos).' };
  }

  let ageYears = now.getFullYear() - year;
  const monthDiff = now.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    ageYears--;
  }

  const isMinor = ageYears < 18;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  return {
    isValid: true,
    isoDate,
    formattedDate,
    ageYears,
    isMinor,
  };
}

interface ExistingPatientLookup {
  id: string;
  patient_code?: string | null;
  name?: string | null;
  status?: string | null;
}

/**
 * Executa a gravação idempotente do paciente no banco de dados
 */
export async function savePatientPreRegistration(
  supabase: SupabaseClient,
  context: OwnerCustomerContext,
  data: PreRegistrationStateData
): Promise<{ success: boolean; patientId: string; patientCode: string; isNew: boolean; error?: string }> {
  const { clinicId, userId } = context;

  if (!clinicId) {
    return { success: false, patientId: '', patientCode: '', isNew: false, error: 'Clínica não vinculada ao usuário' };
  }

  // 1. Sanitização estrita de todos os campos contra injeção e caracteres de controle
  const patientName = sanitizePatientName(data.patientName, 160);
  if (!patientName || patientName.length < 3) {
    return { success: false, patientId: '', patientCode: '', isNew: false, error: 'Nome do paciente inválido ou muito curto' };
  }

  const dateOfBirth = data.birthDate;
  const isMinor = Boolean(data.isMinor);
  const parentCpf = data.parentCpf ? data.parentCpf.replace(/\D/g, '') : null;

  // Validação estrita LGPD & Sigilo Clínico: Menores de idade exigem obrigatoriamente CPF válido do responsável legal
  if (isMinor) {
    if (!parentCpf || !validateAndFormatCpf(parentCpf).isValid) {
      return {
        success: false,
        patientId: '',
        patientCode: '',
        isNew: false,
        error: 'Conformidade LGPD: CPF válido do responsável legal é obrigatório para pacientes menores de 18 anos',
      };
    }
  }

  const docType = data.documentType || 'CPF';
  const docNumber = data.documentNumber ? sanitizeDocumentNumber(data.documentNumber, 40) : null;

  let patientCpf: string | null = null;
  let patientRg: string | null = null;

  if (!isMinor && docNumber) {
    if (docType === 'CPF') {
      const cpfValidation = validateAndFormatCpf(docNumber);
      if (cpfValidation.isValid) {
        patientCpf = cpfValidation.cleanDigits;
      }
    } else if (docType === 'RG') {
      patientRg = docNumber;
    }
  }

  const cleanPhone = data.phone ? data.phone.replace(/\D/g, '').slice(0, 15) : null;
  let cleanEmail: string | null = null;
  if (data.email && data.email !== '0') {
    const trimmedEmail = sanitizeMessageInput(data.email.trim().toLowerCase(), 150);
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
      cleanEmail = trimmedEmail;
    }
  }

  try {
    // 2. Checagem de idempotência na clínica (O(1) via índices existentes)
    let existingPatient: ExistingPatientLookup | null = null;

    // A) Consulta prioritária por CPF: O(1) usando idx_patients_clinic_cpf_lookup
    if (patientCpf) {
      const { data: byCpf } = await supabase
        .from('patients')
        .select('id, patient_code, name, status')
        .eq('clinic_id', clinicId)
        .eq('cpf', patientCpf)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byCpf) existingPatient = byCpf as ExistingPatientLookup;
    }

    // B) Consulta secundária por Nome + Data de Nascimento: O(1) usando idx_patients_clinic_name_birth_lookup
    if (!existingPatient && patientName && dateOfBirth) {
      const { data: byNameBirth } = await supabase
        .from('patients')
        .select('id, patient_code, name, status')
        .eq('clinic_id', clinicId)
        .ilike('name', patientName)
        .eq('date_of_birth', dateOfBirth)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byNameBirth) existingPatient = byNameBirth as ExistingPatientLookup;
    }

    // 3. Se já existir, atualiza dados cadastrais sem duplicidade de prontuário
    if (existingPatient) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (cleanPhone) updatePayload.phone = cleanPhone;
      if (cleanEmail) updatePayload.email = cleanEmail;
      if (isMinor && parentCpf) {
        updatePayload.responsible_cpf = parentCpf;
        updatePayload.uses_responsible_cpf = true;
      }
      if (patientRg) updatePayload.rg = patientRg;

      await supabase.from('patients').update(updatePayload).eq('id', existingPatient.id);

      return {
        success: true,
        patientId: existingPatient.id,
        patientCode: existingPatient.patient_code || 'PAC-001',
        isNew: false,
      };
    }

    // 4. Gerar próximo código do paciente (PAC-xxx)
    // O banco já possui a trigger set_patient_code_before_insert que invoca trg_auto_assign_patient_code,
    // mas chamamos a RPC generate_next_patient_code para prever o código de exibição no WhatsApp.
    let nextCode: string | null = null;
    try {
      const { data: codeData } = await supabase.rpc('generate_next_patient_code', {
        _clinic_id: clinicId,
      });
      if (codeData && typeof codeData === 'string' && codeData.startsWith('PAC-')) {
        nextCode = codeData;
      }
    } catch {
      // Fallback: deixar a trigger set_patient_code_before_insert do PostgreSQL preencher automaticamente
      nextCode = null;
    }

    // 5. Inserir novo paciente
    const insertPayload: Record<string, unknown> = {
      user_id: userId || '00000000-0000-0000-0000-000000000000',
      clinic_id: clinicId,
      name: patientName,
      date_of_birth: dateOfBirth,
      age: data.ageYears ?? null,
      status: 'ativo',
      registration_complete: false,
      phone: cleanPhone,
      email: cleanEmail,
      uses_responsible_cpf: isMinor,
      responsible_cpf: isMinor ? parentCpf : null,
      cpf: patientCpf,
      rg: patientRg,
    };

    if (nextCode) {
      insertPayload.patient_code = nextCode;
    }

    let { data: inserted, error: insertErr } = await supabase
      .from('patients')
      .insert(insertPayload)
      .select('id, patient_code')
      .single();

    // Se houve conflito de código de paciente por concorrência simultânea, tenta sem forçar patient_code
    // para que a trigger do banco gere um novo
    if (insertErr && (insertErr.message?.includes('patients_clinic_id_patient_code_key') || insertErr.code === '23505')) {
      delete insertPayload.patient_code;
      const retry = await supabase
        .from('patients')
        .insert(insertPayload)
        .select('id, patient_code')
        .single();
      inserted = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !inserted) {
      const errorMsg = insertErr?.message || 'Falha ao registrar novo paciente';
      console.error('[owner-copilot] Erro ao inserir paciente em pre-registration:', errorMsg);
      return { success: false, patientId: '', patientCode: '', isNew: false, error: errorMsg };
    }

    return {
      success: true,
      patientId: inserted.id,
      patientCode: inserted.patient_code || nextCode || 'PAC-001',
      isNew: true,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[owner-copilot] Exceção em savePatientPreRegistration:', errMsg);
    return { success: false, patientId: '', patientCode: '', isNew: false, error: errMsg };
  }
}

/**
 * Manipula a máquina de estados conversacional do Pré-Cadastro Rápido de Paciente
 */
export async function handleQuickPatientPreRegistrationFlow(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  currentStep: string,
  userText: string,
  selectedButtonId: string,
  existingStateData: PreRegistrationStateData
): Promise<{ nextStep: string; updatedStateData: PreRegistrationStateData; handled: boolean }> {
  const stateData: PreRegistrationStateData = { ...existingStateData };
  const trimmedText = (userText || '').trim();
  const hasButtonReply = Boolean(selectedButtonId && selectedButtonId.trim().length > 0);

  // Anti-conflito: só processa cancelamento/retorno por texto se NÃO foi clique de botão
  if (!hasButtonReply && trimmedText) {
    // 1. Comando Global de Cancelamento
    if (isGlobalCancelCommand(trimmedText)) {
      await whatsAppClient.sendButtonsMessage(
        phone,
        'Pré-cadastro cancelado. O que deseja fazer agora?',
        {
          buttons: [
            { id: 'btn_menu_records', label: '🩺 Prontuário' },
            { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
          ],
        }
      );
      return { nextStep: 'initial', updatedStateData: {}, handled: true };
    }

    // 2. Comando Global de Voltar
    if (isGlobalBackCommand(trimmedText)) {
      // Se estiver em precad_waiting_email -> Volta para precad_waiting_phone
      if (currentStep === 'precad_waiting_email') {
        const phonePrompt = `Digite o *Telefone/WhatsApp de Contato* do paciente (ou digite *0* se não possuir):`;
        await whatsAppClient.sendTextMessage(phone, phonePrompt);
        return { nextStep: 'precad_waiting_phone', updatedStateData: stateData, handled: true };
      }

      // Se estiver em precad_waiting_phone -> Volta para documento
      if (currentStep === 'precad_waiting_phone') {
        if (stateData.isMinor) {
          const minorPrompt =
            `👶 *Paciente menor de 18 anos*.\n\n` +
            `Por favor, digite o *CPF do Responsável Legal* (somente números ou com pontos e traço):`;
          await whatsAppClient.sendTextMessage(phone, minorPrompt);
          return { nextStep: 'precad_waiting_minor_parent_cpf', updatedStateData: stateData, handled: true };
        } else {
          const docType = stateData.documentType || 'CPF';
          const askDocNum = `Por favor, digite o *Número do ${docType}* do paciente:`;
          await whatsAppClient.sendTextMessage(phone, askDocNum);
          return { nextStep: 'precad_waiting_doc_number', updatedStateData: stateData, handled: true };
        }
      }

      // Se estiver em precad_waiting_doc_number ou precad_waiting_minor_parent_cpf ou precad_waiting_doc_type -> Volta para precad_waiting_birthdate
      if (
        currentStep === 'precad_waiting_doc_number' ||
        currentStep === 'precad_waiting_minor_parent_cpf' ||
        currentStep === 'precad_waiting_doc_type'
      ) {
        const askBirth =
          `Paciente: *${stateData.patientName || 'Não informado'}*.\n\n` +
          `Digite a *Data de Nascimento* no formato *DD/MM/AAAA* (exemplo: 15/04/1995):`;
        await whatsAppClient.sendTextMessage(phone, askBirth);
        return { nextStep: 'precad_waiting_birthdate', updatedStateData: stateData, handled: true };
      }

      // Se estiver em precad_waiting_birthdate -> Volta para precad_waiting_name
      if (currentStep === 'precad_waiting_birthdate') {
        const prompt =
          `⚡ *Pré-Cadastro Rápido de Paciente*\n\n` +
          `Por favor, digite o *Nome Completo* do paciente:`;
        await whatsAppClient.sendTextMessage(phone, prompt);
        return { nextStep: 'precad_waiting_name', updatedStateData: stateData, handled: true };
      }

      // Se estiver em precad_waiting_name -> Volta para o menu de Prontuários (sendRecordsMenu)
      if (currentStep === 'precad_waiting_name' || currentStep === 'records_quick_patient') {
        await sendRecordsMenu(whatsAppClient, phone, context);
        return { nextStep: 'initial', updatedStateData: {}, handled: true };
      }
    }
  }

  // Início do fluxo: precad_waiting_name
  if (currentStep === 'records_quick_patient' || currentStep === 'precad_waiting_name') {
    if (!stateData.patientName && (!trimmedText || selectedButtonId === 'records_quick_patient')) {
      const prompt =
        `⚡ *Pré-Cadastro Rápido de Paciente*\n\n` +
        `Por favor, digite o *Nome Completo* do paciente:`;
      await whatsAppClient.sendTextMessage(phone, prompt);
      return { nextStep: 'precad_waiting_name', updatedStateData: stateData, handled: true };
    }

    // Recebeu o nome completo
    const sanitizedCandidate = sanitizePatientName(trimmedText, 160);
    if (sanitizedCandidate.length < 3) {
      await whatsAppClient.sendTextMessage(phone, `Por favor, digite um nome válido com pelo menos 3 letras (apenas letras):`);
      return { nextStep: 'precad_waiting_name', updatedStateData: stateData, handled: true };
    }

    stateData.patientName = sanitizedCandidate;
    const askBirth =
      `Ótimo! Paciente: *${stateData.patientName}*.\n\n` +
      `Agora, digite a *Data de Nascimento* no formato *DD/MM/AAAA* (exemplo: 15/04/1995):`;
    await whatsAppClient.sendTextMessage(phone, askBirth);
    return { nextStep: 'precad_waiting_birthdate', updatedStateData: stateData, handled: true };
  }

  // Passo 2: precad_waiting_birthdate
  if (currentStep === 'precad_waiting_birthdate') {
    const parsed = parseAndValidateBirthDate(trimmedText);
    if (!parsed.isValid) {
      await whatsAppClient.sendTextMessage(phone, parsed.errorMessage || 'Data inválida. Tente no formato DD/MM/AAAA:');
      return { nextStep: 'precad_waiting_birthdate', updatedStateData: stateData, handled: true };
    }

    stateData.birthDate = parsed.isoDate;
    stateData.birthDateFormatted = parsed.formattedDate;
    stateData.ageYears = parsed.ageYears;
    stateData.isMinor = parsed.isMinor;

    // Se < 18 anos: Menor de idade
    if (parsed.isMinor) {
      const minorPrompt =
        `👶 *Paciente menor de 18 anos detectado* (${parsed.ageYears} anos).\n\n` +
        `Por favor, digite o *CPF do Responsável Legal* (somente números ou com pontos e traço):`;
      await whatsAppClient.sendTextMessage(phone, minorPrompt);
      return { nextStep: 'precad_waiting_minor_parent_cpf', updatedStateData: stateData, handled: true };
    }

    // Se >= 18 anos: Envia botões para escolha do documento
    const adultPrompt =
      `👤 *Paciente adulto* (${parsed.ageYears} anos).\n\n` +
      `Selecione o documento de identificação que deseja registrar:`;

    await whatsAppClient.sendButtonsMessage(phone, adultPrompt, {
      title: 'Tipo de Documento',
      footer: 'PluriFisio',
      buttons: [
        { id: 'precad_doc_cpf', label: 'CPF' },
        { id: 'precad_doc_rg', label: 'RG' },
        { id: 'precad_doc_passaporte', label: 'Passaporte' },
      ],
    });

    return { nextStep: 'precad_waiting_doc_type', updatedStateData: stateData, handled: true };
  }

  // Passo 3.A (Menor): precad_waiting_minor_parent_cpf
  if (currentStep === 'precad_waiting_minor_parent_cpf') {
    const cpfValidation = validateAndFormatCpf(trimmedText);
    if (!cpfValidation.isValid) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ CPF do responsável inválido. Por favor, digite um CPF válido com 11 dígitos:`
      );
      return { nextStep: 'precad_waiting_minor_parent_cpf', updatedStateData: stateData, handled: true };
    }

    stateData.parentCpf = cpfValidation.cleanDigits;
    const phonePrompt =
      `✅ CPF do responsável anotado: *${cpfValidation.formatted}*.\n\n` +
      `Digite o *Telefone/WhatsApp de Contato* do paciente ou responsável (ou digite *0* se não possuir):`;
    await whatsAppClient.sendTextMessage(phone, phonePrompt);
    return { nextStep: 'precad_waiting_phone', updatedStateData: stateData, handled: true };
  }

  // Passo 3.B (Maior): precad_waiting_doc_type
  if (currentStep === 'precad_waiting_doc_type') {
    let chosenDoc: 'CPF' | 'RG' | 'Passaporte' = 'CPF';
    const lower = trimmedText.toLowerCase();

    if (selectedButtonId === 'precad_doc_rg' || lower === 'rg') {
      chosenDoc = 'RG';
    } else if (selectedButtonId === 'precad_doc_passaporte' || lower === 'passaporte') {
      chosenDoc = 'Passaporte';
    } else {
      chosenDoc = 'CPF';
    }

    stateData.documentType = chosenDoc;
    const askDocNum = `Por favor, digite o *Número do ${chosenDoc}* do paciente:`;
    await whatsAppClient.sendTextMessage(phone, askDocNum);
    return { nextStep: 'precad_waiting_doc_number', updatedStateData: stateData, handled: true };
  }

  // Passo 4 (Maior): precad_waiting_doc_number
  if (currentStep === 'precad_waiting_doc_number') {
    const docType = stateData.documentType || 'CPF';

    if (docType === 'CPF') {
      const cpfValidation = validateAndFormatCpf(trimmedText);
      if (!cpfValidation.isValid) {
        await whatsAppClient.sendTextMessage(phone, `⚠️ CPF inválido. Por favor, digite um CPF com 11 dígitos válido:`);
        return { nextStep: 'precad_waiting_doc_number', updatedStateData: stateData, handled: true };
      }
      stateData.documentNumber = cpfValidation.cleanDigits;
    } else {
      const sanitizedDoc = sanitizeDocumentNumber(trimmedText, 40);
      if (sanitizedDoc.length < 4) {
        await whatsAppClient.sendTextMessage(phone, `Por favor, digite um número de ${docType} válido:`);
        return { nextStep: 'precad_waiting_doc_number', updatedStateData: stateData, handled: true };
      }
      stateData.documentNumber = sanitizedDoc;
    }

    const phonePrompt =
      `Documento anotado com sucesso!\n\n` +
      `Digite o *Telefone/WhatsApp de Contato* do paciente (ou digite *0* se não possuir):`;
    await whatsAppClient.sendTextMessage(phone, phonePrompt);
    return { nextStep: 'precad_waiting_phone', updatedStateData: stateData, handled: true };
  }

  // Passo 5: precad_waiting_phone
  if (currentStep === 'precad_waiting_phone') {
    if (trimmedText === '0' || trimmedText.toLowerCase() === 'não' || trimmedText.toLowerCase() === 'nao') {
      stateData.phone = '';
    } else {
      const cleanDigits = trimmedText.replace(/\D/g, '');
      if (cleanDigits.length < 8) {
        await whatsAppClient.sendTextMessage(
          phone,
          `Telefone inválido. Digite o número com DDD (ex: 11999998888) ou digite *0* para pular:`
        );
        return { nextStep: 'precad_waiting_phone', updatedStateData: stateData, handled: true };
      }
      stateData.phone = cleanDigits;
    }

    const emailPrompt = `Digite o *E-mail* do paciente (ou digite *0* se não possuir):`;
    await whatsAppClient.sendTextMessage(phone, emailPrompt);
    return { nextStep: 'precad_waiting_email', updatedStateData: stateData, handled: true };
  }

  // Passo 6: precad_waiting_email (Gravação & Idempotência no Banco)
  if (currentStep === 'precad_waiting_email') {
    if (trimmedText === '0' || trimmedText.toLowerCase() === 'não' || trimmedText.toLowerCase() === 'nao') {
      stateData.email = '';
    } else {
      const emailLower = trimmedText.toLowerCase();
      if (!emailLower.includes('@') || !emailLower.includes('.')) {
        await whatsAppClient.sendTextMessage(
          phone,
          `E-mail em formato inválido. Digite um e-mail válido (ex: paciente@gmail.com) ou digite *0* para pular:`
        );
        return { nextStep: 'precad_waiting_email', updatedStateData: stateData, handled: true };
      }
      stateData.email = sanitizeMessageInput(emailLower, 150);
    }

    // Gravação no Banco de Dados
    const saveResult = await savePatientPreRegistration(supabase, context, stateData);

    if (!saveResult.success) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ Desculpe, ocorreu uma instabilidade ao salvar o paciente: ${saveResult.error || 'Erro desconhecido'}. Por favor, tente novamente mais tarde.`
      );
      return { nextStep: 'initial', updatedStateData: {}, handled: true };
    }

    await sendPatientPreRegistrationConfirmation(
      supabase,
      whatsAppClient,
      phone,
      context,
      stateData,
      saveResult
    );

    return { nextStep: 'initial', updatedStateData: {}, handled: true };
  }

  return { nextStep: currentStep, updatedStateData: stateData, handled: false };
}

/**
 * Envia a mensagem calorosa de confirmação com resumo, código PAC-xxx,
 * link do Termo de Consentimento e botões de ação [📱 Abrir no App] e [🔗 Compartilhar com Paciente].
 */
export async function sendPatientPreRegistrationConfirmation(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  stateData: PreRegistrationStateData,
  saveResult: { patientId: string; patientCode: string; isNew: boolean }
): Promise<void> {
  const { patientId: resolvedPatientId, patientCode, isNew } = saveResult;

  // Geração ou consulta de link com token público seguro
  let shareToken: string | null = null;
  let passwordPrefix: string | null = null;

  if (resolvedPatientId) {
    try {
      const { data: linkData } = await supabase.rpc('create_patient_registration_link', {
        _patient_id: resolvedPatientId,
      });
      if (linkData?.token) {
        shareToken = linkData.token;
        passwordPrefix = linkData.password_prefix;
      }
    } catch {
      // Fallback silencioso: se RPC exigir auth context direto, busca em patient_registration_links
      try {
        const { data: existingLink } = await supabase
          .from('patient_registration_links')
          .select('token, password_prefix')
          .eq('patient_id', resolvedPatientId)
          .limit(1)
          .maybeSingle();
        if (existingLink?.token) {
          shareToken = existingLink.token;
          passwordPrefix = existingLink.password_prefix;
        }
      } catch {
        // ignora
      }
    }
  }

  const isMinor = Boolean(stateData.isMinor);
  const docSummary = isMinor
    ? `CPF Resp.: ${stateData.parentCpf ? validateAndFormatCpf(stateData.parentCpf).formatted : 'Informado'}`
    : `${stateData.documentType}: ${stateData.documentNumber}`;
  const termType = isMinor ? 'pediatric' : 'adult';
  const termUrl = `https://app.plurifisio.com.br/clinica/${context.clinicId}/termos?type=${termType}`;
  const patientUrl = `https://app.plurifisio.com.br/pacientes/${patientCode || resolvedPatientId}`;
  const shareUrl = shareToken
    ? `https://app.plurifisio.com.br/cadastro/paciente/${shareToken}`
    : `https://app.plurifisio.com.br/cadastro/${patientCode || resolvedPatientId}`;

  const pwdInfo = passwordPrefix ? `\n🔐 *Senha de Acesso:* \`${passwordPrefix}\` (primeiros 6 dígitos do CPF/nascimento)` : '';

  // Mensagem calorosa de fechamento e confirmação
  const summaryMsg =
    `🎉 *PRÉ-CADASTRO REALIZADO COM SUCESSO!* ⚡\n\n` +
    `👤 *Paciente:* ${stateData.patientName}\n` +
    `🎂 *Nascimento:* ${stateData.birthDateFormatted} (${stateData.ageYears} anos)\n` +
    `🪪 *Documento:* ${docSummary}\n` +
    `🏷️ *Código:* ${patientCode}\n` +
    `📌 *Status:* ${isNew ? 'Criado no sistema' : 'Atualizado no sistema'}\n\n` +
    `📄 *Termo de Consentimento Recomendado:*\n${termUrl}\n\n` +
    `*Próximos Passos:*\n` +
    `• *Abrir ficha no App:* ${patientUrl}\n\n` +
    `• *Encaminhar para o paciente preencher anamnese:*\n` +
    `_"Olá, ${stateData.patientName}! Para agilizar sua consulta na ${context.clinicName}, complete sua ficha com segurança no link: ${shareUrl}"_${pwdInfo}`;

  // Botões de ação rápida para o titular
  await whatsAppClient.sendButtonsMessage(phone, summaryMsg, {
    title: 'Paciente Cadastrado',
    footer: 'PluriFisio',
    buttons: [
      { id: `btn_open_patient_${patientCode}`, label: '📱 Abrir no App' },
      { id: `btn_share_patient_${patientCode}`, label: '🔗 Compartilhar' },
      { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
    ],
  });
}

/**
 * Processador central de submissão do formulário WhatsApp Flow (interactive.nfm_reply)
 */
export async function handleFlowPreRegistrationSubmission(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  flowPayload: Record<string, unknown>
): Promise<{ success: boolean; error?: string; patientId?: string; patientCode?: string }> {
  try {
    // 1. Sanitização e extração dos campos enviados pelo Flow com whitelist estrita
    const safeFlowObj = (flowPayload && typeof flowPayload === 'object') ? flowPayload : {};
    
    // Whitelist estrita de campos esperados do flow
    const rawName = String(safeFlowObj.name || safeFlowObj.patient_name || '').trim();
    const sanitizedName = sanitizePatientName(rawName, 160);

    if (sanitizedName.length < 3) {
      await whatsAppClient.sendTextMessage(
        phone,
        '⚠️ Nome do paciente inválido no formulário. Por favor, tente novamente ou preencha via chat.'
      );
      return { success: false, error: 'Nome de paciente inválido' };
    }

    const rawBirth = String(safeFlowObj.birth_date || '').trim();
    const birthValidation = parseAndValidateBirthDate(rawBirth);

    if (!birthValidation.isValid) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ Data de nascimento inválida no formulário: ${birthValidation.errorMessage || 'Verifique a data.'}`
      );
      return { success: false, error: 'Data de nascimento inválida' };
    }

    const rawDocType = String(safeFlowObj.doc_type || 'CPF').trim();
    let docType: 'CPF' | 'RG' | 'Passaporte' = 'CPF';
    if (rawDocType.toUpperCase() === 'RG') docType = 'RG';
    else if (rawDocType.toLowerCase().includes('pass')) docType = 'Passaporte';

    const rawDocNumber = String(safeFlowObj.doc_number || '').trim();
    const sanitizedDocNumber = sanitizeDocumentNumber(rawDocNumber, 40);

    if (docType === 'CPF') {
      const cpfCheck = validateAndFormatCpf(sanitizedDocNumber);
      if (!cpfCheck.isValid) {
        await whatsAppClient.sendTextMessage(
          phone,
          '⚠️ O CPF do paciente informado no formulário é inválido. Por favor, verifique os 11 dígitos.'
        );
        return { success: false, error: 'CPF do paciente inválido' };
      }
    } else if (sanitizedDocNumber.length < 3) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ Número de ${docType} muito curto ou inválido no formulário.`
      );
      return { success: false, error: 'Número de documento inválido' };
    }

    // Validação estrita de Menor de Idade (< 18 anos) - Prevenção de evasão
    let parentCpfClean: string | undefined;
    if (birthValidation.isMinor) {
      const rawParentCpf = String(safeFlowObj.parent_cpf || '').trim();
      const parentCpfCheck = validateAndFormatCpf(rawParentCpf);
      if (!parentCpfCheck.isValid) {
        await whatsAppClient.sendTextMessage(
          phone,
          '⚠️ Paciente menor de 18 anos detectado: o CPF do Responsável Legal é obrigatório e precisa ser válido.'
        );
        return { success: false, error: 'CPF do responsável legal obrigatório e inválido' };
      }
      parentCpfClean = parentCpfCheck.cleanDigits;
    }

    // Telefone com sanitização estrita E.164
    let sanitizedPhone: string | undefined;
    const rawPhone = String(safeFlowObj.phone || '').trim();
    if (rawPhone && rawPhone !== '0') {
      const cleanPhone = sanitizeWhatsAppNumber(rawPhone);
      if (cleanPhone) {
        sanitizedPhone = cleanPhone;
      }
    }

    // E-mail com validação e sanitização estrita
    let sanitizedEmail: string | undefined;
    const rawEmail = String(safeFlowObj.email || '').trim().toLowerCase();
    if (rawEmail && rawEmail !== '0') {
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
        sanitizedEmail = sanitizeMessageInput(rawEmail, 150);
      }
    }

    const stateData: PreRegistrationStateData = {
      patientName: sanitizedName,
      birthDate: birthValidation.isoDate,
      birthDateFormatted: birthValidation.formattedDate,
      ageYears: birthValidation.ageYears,
      isMinor: birthValidation.isMinor,
      documentType: docType,
      documentNumber: docType === 'CPF' ? validateAndFormatCpf(sanitizedDocNumber).cleanDigits : sanitizedDocNumber,
      parentCpf: parentCpfClean,
      phone: sanitizedPhone,
      email: sanitizedEmail,
    };

    // 2. Gravação idempotente e atômica
    const saveResult = await savePatientPreRegistration(supabase, context, stateData);

    if (!saveResult.success) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ Desculpe, ocorreu uma instabilidade ao salvar o paciente do formulário: ${saveResult.error || 'Erro desconhecido'}.`
      );
      return { success: false, error: saveResult.error };
    }

    // 3. Resposta de confirmação calorosa
    await sendPatientPreRegistrationConfirmation(
      supabase,
      whatsAppClient,
      phone,
      context,
      stateData,
      saveResult
    );

    return {
      success: true,
      patientId: saveResult.patientId,
      patientCode: saveResult.patientCode,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[owner-copilot] Exceção em handleFlowPreRegistrationSubmission:', errorMsg);
    await whatsAppClient.sendTextMessage(
      phone,
      '⚠️ Ocorreu um erro inesperado ao processar o formulário. Por favor, preencha conversando diretamente no chat.'
    );
    return { success: false, error: errorMsg };
  }
}

// =====================================================================================
// FASE C: AGENDA E ATENDIMENTOS NO COPILOTO DO TITULAR
// =====================================================================================

export interface AgendaStateData {
  subType?: 'patient' | 'event' | 'meeting';
  patientCpf?: string;
  patientId?: string;
  patientName?: string;
  title?: string;
  dateIso?: string;
  dateDisplay?: string;
  time?: string;
  collaborators?: string;
  durationMinutes?: number;
  editingEventId?: string;
  editingField?: 'date' | 'time' | 'collaborators';
}

/**
 * 1. Submenu <Agenda & Atendimentos> (Meta List Message)
 */
export async function sendAgendaMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { userName, clinicName } = context;

  const bodyText =
    `Olá, *${userName}*! 📅\n\n` +
    `Aqui é a central de *Agenda & Atendimentos* da clínica *${clinicName}*.\n` +
    `Como você gostaria de prosseguir? Escolha uma opção abaixo:`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Ações da Agenda',
      rows: [
        {
          id: 'agenda_new',
          title: '⚡ Novo Agendamento',
          description: 'Agendar paciente, evento ou reunião',
        },
        {
          id: 'agenda_full',
          title: '📋 Agenda Completa',
          description: 'Ver atendimentos de hoje e dos próximos 7 dias',
        },
        {
          id: 'agenda_next',
          title: '⏰ Próximo Agendamento',
          description: 'Ver detalhes e ações rápidas do próximo atendimento',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Opções da Agenda', sections, {
    title: 'Agenda & Atendimentos',
    footer: `Clínica: ${clinicName.slice(0, 30)}`,
  });
}

/**
 * 2. Módulo <Novo Agendamento> - Menu de seleção de tipo (Meta List Message)
 */
export async function sendNewAppointmentTypeMenu(
  whatsAppClient: WhatsAppClient,
  phone: string,
  userName: string
): Promise<void> {
  const bodyText =
    `Olá, *${userName}*! ⚡\n\n` +
    `Qual tipo de agendamento você deseja registrar na sua agenda?`;

  const sections: WhatsAppListSection[] = [
    {
      title: 'Tipo de Agendamento',
      rows: [
        {
          id: 'agenda_new_patient',
          title: '🩺 Atendimento de Paciente',
          description: 'Agendar sessão clínica para um paciente',
        },
        {
          id: 'agenda_new_event',
          title: '📌 Agendar Evento',
          description: 'Bloqueio de agenda, curso ou compromisso pessoal',
        },
        {
          id: 'agenda_new_meeting',
          title: '🤝 Agendar Reunião',
          description: 'Reunião de equipe, alinhamento ou administrativo',
        },
      ],
    },
  ];

  await whatsAppClient.sendListMessage(phone, bodyText, 'Selecionar Tipo', sections, {
    title: 'Novo Agendamento',
    footer: 'PluriFisio',
  });
}

/**
 * Helper para carregar compromissos existentes da clínica numa data para o cálculo de disponibilidade
 */
export async function loadExistingMeetingsForClinicDay(
  supabase: SupabaseClient,
  clinicId: string,
  dateIso: string,
  excludeEventId?: string
): Promise<ExistingMeeting[]> {
  const [year, month, day] = dateIso.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59)).toISOString();

  const { data: events } = await supabase
    .from('agenda_events')
    .select('id, scheduled_for, duration_minutes, status')
    .eq('clinic_id', clinicId)
    .gte('scheduled_for', startOfDay)
    .lte('scheduled_for', endOfDay)
    .neq('status', 'cancelado');

  const filteredEvents = (events || []).filter((e) => {
    if (excludeEventId && e.id === excludeEventId) return false;
    return true;
  });

  const meetings: ExistingMeeting[] = filteredEvents.map((e) => ({
    scheduled_at: e.scheduled_for,
    duration_minutes: e.duration_minutes || 60,
    status: e.status,
  }));

  return meetings;
}

/**
 * Helper para enviar Lista Interativa com os próximos 5 dias úteis
 */
export async function sendAgendaDateSelectionList(
  whatsAppClient: WhatsAppClient,
  phone: string,
  promptTitle = 'Selecione a Data'
): Promise<void> {
  const days = getNextBusinessDays(5);
  const rows = days.map((d) => ({
    id: `agenda_date_${d.dateIso}`,
    title: d.fullLabel.slice(0, 24),
    description: `Disponibilidade para ${d.displayDayOfWeek}`,
  }));

  const sections: WhatsAppListSection[] = [
    {
      title: 'Próximos Dias Úteis',
      rows,
    },
  ];

  const bodyText =
    `🗓️ *Selecione o dia do agendamento:*\n\n` +
    `Escolha um dos próximos 5 dias úteis abaixo para verificar a disponibilidade de horários:`;

  await whatsAppClient.sendListMessage(phone, bodyText, 'Escolher Dia', sections, {
    title: promptTitle,
    footer: 'PluriFisio',
  });
}

/**
 * Máquina de Estados para Fluxo de Agendamento Interativo (Fase C)
 */
export async function handleAgendaCreationFlow(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  currentStep: string,
  userText: string,
  selectedButtonId?: string,
  stateData: AgendaStateData = {}
): Promise<{ handled: boolean; nextStep: string; updatedStateData: AgendaStateData }> {
  const { clinicId, userId, userName, clinicName, isSoloPlan, isClinicPlan } = context;
  const updatedData: AgendaStateData = { ...stateData };
  const trimmedText = userText.trim();

  const hasButtonReply = Boolean(selectedButtonId && selectedButtonId.trim().length > 0);

  // 1. Cancelamento explícito via botão ou comando global de cancelamento por texto
  if (selectedButtonId === 'agenda_cancel_flow' || (!hasButtonReply && trimmedText && isGlobalCancelCommand(trimmedText))) {
    await whatsAppClient.sendButtonsMessage(
      phone,
      'Operação de agendamento cancelada. O que você gostaria de fazer agora?',
      {
        buttons: [
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
          { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
        ],
      }
    );
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // 2. Comando Global de Retorno ('voltar') por texto (sem conflito com botões)
  if (!hasButtonReply && trimmedText && isGlobalBackCommand(trimmedText)) {
    // Se estiver em agenda_waiting_collab -> Volta para a digitação de Horário (agenda_waiting_time)
    if (currentStep === 'agenda_waiting_collab' || currentStep === 'agenda_waiting_collab_text') {
      const dateDisplay = updatedData.dateDisplay || updatedData.dateIso || '';
      const promptHorario =
        `📅 *Data Selecionada:* ${dateDisplay}\n\n` +
        `👉 Por favor, *digite o horário desejado* no formato *hh:mm* (ex: 09:30, 14:00, 16:30):`;
      await whatsAppClient.sendTextMessage(phone, promptHorario);
      return { handled: true, nextStep: 'agenda_waiting_time', updatedStateData: updatedData };
    }

    // Se estiver em agenda_waiting_time -> Volta para a seleção de Data (agenda_waiting_date), limpando o horário anterior
    if (currentStep === 'agenda_waiting_time') {
      delete updatedData.time;
      await sendAgendaDateSelectionList(whatsAppClient, phone, 'Data do Agendamento');
      return { handled: true, nextStep: 'agenda_waiting_date', updatedStateData: updatedData };
    }

    // Se estiver em agenda_waiting_date -> Volta para a seleção de tipo de agendamento (agenda_select_type)
    if (currentStep === 'agenda_waiting_date') {
      delete updatedData.dateIso;
      delete updatedData.dateDisplay;
      delete updatedData.time;
      await sendNewAppointmentTypeMenu(whatsAppClient, phone, userName);
      return { handled: true, nextStep: 'agenda_select_type', updatedStateData: updatedData };
    }

    // Se estiver em agenda_waiting_patient_cpf ou agenda_waiting_event_title -> Cancela o fluxo e volta para o menu de Agenda (sendAgendaMenu)
    if (
      currentStep === 'agenda_waiting_patient_cpf' ||
      currentStep === 'agenda_waiting_event_title' ||
      currentStep === 'agenda_select_type'
    ) {
      await sendAgendaMenu(whatsAppClient, phone, context);
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }
  }

  // -------------------------------------------------------------
  // PASSO INICIAL: Escolha de tipo de agendamento
  // -------------------------------------------------------------
  if (selectedButtonId === 'agenda_new_patient') {
    updatedData.subType = 'patient';
    await whatsAppClient.sendTextMessage(
      phone,
      `🩺 *Agendamento de Paciente*\n\n` +
      `Por favor, digite o *CPF do Paciente* (apenas números ou formatado):`
    );
    return { handled: true, nextStep: 'agenda_waiting_patient_cpf', updatedStateData: updatedData };
  }

  if (selectedButtonId === 'agenda_new_event' || selectedButtonId === 'agenda_new_meeting') {
    const isMeeting = selectedButtonId === 'agenda_new_meeting';
    updatedData.subType = isMeeting ? 'meeting' : 'event';
    const label = isMeeting ? 'Reunião' : 'Evento';
    await whatsAppClient.sendTextMessage(
      phone,
      `${isMeeting ? '🤝' : '📌'} *Novo(a) ${label}*\n\n` +
      `Por favor, digite o *título ou assunto* deste compromisso:`
    );
    return { handled: true, nextStep: 'agenda_waiting_event_title', updatedStateData: updatedData };
  }

  // -------------------------------------------------------------
  // EVENTO / REUNIÃO: Título
  // -------------------------------------------------------------
  if (currentStep === 'agenda_waiting_event_title') {
    const title = sanitizeMessageInput(trimmedText, 120);
    if (title.length < 2) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ O título deve ter pelo menos 2 caracteres. Por favor, digite novamente:');
      return { handled: true, nextStep: 'agenda_waiting_event_title', updatedStateData: updatedData };
    }
    updatedData.title = title;
    await sendAgendaDateSelectionList(whatsAppClient, phone, 'Data do Compromisso');
    return { handled: true, nextStep: 'agenda_waiting_date', updatedStateData: updatedData };
  }

  // -------------------------------------------------------------
  // PACIENTE: Passo 1 - Busca de CPF
  // -------------------------------------------------------------
  if (currentStep === 'agenda_waiting_patient_cpf') {
    const cleanDigits = trimmedText.replace(/\D/g, '');
    if (cleanDigits.length !== 11) {
      await whatsAppClient.sendTextMessage(
        phone,
        '⚠️ Por favor, informe um CPF válido com 11 dígitos para localizar o paciente na clínica:'
      );
      return { handled: true, nextStep: 'agenda_waiting_patient_cpf', updatedStateData: updatedData };
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('id, name, patient_code, phone')
      .eq('clinic_id', clinicId)
      .eq('cpf', cleanDigits)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!patient) {
      // Paciente não encontrado -> Oferece botão rápido de pré-cadastro
      await whatsAppClient.sendButtonsMessage(
        phone,
        `🔍 *Paciente não encontrado*\n\n` +
        `Não localizamos nenhum paciente com o CPF informado na base da sua clínica.\n\n` +
        `Deseja realizar o cadastro rápido agora com 1 clique?`,
        {
          title: 'Paciente não localizado',
          footer: 'PluriFisio',
          buttons: [
            { id: 'records_quick_patient', label: '⚡ Pré-Cadastro Rápido' },
            { id: 'btn_menu_agenda', label: '📅 Voltar à Agenda' },
          ],
        }
      );
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    updatedData.patientId = patient.id;
    updatedData.patientName = patient.name;
    updatedData.patientCpf = cleanDigits;
    updatedData.title = `Atendimento - ${patient.name}`;

    // Paciente encontrado -> Avança para seleção de data
    const confirmText =
      `✅ *Paciente localizado!*\n\n` +
      `👤 *Nome:* ${patient.name}\n` +
      `🏷️ *Código:* ${patient.patient_code || 'Cadastrado'}\n\n` +
      `Agora, vamos escolher a data do atendimento:`;

    await whatsAppClient.sendTextMessage(phone, confirmText);
    await sendAgendaDateSelectionList(whatsAppClient, phone, 'Data do Atendimento');
    return { handled: true, nextStep: 'agenda_waiting_date', updatedStateData: updatedData };
  }

  // -------------------------------------------------------------
  // PASSO 2: Seleção de Data
  // -------------------------------------------------------------
  if (currentStep === 'agenda_waiting_date' || (selectedButtonId && selectedButtonId.startsWith('agenda_date_'))) {
    let dateIso = '';
    if (selectedButtonId && selectedButtonId.startsWith('agenda_date_')) {
      dateIso = selectedButtonId.replace('agenda_date_', '').trim();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedText)) {
      dateIso = trimmedText;
    } else {
      // Tenta parsing de formato DD/MM/AAAA
      const brDate = trimmedText.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
      if (brDate) {
        const d = String(brDate[1]).padStart(2, '0');
        const m = String(brDate[2]).padStart(2, '0');
        const y = brDate[3] || String(new Date().getFullYear());
        dateIso = `${y}-${m}-${d}`;
      }
    }

    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Data não reconhecida. Por favor, selecione uma das opções da lista de dias.');
      return { handled: true, nextStep: 'agenda_waiting_date', updatedStateData: updatedData };
    }

    const [y, m, d] = dateIso.split('-');
    const dateDisplay = `${d}/${m}`;
    updatedData.dateIso = dateIso;
    updatedData.dateDisplay = dateDisplay;

    // Calcular horários disponíveis com calendar-utils
    const existingMeetings = clinicId
      ? await loadExistingMeetingsForClinicDay(supabase, clinicId, dateIso)
      : [];

    const { availableWindows } = getAvailableWindowsForDay(dateIso, existingMeetings, 30, {
      mode: 'clinic_owner',
      applyThursdayBlock: false,
      applyLunchBlock: false,
      allowWeekends: true,
      bufferMinutes: 0,
    });

    const windowsText = existingMeetings.length === 0
      ? 'Agenda 100% livre! Você pode agendar em qualquer horário (06:00 às 22:00).'
      : formatAvailableWindowsText(availableWindows);

    const promptHorario =
      `📅 *Data Selecionada:* ${dateDisplay} (${dateIso})\n\n` +
      `🕒 *Horários disponíveis nesta data:*\n` +
      `${windowsText}\n\n` +
      `👉 Por favor, *digite o horário desejado* no formato *hh:mm* (ex: 09:30, 13:00, 14:00, 16:30):`;

    await whatsAppClient.sendTextMessage(phone, promptHorario);
    return { handled: true, nextStep: 'agenda_waiting_time', updatedStateData: updatedData };
  }

  // -------------------------------------------------------------
  // PASSO 3: Validação de Horário
  // -------------------------------------------------------------
  if (currentStep === 'agenda_waiting_time') {
    const dateIso = updatedData.dateIso;
    if (!dateIso) {
      await sendAgendaDateSelectionList(whatsAppClient, phone);
      return { handled: true, nextStep: 'agenda_waiting_date', updatedStateData: updatedData };
    }

    const existingMeetings = clinicId
      ? await loadExistingMeetingsForClinicDay(supabase, clinicId, dateIso)
      : [];

    const timeValidation = validateSelectedTime(dateIso, trimmedText, existingMeetings, 30, {
      mode: 'clinic_owner',
      applyThursdayBlock: false,
      applyLunchBlock: false,
      allowWeekends: true,
      bufferMinutes: 0,
    });

    if (!timeValidation.isValid) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ ${timeValidation.errorMessage || 'Horário inválido ou indisponível.'}\n\nPor favor, digite outro horário no formato hh:mm:`
      );
      return { handled: true, nextStep: 'agenda_waiting_time', updatedStateData: updatedData };
    }

    updatedData.time = timeValidation.normalizedTime;

    // Se for Atendimento de Paciente E Plano Clínica (isClinicPlan):
    // Pergunta sobre participação de colaboradores
    if (updatedData.subType === 'patient' && isClinicPlan) {
      await whatsAppClient.sendButtonsMessage(
        phone,
        `👥 *Participação de Colaboradores*\n\n` +
        `Outros colaboradores da clínica irão participar deste atendimento com você?\n\n` +
        `Selecione abaixo ou digite os nomes/contatos:`,
        {
          title: 'Equipe do Atendimento',
          footer: 'Plano Clínica',
          buttons: [
            { id: 'agenda_collab_solo', label: '👤 Apenas Eu' },
            { id: 'agenda_collab_team', label: '👥 Adicionar Equipe' },
          ],
        }
      );
      return { handled: true, nextStep: 'agenda_waiting_collab', updatedStateData: updatedData };
    }

    // Se for Profissional Solo (isSoloPlan) ou Evento/Reunião: Pula diretamente para Confirmação & Gravação!
    updatedData.collaborators = 'Apenas Eu';
    return await executeSaveAgendaEvent(supabase, whatsAppClient, phone, context, updatedData);
  }

  // -------------------------------------------------------------
  // PASSO 4: Colaboradores (Plano Clínica)
  // -------------------------------------------------------------
  if (currentStep === 'agenda_waiting_collab') {
    if (selectedButtonId === 'agenda_collab_solo') {
      updatedData.collaborators = 'Apenas Eu';
      return await executeSaveAgendaEvent(supabase, whatsAppClient, phone, context, updatedData);
    }

    if (selectedButtonId === 'agenda_collab_team') {
      await whatsAppClient.sendTextMessage(
        phone,
        'Por favor, digite o nome ou telefone dos colaboradores que irão participar deste atendimento:'
      );
      return { handled: true, nextStep: 'agenda_waiting_collab_text', updatedStateData: updatedData };
    }

    // Texto digitado diretamente
    updatedData.collaborators = sanitizeMessageInput(trimmedText, 100);
    return await executeSaveAgendaEvent(supabase, whatsAppClient, phone, context, updatedData);
  }

  if (currentStep === 'agenda_waiting_collab_text') {
    updatedData.collaborators = sanitizeMessageInput(trimmedText, 100);
    return await executeSaveAgendaEvent(supabase, whatsAppClient, phone, context, updatedData);
  }

  return { handled: false, nextStep: currentStep, updatedStateData };
}

/**
 * Passo 5: Confirmação & Gravação no Banco (agenda_events + sessions) & Geração de Link GCal
 */
async function executeSaveAgendaEvent(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  data: AgendaStateData
): Promise<{ handled: boolean; nextStep: string; updatedStateData: AgendaStateData }> {
  const { clinicId, userId, userName, clinicName } = context;
  const { subType, dateIso, time, patientId, patientName, title, collaborators } = data;

  if (!dateIso || !time) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Dados de data e horário incompletos. Por favor, reinicie o agendamento.');
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  const duration = data.durationMinutes || (subType === 'patient' ? 50 : 60);
  const scheduledDateUtc = createBrasiliaDate(dateIso, time);
  const scheduledIso = scheduledDateUtc.toISOString();

  const eventTitle = title || (patientName ? `Atendimento: ${patientName}` : 'Compromisso Clínico');
  const eventType = subType === 'patient' ? 'atendimento' : subType === 'meeting' ? 'reuniao' : 'evento';

  // 1. Gravação na tabela agenda_events da clínica
  const { data: insertedEvent, error: insertError } = await supabase
    .from('agenda_events')
    .insert({
      clinic_id: clinicId,
      user_id: userId,
      patient_id: patientId || null,
      event_type: eventType,
      title: eventTitle,
      scheduled_for: scheduledIso,
      duration_minutes: duration,
      status: 'confirmado',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[owner-copilot] Erro ao salvar agenda_events:', insertError);
    await whatsAppClient.sendTextMessage(
      phone,
      `⚠️ Desculpe, não conseguimos gravar o agendamento no momento: ${insertError.message}. Tente novamente.`
    );
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // 2. Se for Atendimento de Paciente, cria também o registro correspondente em sessions
  if (subType === 'patient' && patientId && userId) {
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        clinic_id: clinicId,
        user_id: userId,
        patient_id: patientId,
        scheduled_start_at: scheduledIso,
        session_date: scheduledIso,
        status: 'rascunho',
        notes: collaborators ? `Colaboradores: ${collaborators}` : null,
      });

    if (sessionError) {
      console.warn('[owner-copilot] Aviso ao criar sessão complementar para paciente:', sessionError);
    }
  }

  // 3. Link do Google Calendar
  const gcalUrl = generateGoogleCalendarUrl({
    title: `${eventTitle} - ${clinicName}`,
    details: `Agendado via Copiloto PluriFisio WhatsApp\nProfissional: ${userName}\nColaboradores: ${collaborators || 'Apenas Eu'}`,
    startDate: scheduledDateUtc,
    durationMinutes: duration,
    location: clinicName,
  });

  const appUrl = `https://app.plurifisio.com.br/agenda`;

  const successCard =
    `🎉 *AGENDAMENTO CONFIRMADO!* 📅\n\n` +
    `📌 *Tipo:* ${eventType === 'atendimento' ? '🩺 Atendimento de Paciente' : eventType === 'reuniao' ? '🤝 Reunião' : '📌 Evento'}\n` +
    `📋 *Título:* ${eventTitle}\n` +
    `🗓️ *Data:* ${data.dateDisplay || dateIso}\n` +
    `⏰ *Horário:* ${time} (Duração: ${duration} min)\n` +
    (collaborators ? `👥 *Equipe:* ${collaborators}\n` : '') +
    `🏥 *Clínica:* ${clinicName}\n\n` +
    `🔗 *Adicionar à Google Agenda:* ${gcalUrl}`;

  await whatsAppClient.sendButtonsMessage(phone, successCard, {
    title: 'Agendamento Realizado',
    footer: 'PluriFisio Agenda',
    buttons: [
      { id: 'btn_menu_agenda', label: '📅 Ver Agenda' },
      { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
    ],
  });

  return { handled: true, nextStep: 'initial', updatedStateData: {} };
}

/**
 * 3. Módulo <Agenda Completa> (`agenda_full`):
 * Busca no banco os atendimentos da clínica para hoje e para os próximos 7 dias.
 */
export async function handleAgendaFull(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { clinicId, userName, clinicName } = context;

  if (!clinicId) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Nenhuma clínica vinculada ao seu usuário para consultar a agenda.');
    return;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Consulta eventos futuros ou do dia
  const { data: events, error } = await supabase
    .from('agenda_events')
    .select('id, title, scheduled_for, duration_minutes, status, event_type, patient_id')
    .eq('clinic_id', clinicId)
    .gte('scheduled_for', startOfDay)
    .lte('scheduled_for', next7Days)
    .neq('status', 'cancelado')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[owner-copilot] Erro ao buscar agenda completa:', error);
    await whatsAppClient.sendTextMessage(phone, '⚠️ Ocorreu uma instabilidade ao consultar a agenda da clínica.');
    return;
  }

  const todayIsoPrefix = now.toISOString().slice(0, 10);
  const todayEvents: Array<typeof events[0]> = [];
  const weekEvents: Array<typeof events[0]> = [];

  for (const ev of events || []) {
    const evDateStr = new Date(ev.scheduled_for).toISOString().slice(0, 10);
    if (evDateStr === todayIsoPrefix) {
      todayEvents.push(ev);
    } else {
      weekEvents.push(ev);
    }
  }

  const todayDayMonth = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  let reportText = `📋 *AGENDA DA CLÍNICA (${clinicName})*\n\n`;

  // Resumo de Hoje
  reportText += `📅 *Agenda de Hoje (${todayDayMonth}):*\n`;
  if (todayEvents.length === 0) {
    reportText += `_Nenhum atendimento agendado para hoje._\n\n`;
  } else {
    for (const ev of todayEvents) {
      const minutes = getBrasiliaMinutesOfDay(ev.scheduled_for);
      const timeStr = formatMinutesToTime(minutes);
      const statusIcon = ev.status === 'confirmado' ? '✅' : '⏳';
      reportText += `• *${timeStr}* | ${ev.title} | ${statusIcon} ${ev.status}\n`;
    }
    reportText += `\n`;
  }

  // Resumo Próximos 7 Dias
  reportText += `🗓️ *Próximos dias da semana:*\n`;
  if (weekEvents.length === 0) {
    reportText += `_Nenhum outro compromisso registrado para os próximos 7 dias._\n`;
  } else {
    for (const ev of weekEvents) {
      const d = new Date(ev.scheduled_for);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const minutes = getBrasiliaMinutesOfDay(ev.scheduled_for);
      const timeStr = formatMinutesToTime(minutes);
      reportText += `• *${dateStr} às ${timeStr}* - ${ev.title}\n`;
    }
  }

  await whatsAppClient.sendButtonsMessage(phone, reportText, {
    title: 'Agenda Completa',
    footer: 'PluriFisio',
    buttons: [
      { id: 'agenda_new', label: '⚡ Novo Agendamento' },
      { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
    ],
  });
}

/**
 * 4. Módulo <Próximo Agendamento> (`agenda_next`):
 * Busca o agendamento mais próximo a partir do horário atual (`scheduled_for >= now()`).
 */
export async function handleAgendaNext(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext
): Promise<void> {
  const { clinicId, userName } = context;

  if (!clinicId) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Nenhuma clínica vinculada para consultar o próximo agendamento.');
    return;
  }

  const nowIso = new Date().toISOString();

  // Busca o próximo evento não cancelado a partir de agora
  const { data: event, error } = await supabase
    .from('agenda_events')
    .select('id, title, scheduled_for, duration_minutes, status, event_type, patient_id')
    .eq('clinic_id', clinicId)
    .gte('scheduled_for', nowIso)
    .neq('status', 'cancelado')
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[owner-copilot] Erro ao buscar próximo agendamento:', error);
    await whatsAppClient.sendTextMessage(phone, '⚠️ Ocorreu uma instabilidade ao consultar o próximo agendamento.');
    return;
  }

  // Se não houver:
  if (!event) {
    const emptyMsg =
      `⏰ *Próximo Atendimento*\n\n` +
      `Você não tem nenhum atendimento agendado para as próximas horas.\n\n` +
      `Deseja agendar um novo atendimento agora?`;

    await whatsAppClient.sendButtonsMessage(phone, emptyMsg, {
      title: 'Agenda Livre',
      footer: 'PluriFisio',
      buttons: [
        { id: 'agenda_new', label: '⚡ Novo Agendamento' },
        { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
      ],
    });
    return;
  }

  // Se houver: Busca detalhes do paciente se vinculado
  let patientPhone = 'Não informado';
  let patientName = event.title;

  if (event.patient_id) {
    const { data: pat } = await supabase
      .from('patients')
      .select('name, phone')
      .eq('id', event.patient_id)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (pat) {
      patientName = pat.name;
      if (pat.phone) patientPhone = pat.phone;
    }
  }

  const d = new Date(event.scheduled_for);
  const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const minutes = getBrasiliaMinutesOfDay(event.scheduled_for);
  const timeStr = formatMinutesToTime(minutes);

  const cardText =
    `⏰ *PRÓXIMO AGENDAMENTO* ⏰\n\n` +
    `👤 *Paciente / Título:* ${patientName}\n` +
    `📱 *Contato:* ${patientPhone}\n` +
    `🗓️ *Data:* ${dateStr}\n` +
    `🕒 *Horário:* ${timeStr} (${event.duration_minutes || 60} min)\n` +
    `📊 *Status Atual:* ${event.status.toUpperCase()}\n\n` +
    `Selecione uma ação rápida abaixo para gerenciar ou atualizar este compromisso:`;

  const editRows: WhatsAppListRow[] = [
    {
      id: `appt_edit_date_${event.id}`,
      title: '📅 Alterar Data',
      description: 'Escolher nova data para este agendamento',
    },
    {
      id: `appt_edit_time_${event.id}`,
      title: '🕒 Alterar Horário',
      description: 'Ver horários livres e alterar horário',
    },
  ];

  // Se plano Clínica com Equipe (isClinicPlan), incluir Colaboradores
  if (context.isClinicPlan) {
    editRows.push({
      id: `appt_edit_collab_${event.id}`,
      title: '👥 Colaboradores',
      description: 'Adicionar ou alterar equipe participante',
    });
  }

  editRows.push({
    id: `appt_back_menu_${event.id}`,
    title: '↩️ Voltar',
    description: 'Retornar ao submenu da agenda',
  });

  const sections: WhatsAppListSection[] = [
    {
      title: 'Mudar Status',
      rows: [
        {
          id: `appt_status_confirm_${event.id}`,
          title: '🟢 Confirmar',
          description: 'Atualizar status para confirmado',
        },
        {
          id: `appt_status_cancel_${event.id}`,
          title: '🔴 Cancelar',
          description: 'Desmarcar e liberar o horário',
        },
        {
          id: `appt_status_complete_${event.id}`,
          title: '✅ Concluir',
          description: 'Marcar atendimento como concluído',
        },
        {
          id: `appt_status_awaiting_${event.id}`,
          title: '⏳ Aguardando',
          description: 'Marcar como aguardando confirmação',
        },
        {
          id: `appt_status_delete_${event.id}`,
          title: '🗑️ Excluir',
          description: 'Remover agendamento permanentemente',
        },
      ],
    },
    {
      title: 'Editar Informação',
      rows: editRows,
    },
  ];

  await whatsAppClient.sendListMessage(phone, cardText, 'Ações Rápidas', sections, {
    title: 'Ações Rápidas',
    footer: 'PluriFisio Agenda',
  });
}

export type AppointmentActionType =
  | 'confirm'
  | 'cancel'
  | 'reschedule'
  | 'complete'
  | 'awaiting'
  | 'delete';

/**
 * Ações Rápidas no Atendimento: Confirmar, Cancelar, Concluir, Aguardando, Excluir, Remarcar
 */
export async function handleAppointmentAction(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  action: AppointmentActionType,
  eventId: string
): Promise<{ success: boolean; message?: string }> {
  const { clinicId, userName } = context;

  if (!clinicId) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Clínica não identificada para executar esta ação.');
    return { success: false, message: 'Clínica não identificada' };
  }

  const { data: event, error: fetchErr } = await supabase
    .from('agenda_events')
    .select('id, title, scheduled_for, status, patient_id')
    .eq('id', eventId)
    .eq('clinic_id', clinicId)
    .maybeSingle();

  if (fetchErr || !event) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Agendamento não encontrado ou já expirado.');
    return { success: false, message: 'Agendamento não encontrado' };
  }

  if (action === 'confirm') {
    const { error: updErr } = await supabase
      .from('agenda_events')
      .update({ status: 'confirmado', updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (updErr) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Falha ao atualizar status do agendamento.');
      return { success: false };
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `✅ *Agendamento Confirmado!*\n\nO status do compromisso "*${event.title}*" foi atualizado para *confirmado*.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { success: true };
  }

  if (action === 'complete') {
    const { error: updErr } = await supabase
      .from('agenda_events')
      .update({ status: 'concluido', updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (updErr) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Falha ao concluir o agendamento.');
      return { success: false };
    }

    if (event.patient_id) {
      // Atualiza apenas sessões não canceladas vinculadas à clínica e ao paciente
      await supabase
        .from('sessions')
        .update({ status: 'concluido', updated_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('patient_id', event.patient_id)
        .eq('scheduled_start_at', event.scheduled_for)
        .neq('status', 'cancelado');
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `🏁 *Atendimento Concluído!*\n\nO atendimento "*${event.title}*" foi marcado como *concluído*.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { success: true };
  }

  if (action === 'awaiting') {
    const { error: updErr } = await supabase
      .from('agenda_events')
      .update({ status: 'aguardando_confirmacao', updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (updErr) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Falha ao atualizar status para aguardando confirmação.');
      return { success: false };
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `⏳ *Status Atualizado!*\n\nO compromisso "*${event.title}*" está marcado como *aguardando confirmação*.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { success: true };
  }

  if (action === 'delete') {
    const { error: delErr } = await supabase
      .from('agenda_events')
      .delete()
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (delErr) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Falha ao excluir agendamento.');
      return { success: false };
    }

    // Integridade Clínica e Conformidade Legal CFM 1.821 / LGPD:
    // Nunca cancelar ou deletar sessões finalizadas ou em atendimento que contenham evolução clínica.
    // Apenas marca rascunhos como cancelados, preservando histórico e evitando perda indevida de dados.
    if (event.patient_id) {
      await supabase
        .from('sessions')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('patient_id', event.patient_id)
        .eq('scheduled_start_at', event.scheduled_for)
        .eq('status', 'rascunho');
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `🗑️ *Agendamento Excluído!*\n\nO compromisso "*${event.title}*" foi removido da sua agenda e o horário está livre.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { success: true };
  }

  if (action === 'cancel') {
    const { error: updErr } = await supabase
      .from('agenda_events')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (updErr) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Falha ao cancelar agendamento.');
      return { success: false };
    }

    // Integridade Clínica: cancela somente sessões agendadas ou rascunho, preservando sessões já concluídas
    if (event.patient_id) {
      await supabase
        .from('sessions')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('patient_id', event.patient_id)
        .eq('scheduled_start_at', event.scheduled_for)
        .in('status', ['agendado', 'rascunho', 'pendente']);
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `❌ *Agendamento Cancelado!*\n\nO horário foi desmarcado e está liberado na sua agenda para novos atendimentos.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { success: true };
  }

  if (action === 'reschedule') {
    // Inicia fluxo interativo de remarcação
    await whatsAppClient.sendTextMessage(
      phone,
      `🔄 *Remarcar Atendimento: ${event.title}*\n\nVamos selecionar uma nova data para este compromisso:`
    );
    await sendAgendaDateSelectionList(whatsAppClient, phone, 'Nova Data');
    return { success: true };
  }

  return { success: false };
}

/**
 * 5. Fluxos de Edição de Agendamento Existente:
 * - appt_edit_date_*: Inicia escolha de nova data e atualiza scheduled_for
 * - appt_edit_time_*: Solicita novo horário e atualiza scheduled_for mantendo a data
 * - appt_edit_collab_*: Solicita colaboradores e atualiza agenda_events/sessions
 * - appt_back_menu_*: Retorna para o menu da agenda
 */
export async function handleAppointmentEditFlow(
  supabase: SupabaseClient,
  whatsAppClient: WhatsAppClient,
  phone: string,
  context: OwnerCustomerContext,
  currentStep: string,
  userText: string,
  selectedButtonId: string,
  stateData: AgendaStateData
): Promise<{ handled: boolean; nextStep: string; updatedStateData: AgendaStateData }> {
  const { clinicId } = context;
  if (!clinicId) {
    await whatsAppClient.sendTextMessage(phone, '⚠️ Clínica não identificada para editar este agendamento.');
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }
  const updatedData: AgendaStateData = { ...stateData };
  const trimmedText = userText.trim();
  const hasButtonReply = Boolean(selectedButtonId && selectedButtonId.trim().length > 0);

  // Comandos Globais de Cancelamento / Escape ('cancelar', 'menu', etc.)
  if (!hasButtonReply && trimmedText && isGlobalCancelCommand(trimmedText)) {
    await whatsAppClient.sendButtonsMessage(
      phone,
      'Edição de agendamento cancelada. O que você gostaria de fazer agora?',
      {
        buttons: [
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
          { id: 'btn_owner_menu', label: '🏠 Menu Principal' },
        ],
      }
    );
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // Comandos Globais de Retorno ('voltar', etc.)
  if (!hasButtonReply && trimmedText && isGlobalBackCommand(trimmedText)) {
    await sendAgendaMenu(whatsAppClient, phone, context);
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // A. Ação de retorno: appt_back_menu_*
  if (selectedButtonId && selectedButtonId.startsWith('appt_back_menu_')) {
    await sendAgendaMenu(whatsAppClient, phone, context);
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // B. Início da Edição de Data: appt_edit_date_*
  if (selectedButtonId && selectedButtonId.startsWith('appt_edit_date_')) {
    const eventId = selectedButtonId.replace('appt_edit_date_', '').trim();
    updatedData.editingEventId = eventId;
    updatedData.editingField = 'date';

    await whatsAppClient.sendTextMessage(
      phone,
      `📅 *Alterar Data do Atendimento*\n\nPor favor, escolha a nova data na lista abaixo:`
    );
    await sendAgendaDateSelectionList(whatsAppClient, phone, 'Nova Data');
    return { handled: true, nextStep: 'appt_edit_waiting_date', updatedStateData: updatedData };
  }

  // B1. Resposta de data para edição (appt_edit_waiting_date)
  if (currentStep === 'appt_edit_waiting_date' || (selectedButtonId && selectedButtonId.startsWith('agenda_date_') && stateData.editingField === 'date')) {
    let dateIso = '';
    if (selectedButtonId && selectedButtonId.startsWith('agenda_date_')) {
      dateIso = selectedButtonId.replace('agenda_date_', '').trim();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedText)) {
      dateIso = trimmedText;
    } else {
      const brDate = trimmedText.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
      if (brDate) {
        const d = String(brDate[1]).padStart(2, '0');
        const m = String(brDate[2]).padStart(2, '0');
        const y = brDate[3] || String(new Date().getFullYear());
        dateIso = `${y}-${m}-${d}`;
      }
    }

    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Data não reconhecida. Por favor, selecione uma das opções da lista de dias.');
      return { handled: true, nextStep: 'appt_edit_waiting_date', updatedStateData: updatedData };
    }

    const [y, m, d] = dateIso.split('-');
    const dateDisplay = `${d}/${m}`;
    updatedData.dateIso = dateIso;
    updatedData.dateDisplay = dateDisplay;

    // Se estiver editando apenas a data de um evento existente:
    // Carrega o horário atual do evento para manter se válido, ou solicita confirmação de horário
    const eventId = updatedData.editingEventId;
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('agenda_events')
        .select('id, title, scheduled_for, duration_minutes, patient_id')
        .eq('id', eventId)
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (existingEvent) {
        const prevMinutes = getBrasiliaMinutesOfDay(existingEvent.scheduled_for);
        const prevTimeStr = formatMinutesToTime(prevMinutes);
        const newScheduledDateUtc = createBrasiliaDate(dateIso, prevTimeStr);
        const newScheduledIso = newScheduledDateUtc.toISOString();

        // Atualiza a data no agenda_events mantendo o mesmo horário
        await supabase
          .from('agenda_events')
          .update({
            scheduled_for: newScheduledIso,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId)
          .eq('clinic_id', clinicId);

        // Se houver sessão de paciente vinculada, atualiza também
        if (existingEvent.patient_id) {
          await supabase
            .from('sessions')
            .update({
              scheduled_start_at: newScheduledIso,
              session_date: newScheduledIso,
              updated_at: new Date().toISOString(),
            })
            .eq('clinic_id', clinicId)
            .eq('patient_id', existingEvent.patient_id)
            .eq('scheduled_start_at', existingEvent.scheduled_for);
        }

        await whatsAppClient.sendButtonsMessage(
          phone,
          `✅ *Data Atualizada!*\n\nO compromisso "*${existingEvent.title}*" foi remarcado para *${dateDisplay} às ${prevTimeStr}*.`,
          {
            buttons: [
              { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
              { id: 'btn_menu_agenda', label: '📅 Agenda' },
            ],
          }
        );
        return { handled: true, nextStep: 'initial', updatedStateData: {} };
      }
    }

    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // C. Início da Edição de Horário: appt_edit_time_*
  if (selectedButtonId && selectedButtonId.startsWith('appt_edit_time_')) {
    const eventId = selectedButtonId.replace('appt_edit_time_', '').trim();
    updatedData.editingEventId = eventId;
    updatedData.editingField = 'time';

    const { data: existingEvent } = await supabase
      .from('agenda_events')
      .select('id, title, scheduled_for')
      .eq('id', eventId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!existingEvent) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Agendamento não encontrado.');
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const currentMinutes = getBrasiliaMinutesOfDay(existingEvent.scheduled_for);
    const currentTimeStr = formatMinutesToTime(currentMinutes);
    const dateIso = new Date(existingEvent.scheduled_for).toISOString().slice(0, 10);
    updatedData.dateIso = dateIso;

    // Calcula janelas livres da data atual do compromisso (excluindo o próprio evento em edição)
    const existingMeetings = clinicId
      ? await loadExistingMeetingsForClinicDay(supabase, clinicId, dateIso, eventId)
      : [];

    const { availableWindows } = getAvailableWindowsForDay(dateIso, existingMeetings, 30, {
      mode: 'clinic_owner',
      applyThursdayBlock: false,
      applyLunchBlock: false,
      allowWeekends: true,
      bufferMinutes: 0,
    });

    const windowsText = existingMeetings.length === 0
      ? 'Agenda 100% livre! Você pode agendar em qualquer horário (06:00 às 22:00).'
      : formatAvailableWindowsText(availableWindows);

    await whatsAppClient.sendTextMessage(
      phone,
      `🕒 *Alterar Horário do Atendimento*\n\n` +
      `Compromisso: *${existingEvent.title}*\n` +
      `Horário atual: *${currentTimeStr}*\n\n` +
      `*Janelas livres nesta data:*\n` +
      `${windowsText}\n\n` +
      `👉 Por favor, digite o *novo horário* desejado no formato *hh:mm* (ex: 10:00, 13:00, 14:30):`
    );
    return { handled: true, nextStep: 'appt_edit_waiting_time', updatedStateData: updatedData };
  }

  // C1. Resposta de horário para edição (appt_edit_waiting_time)
  if (currentStep === 'appt_edit_waiting_time') {
    const eventId = updatedData.editingEventId;
    if (!eventId) {
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const { data: existingEvent } = await supabase
      .from('agenda_events')
      .select('id, title, scheduled_for, patient_id')
      .eq('id', eventId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!existingEvent) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Agendamento não encontrado.');
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const d = new Date(existingEvent.scheduled_for);
    const dateIso = d.toISOString().slice(0, 10);

    const existingMeetings = clinicId
      ? await loadExistingMeetingsForClinicDay(supabase, clinicId, dateIso, eventId)
      : [];

    const timeValidation = validateSelectedTime(dateIso, trimmedText, existingMeetings, 30, {
      mode: 'clinic_owner',
      applyThursdayBlock: false,
      applyLunchBlock: false,
      allowWeekends: true,
      bufferMinutes: 0,
    });

    if (!timeValidation.isValid) {
      await whatsAppClient.sendTextMessage(
        phone,
        `⚠️ ${timeValidation.errorMessage || 'Horário inválido ou indisponível.'}\n\nPor favor, digite outro horário no formato hh:mm:`
      );
      return { handled: true, nextStep: 'appt_edit_waiting_time', updatedStateData: updatedData };
    }

    const newTimeStr = timeValidation.normalizedTime;
    const newScheduledDateUtc = createBrasiliaDate(dateIso, newTimeStr);
    const newScheduledIso = newScheduledDateUtc.toISOString();

    await supabase
      .from('agenda_events')
      .update({
        scheduled_for: newScheduledIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('clinic_id', clinicId);

    if (existingEvent.patient_id) {
      await supabase
        .from('sessions')
        .update({
          scheduled_start_at: newScheduledIso,
          session_date: newScheduledIso,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', existingEvent.patient_id)
        .eq('scheduled_start_at', existingEvent.scheduled_for);
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `✅ *Horário Atualizado!*\n\nO atendimento "*${existingEvent.title}*" foi alterado para *${newTimeStr}*.`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  // D. Início da Edição de Colaboradores: appt_edit_collab_*
  if (selectedButtonId && selectedButtonId.startsWith('appt_edit_collab_')) {
    // Governança de Planos: Gestão de múltiplos colaboradores é recurso exclusivo do Plano Clínica
    if (!context.isClinicPlan) {
      await whatsAppClient.sendTextMessage(
        phone,
        '⚠️ A gestão de múltiplos colaboradores na equipe é exclusiva do *Plano Clínica*.\n\nPara fazer upgrade ou saber mais, acesse o painel web: https://app.plurifisio.com.br'
      );
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const eventId = selectedButtonId.replace('appt_edit_collab_', '').trim();
    updatedData.editingEventId = eventId;
    updatedData.editingField = 'collaborators';

    await whatsAppClient.sendTextMessage(
      phone,
      `👥 *Atualizar Colaboradores da Equipe*\n\n` +
      `Por favor, digite o nome ou telefone dos colaboradores que irão participar deste atendimento:`
    );
    return { handled: true, nextStep: 'appt_edit_waiting_collab', updatedStateData: updatedData };
  }

  // D1. Resposta de colaboradores para edição (appt_edit_waiting_collab)
  if (currentStep === 'appt_edit_waiting_collab') {
    // Governança de Planos: Fail-safe caso receba input de colaboração em plano Solo
    if (!context.isClinicPlan) {
      await whatsAppClient.sendTextMessage(
        phone,
        '⚠️ A gestão de múltiplos colaboradores na equipe é exclusiva do *Plano Clínica*.'
      );
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const eventId = updatedData.editingEventId;
    if (!eventId) {
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const { data: existingEvent } = await supabase
      .from('agenda_events')
      .select('id, title, scheduled_for, patient_id')
      .eq('id', eventId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!existingEvent) {
      await whatsAppClient.sendTextMessage(phone, '⚠️ Agendamento não encontrado.');
      return { handled: true, nextStep: 'initial', updatedStateData: {} };
    }

    const collabs = sanitizeMessageInput(trimmedText, 100);

    // Atualiza notas da sessão associada se houver paciente, isolada estritamente por clinic_id
    if (existingEvent.patient_id) {
      await supabase
        .from('sessions')
        .update({
          notes: collabs ? `Colaboradores: ${collabs}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', existingEvent.patient_id)
        .eq('scheduled_start_at', existingEvent.scheduled_for);
    }

    await whatsAppClient.sendButtonsMessage(
      phone,
      `✅ *Equipe Atualizada!*\n\nOs colaboradores do atendimento "*${existingEvent.title}*" foram atualizados para:\n*${collabs}*`,
      {
        buttons: [
          { id: 'agenda_next', label: '⏰ Próximo Agendamento' },
          { id: 'btn_menu_agenda', label: '📅 Agenda' },
        ],
      }
    );
    return { handled: true, nextStep: 'initial', updatedStateData: {} };
  }

  return { handled: false, nextStep: currentStep, updatedStateData };
}

/**
 * Helper de roteamento: detecta se a mensagem de texto ou botão é um gatilho para o Menu Principal do Titular.
 */
export function isOwnerMenuTriggerCommand(textOrButtonId?: string | null): boolean {
  if (!textOrButtonId) return false;
  const lower = textOrButtonId.trim().toLowerCase();
  return (
    lower === 'btn_owner_menu' ||
    lower === 'menu' ||
    lower === 'ajuda' ||
    lower === 'opcoes' ||
    lower === 'opções' ||
    lower === 'iniciar' ||
    lower === 'ola' ||
    lower === 'olá' ||
    lower === 'oi'
  );
}

/**
 * Função de resolução e reconhecimento de contexto do cliente/profissional no webhook,
 * incluindo detecção de Titular Mestre através do WhatsApp comercial oficial,
 * variantes de telefone brasileiro e fallback gracioso de clínica.
 */
export async function resolveCustomerContext(
  supabase: any,
  whatsAppClient: WhatsAppClient,
  phone: string,
  pushName?: string,
  session?: { user_id?: string | null; clinic_id?: string | null } | null
): Promise<OwnerCustomerContext> {
  let userId = session?.user_id || null;
  let clinicId: string | null = session?.clinic_id || null;
  let userName = sanitizeMessageInput(pushName, 100) || 'Doutor(a)';
  let userEmail = 'Não cadastrado';
  let clinicName = 'Consultório Solo';
  let planName = 'Teste Gratuito (7 dias)';
  let professionInfo = 'Não informada';
  let isOwnerOrAdmin = false;
  let activeRole = 'guest';

  const isMasterCommercial = whatsAppClient.isAdminCommercialPhone(phone);
  if (isMasterCommercial) {
    isOwnerOrAdmin = true;
    activeRole = 'platform_admin';
  }

  // Geração abrangente de variantes numéricas e com máscara para busca no Brasil
  const digitsOnly = phone.replace(/\D/g, '');
  const nationalPhone = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;
  const last8Digits = digitsOnly.length >= 8 ? digitsOnly.slice(-8) : digitsOnly;

  const phoneVariants = new Set<string>();
  if (phone) phoneVariants.add(phone);
  if (digitsOnly) phoneVariants.add(digitsOnly);
  if (nationalPhone) phoneVariants.add(nationalPhone);

  if (nationalPhone.length === 11 && nationalPhone.charAt(2) === '9') {
    const ddd = nationalPhone.slice(0, 2);
    const numWithout9 = ddd + nationalPhone.slice(3); // 10 dígitos (sem o 9º)
    phoneVariants.add(numWithout9);
    phoneVariants.add(`55${numWithout9}`);
    phoneVariants.add(`+55${nationalPhone}`);
    phoneVariants.add(`+55${numWithout9}`);
    const p1 = nationalPhone.slice(2, 7);
    const p2 = nationalPhone.slice(7);
    phoneVariants.add(`(${ddd}) ${nationalPhone.slice(2, 7)}-${p2}`);
    phoneVariants.add(`(${ddd}) ${nationalPhone.slice(2)}`);
    phoneVariants.add(`+55 (${ddd}) ${p1}-${p2}`);
    phoneVariants.add(`+55 ${ddd} ${p1}-${p2}`);
    phoneVariants.add(`+55 ${ddd} ${nationalPhone.slice(2)}`);
  } else if (nationalPhone.length === 10) {
    const ddd = nationalPhone.slice(0, 2);
    const numWith9 = ddd + '9' + nationalPhone.slice(2); // 11 dígitos
    phoneVariants.add(numWith9);
    phoneVariants.add(`55${numWith9}`);
    phoneVariants.add(`+55${nationalPhone}`);
    phoneVariants.add(`+55${numWith9}`);
    const p1 = nationalPhone.slice(2, 6);
    const p2 = nationalPhone.slice(6);
    phoneVariants.add(`(${ddd}) ${p1}-${p2}`);
    phoneVariants.add(`+55 (${ddd}) ${p1}-${p2}`);
    phoneVariants.add(`+55 ${ddd} ${p1}-${p2}`);
  }

  let profileData: any = null;

  if (userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, profession, council_name, professional_license')
      .eq('id', userId)
      .maybeSingle();
    profileData = data;
  }

  if (!profileData && phoneVariants.size > 0) {
    const variantsList = Array.from(phoneVariants);
    const inClause = `(${variantsList.map((v) => `"${v.replace(/"/g, '')}"`).join(',')})`;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, profession, council_name, professional_license')
      .filter('phone', 'in', inClause)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    profileData = data;
  }

  if (!profileData && last8Digits.length >= 8) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, profession, council_name, professional_license')
      .ilike('phone', `%${last8Digits}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    profileData = data;
  }

  if (!profileData && isMasterCommercial) {
    const { data: firstAdmin } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstAdmin?.user_id) {
      const { data: adminProf } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, profession, council_name, professional_license')
        .eq('id', firstAdmin.user_id)
        .maybeSingle();
      if (adminProf) {
        profileData = adminProf;
      }
    }
  }

  if (profileData) {
    userId = profileData.id;
    if (profileData.full_name) userName = sanitizeMessageInput(profileData.full_name, 100);
    if (profileData.email) userEmail = sanitizeMessageInput(profileData.email, 150);

    const profParts = [profileData.profession, profileData.council_name, profileData.professional_license]
      .filter(Boolean)
      .map((p: unknown) => String(p).trim());
    if (profParts.length > 0) {
      professionInfo = sanitizeMessageInput(profParts.join(' - '), 150);
    }

    // 1. Checar se é platform_admin
    const { data: adminRecord } = await supabase
      .from('platform_admins')
      .select('id, is_active')
      .eq('user_id', profileData.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminRecord || isMasterCommercial) {
      isOwnerOrAdmin = true;
      activeRole = 'platform_admin';
    }

    // 2. Checar clinic_memberships (operational_role = 'owner')
    const { data: memberships } = await supabase
      .from('clinic_memberships')
      .select('id, clinic_id, operational_role, role_key, is_active')
      .eq('user_id', profileData.id)
      .eq('is_active', true);

    const ownerMembership = (memberships || []).find(
      (m: any) => m.operational_role === 'owner' || m.role_key === 'owner'
    );

    if (ownerMembership) {
      isOwnerOrAdmin = true;
      if (activeRole !== 'platform_admin') activeRole = 'owner';
      clinicId = ownerMembership.clinic_id;
    } else if (!isOwnerOrAdmin && memberships && memberships.length > 0) {
      activeRole = memberships[0].operational_role || memberships[0].role_key || 'member';
      clinicId = memberships[0].clinic_id;
    }

    // 3. Checar se é titular direto na tabela clinics (account_owner_user_id)
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name, subscription_plan')
      .eq('account_owner_user_id', profileData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clinic) {
      isOwnerOrAdmin = true;
      if (activeRole !== 'platform_admin') activeRole = 'owner';
      clinicId = clinic.id;
      if (clinic.name) clinicName = sanitizeMessageInput(clinic.name, 100);
      if (clinic.subscription_plan) planName = sanitizeMessageInput(clinic.subscription_plan, 80);
    } else if (clinicId) {
      const { data: foundClinic } = await supabase
        .from('clinics')
        .select('id, name, subscription_plan')
        .eq('id', clinicId)
        .maybeSingle();
      if (foundClinic) {
        if (foundClinic.name) clinicName = sanitizeMessageInput(foundClinic.name, 100);
        if (foundClinic.subscription_plan) planName = sanitizeMessageInput(foundClinic.subscription_plan, 80);
      }
    }
  }

  // Fallback gracioso de clínica para o platform_admin caso não tenha clínica vinculada diretamente
  if ((isMasterCommercial || activeRole === 'platform_admin') && !clinicId) {
    const { data: defaultClinic } = await supabase
      .from('clinics')
      .select('id, name, subscription_plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (defaultClinic) {
      clinicId = defaultClinic.id;
      if (defaultClinic.name) clinicName = sanitizeMessageInput(defaultClinic.name, 100);
      if (defaultClinic.subscription_plan) planName = sanitizeMessageInput(defaultClinic.subscription_plan, 80);
    }
  }

  // 4. Buscar plano mais recente em clinic_subscriptions
  if (clinicId) {
    const { data: subData } = await supabase
      .from('clinic_subscriptions')
      .select('plan_type, status, total_recurring_monthly_price')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subData?.plan_type) {
      planName = sanitizeMessageInput(subData.plan_type, 80);
    }
  }

  // 5. Garantia final para admin comercial oficial
  if (isMasterCommercial) {
    isOwnerOrAdmin = true;
    activeRole = 'platform_admin';
    if (!userName || userName === 'Doutor(a)') {
      userName = 'Administrador Master';
    }
  }

  const planLower = planName.toLowerCase();
  const isSoloPlan =
    planLower === 'prof_basico' ||
    planLower === 'prof_medio' ||
    planLower === 'prof_top' ||
    planLower.includes('solo') ||
    planLower.includes('prof');
  const isClinicPlan = !isSoloPlan;

  return {
    userId,
    clinicId,
    userName,
    userEmail,
    clinicName,
    planName,
    professionInfo,
    isOwnerOrAdmin,
    isSoloPlan,
    isClinicPlan,
    activeRole,
  };
}
