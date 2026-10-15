// supabase/functions/_shared/whatsapp-auth-helper.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { WhatsAppClient } from './whatsapp-client.ts';
import { verifyTotpCode } from './totp-utils.ts';

export const TUTORIAL_ENTE_AUTH_NO_2FA =
  `🔐 *Como ativar o Acesso Seguro no WhatsApp (2FA / Ente Auth)*\n\n` +
  `Para sua segurança e privacidade dos dados clínicos, o acesso ao bot de WhatsApp exige a confirmação por código de 2 fatores (2FA).\n\n` +
  `📱 *Passo 1: Baixe o aplicativo Ente Auth*\n` +
  `• *Android (Play Store):* https://play.google.com/store/apps/details?id=io.ente.auth\n` +
  `• *iPhone / iPad (App Store):* https://apps.apple.com/app/ente-authenticator/id6444121398\n` +
  `• *Computador / Web:* https://ente.io/auth/\n\n` +
  `⚙️ *Passo 2: Ative nas Configurações da sua Conta*\n` +
  `1. Acesse o sistema pelo navegador: https://app.plurifisio.com.br\n` +
  `2. Clique na sua foto de perfil ou nome no canto superior e vá em *Configurações* > *Segurança Pessoal*.\n` +
  `3. Na seção *Autenticação em Dois Fatores (2FA) & WhatsApp*, clique em *Ativar 2FA*.\n` +
  `4. Abra o Ente Auth no celular, toque no botão *(+)* e aponte a câmera para o QR Code na tela do computador.\n` +
  `5. Digite o código de 6 dígitos que apareceu no aplicativo para confirmar a ativação.\n\n` +
  `✅ *Pronto!* Depois de ativar na plataforma web, volte aqui e digite *login* ou *entrar*.`;

export const TUTORIAL_ENTE_AUTH_HOW_TO_USE =
  `💡 *Tutorial: Como pegar o código no Ente Auth*\n\n` +
  `1. Abra o aplicativo *Ente Auth* no seu celular.\n` +
  `2. Procure o item *Pluri-Health* ou *PluriFisio* na lista de códigos.\n` +
  `3. Você verá um código numérico de 6 dígitos (ex: 123456) com um círculo que gira indicando o tempo restante.\n` +
  `4. Envie esse código de 6 dígitos aqui no WhatsApp antes que o tempo acabe (o código muda a cada 30 segundos).\n\n` +
  `👉 Se precisar de ajuda para configurar pela primeira vez, digite *configurar*.`;

export const TUTORIAL_ACCOUNT_NOT_FOUND =
  `⚠️ *Conta não encontrada com este número de celular.*\n\n` +
  `Não localizamos nenhum usuário ou profissional cadastrado com este número no Pluri-Health.\n\n` +
  `📋 *Como habilitar o acesso ao WhatsApp Bot:*\n` +
  `1. Faça login na plataforma web: https://app.plurifisio.com.br\n` +
  `2. Vá em *Configurações Pessoais* (ícone de perfil > Perfil Pessoal).\n` +
  `3. Certifique-se de que o seu número de celular com DDD está cadastrado no campo *Telefone / Celular*.\n` +
  `4. Em seguida, acesse a aba *Segurança Pessoal* e ative a *Autenticação em Dois Fatores (2FA)* com o app Ente Auth.\n` +
  `5. Depois de salvar, volte aqui no WhatsApp e digite *entrar* ou *login*!\n\n` +
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
