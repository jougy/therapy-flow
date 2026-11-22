import { describe, expect, it } from "vitest";
import { resolveSpintax } from "./antiBanEngine";
import {
  buildLocalExtractiveCompaction,
  computeZapDefenderReport,
  evaluateKeywordTriggers,
  interpolateDynamicVars,
  parseCsvOrTxtContacts,
  selectWeightedChipInstance,
  shouldCompactContext,
  splitHumanizedBalloons,
} from "./zapSuiteEngine";
import { resolveEffectiveAgentLlm } from "./llmHarnessStorage";
import {
  DEFAULT_DEVICE_LLM_HARNESS,
  FALLBACK_LLM_PROVIDERS,
  type KeywordTriggerRecord,
} from "./suiteTypes";
import {
  FALLBACK_DEFAULT_AGENTS,
  FALLBACK_PRIMARY_INSTANCE,
  type MarketingWhatsAppInstance,
} from "./types";

describe("zapSuiteEngine & Local-First LLM Harness", () => {
  it("parseia CSV/TXT com delimitador variável, normaliza telefones BR e preserva colunas customizadas", () => {
    const raw = [
      "Nome;WhatsApp;Clinica;Cidade;Especialidade",
      "Dra. Camila Nogueira;(11) 99123-4455;Movimento Pleno;São Paulo;Ortopedia",
      "Dr. Rafael Lima;11988887777;Fisio Vida;Campinas;Pilates",
      "Dra. Camila Duplicada;5511991234455;Movimento Pleno;;",
      "Contato Inválido;12345;Sem Clínica;Santos;",
    ].join("\n");

    const parsed = parseCsvOrTxtContacts(raw);
    expect(parsed.contacts).toHaveLength(2);
    expect(parsed.skippedCount).toBe(1);
    expect(parsed.detectedColumns).toContain("especialidade");
    expect(parsed.contacts[0]).toMatchObject({
      phoneE164: "5511991234455",
      name: "Dra. Camila Nogueira",
    });
    expect(parsed.contacts[0].vars.especialidade).toBe("Ortopedia");
    expect(parsed.contacts[0].vars.primeiro_nome).toBe("Dra.");

    const interpolated = interpolateDynamicVars(
      "{Olá|Oi}, {{primeiro_nome}} da {{clinica}} ({{especialidade}})!",
      parsed.contacts[0].vars,
    );
    const resolved = resolveSpintax(interpolated, () => 0);
    expect(resolved).toBe("Olá, Dra. da Movimento Pleno (Ortopedia)!");
  });

  it("calcula score ZapDefender 0-100 diferenciando chip saudável de chip em alto risco", () => {
    const healthy = computeZapDefenderReport({
      instanceId: "inst-1",
      warmupDay: 15,
      sent7d: 100,
      replied7d: 30,
      failed7d: 0,
      optOut7d: 0,
      disconnects7d: 0,
      dailySentCount: 20,
      dailyLimit: 150,
      status: "connected",
    });
    expect(healthy.overallScore).toBeGreaterThanOrEqual(85);
    expect(healthy.riskLevel).toBe("safe");

    const risky = computeZapDefenderReport({
      instanceId: "inst-2",
      warmupDay: 1,
      sent7d: 50,
      replied7d: 1,
      failed7d: 12,
      optOut7d: 8,
      disconnects7d: 5,
      dailySentCount: 15,
      dailyLimit: 15,
      status: "circuit_broken",
    });
    expect(risky.overallScore).toBeLessThan(55);
    expect(risky.riskLevel).toBe("high_risk");
    expect(risky.recommendations.length).toBeGreaterThan(2);
  });

  it("roteia disparos Multi-Chip UltraSender por cota/saúde com afinidade e pula circuit_broken", () => {
    const chipBroken: MarketingWhatsAppInstance = {
      ...FALLBACK_PRIMARY_INSTANCE,
      id: "chip-broken",
      status: "circuit_broken",
      daily_limit: 150,
      daily_sent_count: 0,
    };
    const chipBusy: MarketingWhatsAppInstance = {
      ...FALLBACK_PRIMARY_INSTANCE,
      id: "chip-busy",
      status: "connected",
      health_score: 90,
      daily_limit: 50,
      daily_sent_count: 45,
    };
    const chipHealthy: MarketingWhatsAppInstance = {
      ...FALLBACK_PRIMARY_INSTANCE,
      id: "chip-healthy",
      status: "connected",
      health_score: 100,
      daily_limit: 80,
      daily_sent_count: 10,
    };

    const chosen = selectWeightedChipInstance(
      [chipBroken, chipBusy, chipHealthy],
      "5511999990001",
    );
    expect(chosen?.id).toBe("chip-healthy");

    const sticky = selectWeightedChipInstance(
      [chipBroken, chipBusy, chipHealthy],
      "(11) 99999-0001",
      { "5511999990001": "chip-busy" },
    );
    expect(sticky?.id).toBe("chip-busy");
  });

  it("avalia gatilhos Keyword/Regex (OmegaChat) por prioridade antes de gastar tokens de LLM", () => {
    const triggers: KeywordTriggerRecord[] = [
      {
        id: "t-regex",
        name: "Escalar Humano",
        matchType: "regex",
        pattern: "\\b(atendente|humano)\\b",
        actionType: "handoff_human",
        actionPayload: {},
        priority: 2,
        isActive: true,
        hitCount: 0,
      },
      {
        id: "t-exact",
        name: "Preço Direto",
        matchType: "exact",
        pattern: "preço",
        actionType: "reply_text",
        actionPayload: { replyText: "Plano a partir de R$ 97/mês" },
        priority: 1,
        isActive: true,
        hitCount: 0,
      },
      {
        id: "t-bad-regex",
        name: "Regex Inválida",
        matchType: "regex",
        pattern: "([unclosed",
        actionType: "reply_text",
        actionPayload: {},
        priority: 0,
        isActive: true,
        hitCount: 0,
      },
    ];

    expect(evaluateKeywordTriggers("Preço", triggers)?.id).toBe("t-exact");
    expect(evaluateKeywordTriggers("Quero falar com um atendente agora", triggers)?.id).toBe("t-regex");
    expect(evaluateKeywordTriggers("Olá, tudo bem?", triggers)).toBeNull();
  });

  it("compacta conversas longas preservando fatos estruturados e últimos 4 turnos sem crescer indefinidamente", () => {
    const turns = Array.from({ length: 12 }, (_, idx) => ({
      role: idx % 2 === 0 ? "lead" : "ai",
      text:
        idx === 0
          ? "Oi, me chamo Camila Nogueira e tenho a clínica Movimento Pleno em Campinas com 5 fisios, sofro com prontuário e agenda."
          : `Turno de conversa número ${idx + 1} sobre demonstração do Pluri Fisio.`,
    }));

    expect(shouldCompactContext(turns, 8, 1800)).toBe(true);
    const compacted = buildLocalExtractiveCompaction("", {}, turns, 4);
    expect(compacted.keptTurns).toHaveLength(4);
    expect(compacted.compactedCount).toBe(8);
    expect(compacted.rollingSummary.length).toBeLessThanOrEqual(900);
    expect(compacted.structuredFacts.nome).toBe("Camila Nogueira");
    expect(compacted.structuredFacts.dor_principal).toBe("prontuário");

    const balloons = splitHumanizedBalloons(
      "Primeiro parágrafo curto para abertura do contato.\n\nSegundo parágrafo bem mais detalhado explicando como o Pluri Fisio organiza prontuários SOAP, escala de dor EVA, repasses financeiros e lembretes automáticos para toda a equipe.",
      90,
    );
    expect(balloons.length).toBeGreaterThanOrEqual(3);
  });

  it("resolve LLM efetiva respeitando override Local-First Ollama vs OpenCode Free vs Pulumi padrão", () => {
    const openCodeDefault = resolveEffectiveAgentLlm(
      { ...FALLBACK_DEFAULT_AGENTS[0], llm_provider_id: null, llm_model_id: null },
      FALLBACK_LLM_PROVIDERS,
      DEFAULT_DEVICE_LLM_HARNESS,
    );
    expect(openCodeDefault.providerType).toBe("opencode_free");

    const localOverride = resolveEffectiveAgentLlm(
      FALLBACK_DEFAULT_AGENTS[0],
      FALLBACK_LLM_PROVIDERS,
      { ...DEFAULT_DEVICE_LLM_HARNESS, preferLocalOllama: true, ollamaModel: "qwen3:4b" },
    );
    expect(localOverride.providerType).toBe("local_ollama");
    expect(localOverride.modelId).toBe("qwen3:4b");
  });
});