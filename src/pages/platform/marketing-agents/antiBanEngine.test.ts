import { describe, expect, it } from "vitest";
import {
  computeGaussianDelayMs,
  computeTypingDurationMs,
  estimateCampaignMinutes,
  formatPhoneBr,
  getWarmupDailyLimit,
  interpolateLeadTemplate,
  isInsideBusinessWindow,
  isOptOutMessage,
  normalizePhoneToE164,
  resolveSpintax,
  shouldTripCircuitBreaker,
} from "./antiBanEngine";

describe("antiBanEngine (Pluri Zap Engine)", () => {
  it("normaliza e formata o chip dedicado (11) 96512-0431 em E.164 e BR", () => {
    expect(normalizePhoneToE164("(11)965120431")).toBe("5511965120431");
    expect(normalizePhoneToE164("11 96512-0431")).toBe("5511965120431");
    expect(formatPhoneBr("5511965120431")).toBe("(11) 96512-0431");
    expect(formatPhoneBr("11965120431")).toBe("(11) 96512-0431");
  });

  it("aplica rampa progressiva de warm-up de 21 dias (15 -> 35 -> 80 -> 150)", () => {
    expect(getWarmupDailyLimit(1)).toBe(15);
    expect(getWarmupDailyLimit(3)).toBe(15);
    expect(getWarmupDailyLimit(5)).toBe(35);
    expect(getWarmupDailyLimit(10)).toBe(80);
    expect(getWarmupDailyLimit(20)).toBe(150);
  });

  it("calcula Jitter Gaussiano dentro do intervalo seguro [15s, 180s] e presença proporcional", () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeGaussianDelayMs(42, 14);
      expect(delay).toBeGreaterThanOrEqual(15_000);
      expect(delay).toBeLessThanOrEqual(180_000);
    }
    expect(computeTypingDurationMs("Oi")).toBe(1800);
    expect(computeTypingDurationMs("a".repeat(500))).toBe(9000);
    const mediumMsg = "Olá Dra. Camila, gostaria de ver como funciona o Pluri?";
    expect(computeTypingDurationMs(mediumMsg)).toBe(mediumMsg.length * 45);
  });

  it("respeita janela horária comercial e dias úteis permitidos", () => {
    const wednesday10am = new Date("2026-11-18T10:00:00");
    const wednesday10pm = new Date("2026-11-18T22:00:00");
    const sunday10am = new Date("2026-11-22T10:00:00");

    expect(isInsideBusinessWindow(wednesday10am, "08:30", "19:30", [1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isInsideBusinessWindow(wednesday10pm, "08:30", "19:30", [1, 2, 3, 4, 5, 6])).toBe(false);
    expect(isInsideBusinessWindow(sunday10am, "08:30", "19:30", [1, 2, 3, 4, 5, 6])).toBe(false);
  });

  it("detecta pedidos de Opt-Out LGPD em diferentes variações", () => {
    expect(isOptOutMessage("PARAR")).toBe(true);
    expect(isOptOutMessage("Por favor, quero sair dessa lista")).toBe(true);
    expect(isOptOutMessage("Não tenho interesse, obrigado")).toBe(true);
    expect(isOptOutMessage("Quero saber o preço do Pluri Fisio")).toBe(false);
  });

  it("resolve spintax aninhado e interpola variáveis do lead", () => {
    const resolved = resolveSpintax("{Olá|Oi} {{primeiro_nome}} da {{clinica}}!", () => 0);
    const interpolated = interpolateLeadTemplate(resolved, {
      primeiro_nome: "Camila",
      clinica: "Clínica Pleno",
      cidade: "São Paulo",
    });
    expect(interpolated).toBe("Olá Camila da Clínica Pleno!");
  });

  it("aciona Circuit Breaker apenas quando amostra >= 10 e taxa excede limiar", () => {
    expect(shouldTripCircuitBreaker(5, 3, 5)).toBe(false);
    expect(shouldTripCircuitBreaker(20, 1, 5)).toBe(false);
    expect(shouldTripCircuitBreaker(20, 2, 5)).toBe(true);
    expect(estimateCampaignMinutes(15, 42, 15, 3)).toBeGreaterThan(0);
  });
});
