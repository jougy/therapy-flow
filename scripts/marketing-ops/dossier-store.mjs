#!/usr/bin/env node
/**
 * Repositório local de dossiês vivos de clientes (.local-data/conversion-brain/dossiers/<lead_id>.md).
 * Atualiza perfil, maturidade, automação WhatsApp (uses_auto_reply), plano recomendado e histórico.
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_DOSSIERS_DIR = path.resolve(process.cwd(), '.local-data/conversion-brain/dossiers');

function sanitizeLeadFileId(rawId) {
  return String(rawId || 'lead-sem-id').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

function maskPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 8) return digits || 'não informado';
  return `+${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

function extractExistingTimeline(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const marker = '## 6. Linha do Tempo & Próximo Passo';
  const idx = raw.indexOf(marker);
  if (idx === -1) return [];
  return raw
    .slice(idx + marker.length)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.startsWith('- ['));
}

export function writeOrUpdateLeadDossier(lead, context = {}, baseDir = DEFAULT_DOSSIERS_DIR) {
  fs.mkdirSync(baseDir, { recursive: true });
  const fileName = `${sanitizeLeadFileId(lead.id)}.md`;
  const filePath = path.join(baseDir, fileName);

  const existingTimeline = extractExistingTimeline(filePath);
  const nowIso = new Date().toISOString();
  const eventNote = context.timelineEvent
    ? `- [${nowIso}] ${String(context.timelineEvent).trim()}`
    : `- [${nowIso}] Dossiê atualizado (${context.status || 'preparado'})`;

  const dedupedTimeline = [...existingTimeline, eventNote].slice(-25);

  const displayName = lead.full_name || lead.clinic_name || 'Profissional / Clínica';
  const clinicName = lead.clinic_name || 'Atendimento individual';
  const originLabel = context.originLabel || lead.source_platform || 'Prospecção';
  const maturityLabel = context.maturityLabel || context.maturityStage || 'Em análise';
  const archetypeLabel = context.personalityLabel || context.personalityArchetype || 'Relacional / Atendimento Próximo';
  const pacing = context.personalityPacing || 'Natural, humano e simpático, sem perder o profissionalismo.';

  const usesAutoReply = Boolean(context.usesAutoReply);
  const autoReplySample = context.autoReplySample ? String(context.autoReplySample).replace(/\s+/g, ' ').slice(0, 200) : '—';
  const plan = context.recommendedPlan || {};
  const planPriceLine = plan.annualMonthlyPrice
    ? `R$ ${plan.annualMonthlyPrice}/mês (anual) · R$ ${plan.quarterlyMonthlyPrice}/mês (trimestral) · R$ ${plan.monthlyPrice}/mês (mensal) + 5% OFF PIX`
    : 'Sob consulta';

  const nextAction =
    context.nextAction ||
    (usesAutoReply
      ? 'Pausar resposta automática do robô; aguardar retorno humano ou tentar contato em janela alternada se estratégico.'
      : 'Aguardar aprovação do lote para liberar abertura consultiva no orquestrador sequencial.');

  const markdown = [
    `# Dossiê Vivo — ${displayName}`,
    '',
    `- **Lead ID:** \`${lead.id}\``,
    `- **Atualizado em:** ${nowIso}`,
    `- **Status Sequencial:** \`${context.status || 'pending_approval'}\``,
    '',
    '## 1. Identificação & Origem',
    `- **Nome:** ${displayName}`,
    `- **Clínica / Marca:** ${clinicName}`,
    `- **Cidade:** ${lead.city || 'Não informada'}`,
    `- **WhatsApp:** ${maskPhone(lead.phone || context.phoneE164 || '')}`,
    `- **Canal de Origem:** ${originLabel}`,
    `- **Link Original:** ${lead.source_post_url || lead.website_url || '—'}`,
    '',
    '## 2. Perfil, Estágio de Maturidade & Personalidade',
    `- **ICP Tier:** \`${lead.icp_tier || 'solo_physio'}\``,
    `- **Estágio de Maturidade:** ${maturityLabel}`,
    `- **Arquétipo:** ${archetypeLabel}`,
    `- **Ritmo & Tom:** ${pacing}`,
    `- **Gancho / Dor Detectada:** ${context.contentHook || lead.source_post_excerpt || 'Organização clínica geral'}`,
    '',
    '## 3. Status de Automação no WhatsApp',
    `- **Usa Auto-Resposta Business / Ausência:** ${usesAutoReply ? 'SIM (`uses_auto_reply = true`)' : 'Não detectado'}`,
    `- **Última Amostra Detectada:** ${autoReplySample}`,
    '',
    '## 4. Plano Oficial Recomendado (Pluri Fisio)',
    `- **Plano Indicado:** **${plan.planName || 'Profissional Básico'}** (\`${plan.planId || 'prof_basico'}\`)`,
    `- **Investimento Oficial:** ${planPriceLine}`,
    `- **Justificativa:** ${plan.reason || 'Melhor encaixe custo-benefício para o estágio atual.'}`,
    `- **URL Direta:** ${plan.checkoutUrl || 'https://pluri.health/auth/cadastro?plan=prof_basico&cycle=annual'}`,
    `- **Oferta Obrigatória:** Teste Gratuito de 7 dias (${plan.trialUrl || 'https://pluri.health/auth/cadastro?trial=true'}) + Consultoria gratuita de personalização + Oferta de Lançamento (cupom de 1º mês grátis nos planos anuais).`,
    '',
    '## 5. Estratégia & Abertura Personalizada',
    `- **Estratégia Super-Conversor (80/20):** ${context.strategyShortLabel || context.strategyId || 'S2 • Diagnóstico Consultivo'}`,
    `- **Saudação Segura:** ${context.safeGreeting || 'Olá, tudo bem?'}`,
    '- **Mensagem de Abertura Preparada:**',
    `> ${String(context.openingMessage || '').replace(/\n/g, '\n> ')}`,
    '',
    '## 6. Linha do Tempo & Próximo Passo',
    ...dedupedTimeline,
    `- **Próxima Ação Recomendada:** ${nextAction}`,
    '',
  ].join('\n');

  fs.writeFileSync(filePath, markdown, 'utf8');
  return { filePath, fileName };
}

export function buildLeadMetadataPatch(existingMeta = {}, dossierSummary = {}) {
  const base = existingMeta && typeof existingMeta === 'object' && !Array.isArray(existingMeta) ? { ...existingMeta } : {};
  return {
    ...base,
    ...(dossierSummary.maturityStage ? { maturity_stage: dossierSummary.maturityStage } : {}),
    ...(dossierSummary.recommendedPlan
      ? {
          recommended_plan: {
            planId: dossierSummary.recommendedPlan.planId,
            planName: dossierSummary.recommendedPlan.planName,
            annualMonthlyPrice: dossierSummary.recommendedPlan.annualMonthlyPrice,
            reason: dossierSummary.recommendedPlan.reason,
          },
        }
      : {}),
    ...(dossierSummary.usesAutoReply !== undefined
      ? {
          whatsapp_profile: {
            ...(base.whatsapp_profile || {}),
            uses_auto_reply: Boolean(dossierSummary.usesAutoReply),
            ...(dossierSummary.autoReplyDetectedAt ? { detected_at: dossierSummary.autoReplyDetectedAt } : {}),
            ...(dossierSummary.autoReplySample ? { sample: String(dossierSummary.autoReplySample).slice(0, 180) } : {}),
          },
        }
      : {}),
    ...(dossierSummary.dossierFile ? { dossier_file: dossierSummary.dossierFile } : {}),
  };
}
