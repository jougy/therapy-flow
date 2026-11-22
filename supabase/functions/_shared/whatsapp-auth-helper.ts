// supabase/functions/_shared/whatsapp-auth-helper.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { WhatsAppClient } from './whatsapp-client.ts';
import { verifyTotpCode } from './totp-utils.ts';

export const TUTORIAL_ENTE_AUTH_NO_2FA =
  `👋 *Bem-vindo ao Copiloto WhatsApp PluriFisio!*\n\n` +
  `O acesso ao bot é direto e reconhece automaticamente o número de celular cadastrado na sua conta.\n\n` +
  `🔒 *Dica de Privacidade:* Para garantir a segurança dos dados dos seus pacientes no seu aparelho, recomendamos ativar a opção *Trancar Conversa* (Chat Lock com biometria/FaceID) nas configurações deste contato no WhatsApp.\n\n` +
  `👉 Digite *menu* ou *entrar* para começar!`;

export const TUTORIAL_ENTE_AUTH_HOW_TO_USE =
  `💡 *Comandos do WhatsApp Bot PluriFisio*\n\n` +
  `• *menu* ou *entrar*: Abre o menu principal de gestão.\n` +
  `• *agenda*: Exibe seus agendamentos e horários.\n` +
  `• *prontuario*: Acessa termos e fichas clínicas com links seguros.\n` +
  `• *trocar clinica*: Alterna a clínica ativa caso atue em mais de uma.\n` +
  `• *sair*: Encerra a sessão ativa neste WhatsApp.\n\n` +
  `🔒 *Privacidade:* No WhatsApp, toque no nome do contato e ative *Trancar Conversa* para bloquear o acesso por terceiros.`;

export const TUTORIAL_ACCOUNT_NOT_FOUND =
  `⚠️ *Conta não encontrada com este número de celular.*\n\n` +
  `Não localizamos nenhum usuário ou profissional cadastrado com este número no Pluri-Health.\n\n` +
  `📋 *Como habilitar o acesso ao WhatsApp Bot:*\n` +
  `1. Faça login na plataforma web: https://app.plurifisio.com.br\n` +
  `2. Vá em *Configurações Pessoais* (ícone de perfil > Perfil Pessoal).\n` +
  `3. Certifique-se de que o seu número de celular com DDD está cadastrado no campo *Telefone / Celular*.\n` +
  `4. Salve as alterações e volte aqui no WhatsApp enviando um *Oi* ou *entrar*!\n\n` +
  `Se você ainda não possui uma conta, crie a sua gratuitamente em https://app.plurifisio.com.br/cadastro`;

/**
 * Checa se uma sessão está autenticada e dentro da janela de validade (5 horas)
 */
export function isSessionAuthenticated(session: Record<string, unknown> | null): boolean {
  if (!session || !session.is_authenticated) return false;
  if (!session.auth_expires_at) return false;
  const expiresAt = new Date(session.auth_expires_at as string).getTime();
  return Date.now() < expiresAt;
}

/**
 * Calcula novo timestamp de expiração após 5 horas de inatividade
 */
export function getNewAuthExpiresAt(): string {
  const fiveHoursMs = 5 * 60 * 60 * 1000;
  return new Date(Date.now() + fiveHoursMs).toISOString();
}
