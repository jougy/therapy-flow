#!/usr/bin/env node
/**
 * Prompt Synthesizer & Error Summarizer
 * 
 * Conecta com LLMs gratuitas locais (Ollama com gemma4:cloud ou OpenCode com mimo)
 * para transformar erros brutos de desenvolvimento em um parágrafo cirúrgico de prompt
 * pronto para o agente de IA resolver com o mínimo de consumo de tokens.
 * 
 * Possui fallback determinístico local caso nenhuma LLM local esteja respondendo.
 */

import http from 'http';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:cloud';

const OPENCODE_HOST = process.env.OPENCODE_HOST || '127.0.0.1';
const OPENCODE_PORT = process.env.OPENCODE_PORT || 3000;
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'mimo';

/**
 * Faz requisição HTTP rápida com timeout estrito
 */
function postJson(host, port, path, payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: host,
        port: port,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              resolve({ raw: body });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 100)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

/**
 * Tenta sintetizar via Ollama (gemma4)
 */
async function tryOllama(prompt) {
  const payload = {
    model: OLLAMA_MODEL,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 120, // Resposta curta para economizar processamento
    },
  };
  const res = await postJson(OLLAMA_HOST, OLLAMA_PORT, '/api/generate', payload);
  return res.response?.trim();
}

/**
 * Tenta sintetizar via OpenCode / endpoint OpenAI compatível (mimo)
 */
async function tryOpenCode(prompt) {
  const payload = {
    model: OPENCODE_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Você é um gerador de instruções técnicas ultra-conciso. Analise o erro fornecido e gere exatamente 1 a 2 frases instruindo um desenvolvedor sobre: (1) O arquivo e linha exatos; (2) A causa do erro; (3) O código correto a aplicar. Seja direto e sem saudações.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 120,
    temperature: 0.1,
  };
  const res = await postJson(OPENCODE_HOST, OPENCODE_PORT, '/v1/chat/completions', payload);
  return res.choices?.[0]?.message?.content?.trim();
}

/**
 * Fallback heurístico determinístico quando offline
 */
function deterministicFallback(type, details) {
  if (type === 'lint') {
    const first = details.errors?.[0] || {};
    return `⚠️ **Correção ESLint Necessária:** No arquivo \`${first.file || 'desconhecido'}\` linha \`${first.line || '?'}\`: ${first.message || 'Erro de sintaxe/tipagem'}. Regra violada: \`${first.ruleId || 'syntax'}\`. Corrija a tipagem/import para prosseguir.`;
  }
  if (type === 'supabase') {
    return `⚠️ **Correção Supabase Necessária:** ${details.message || 'Inconsistência de schema/migração detectada'}. Verifique se migrations incrementais foram sincronizadas com o SSOT em \`supabase/schema.sql\` e se RPCs não possuem overload no schema \`public\`.`;
  }
  if (type === 'responsive') {
    return `⚠️ **Correção Mobile First Necessária:** Detectado elemento extrapolando tela em 390px no componente \`${details.selector || 'layout'}\` (+${details.excess || 0}px). Adicione \`w-full max-w-full min-w-0 overflow-x-hidden\` ou encapsule tabela com \`overflow-x-auto touch-pan-x\`.`;
  }
  return `⚠️ **Problema Detectado:** ${JSON.stringify(details).slice(0, 150)}`;
}

/**
 * Função principal exportável
 */
export async function synthesizeActionPrompt(type, details) {
  const systemContext = `Contexto: Projeto Pluri-Health (React, Tailwind CSS, Supabase, TypeScript).
Erro detectado do tipo: ${type}.
Detalhes brutos do erro:
${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}

Instrução: Gere um único parágrafo conciso em Markdown direcionado a um agente de código Gemini. Diga exatamente qual arquivo alterar, a causa do erro e como corrigir. Máximo 3 linhas. Sem saudações.`;

  // 1. Tenta Ollama (gemma4)
  try {
    const summary = await tryOllama(systemContext);
    if (summary) return `🤖 **Diagnóstico Automático (Gemma4):**\n${summary}`;
  } catch (e) {
    // Ollama indisponível ou offline
  }

  // 2. Tenta OpenCode (mimo)
  try {
    const summary = await tryOpenCode(systemContext);
    if (summary) return `🤖 **Diagnóstico Automático (Mimo):**\n${summary}`;
  } catch (e) {
    // OpenCode indisponível ou offline
  }

  // 3. Fallback determinístico instantâneo
  return deterministicFallback(type, details);
}

// Execução via CLI direta para testes
if (process.argv[1]?.endsWith('prompt-synthesizer.mjs')) {
  const isTest = process.argv.includes('--test');
  if (isTest) {
    console.log('Testando conexões com LLMs locais...');
    synthesizeActionPrompt('lint', {
      errors: [
        {
          file: 'src/pages/PacienteDetalhe.tsx',
          line: 42,
          ruleId: '@typescript-eslint/no-unused-vars',
          message: "'clinicId' is defined but never used",
        },
      ],
    }).then((res) => console.log('\nResultado do Diagnóstico:\n' + res));
  }
}
