import { describe, it, expect } from "vitest";
import {
  evaluateMathFormula,
  tokenizeMathExpression,
  wouldCauseCircularDependency,
} from "./safe-math-evaluator";

describe("Safe Math Evaluator", () => {
  it("should tokenize basic expressions", () => {
    const { tokens, error } = tokenizeMathExpression("A + 10 * (B // 2) ^ 3 % 4 - √16");
    expect(error).toBeUndefined();
    expect(tokens).toBeDefined();
    expect(tokens?.map((t) => t.type)).toEqual([
      "IDENTIFIER",
      "PLUS",
      "NUMBER",
      "MULTIPLY",
      "LPAREN",
      "IDENTIFIER",
      "INT_DIVIDE",
      "NUMBER",
      "RPAREN",
      "POWER",
      "NUMBER",
      "MODULO",
      "NUMBER",
      "MINUS",
      "SQRT",
      "NUMBER",
      "EOF",
    ]);
  });

  it("should calculate standard arithmetic", () => {
    expect(evaluateMathFormula("10 + 20 * 3")).toEqual({ success: true, value: 70 });
    expect(evaluateMathFormula("(10 + 20) * 3")).toEqual({ success: true, value: 90 });
    expect(evaluateMathFormula("100 - 45 - 5")).toEqual({ success: true, value: 50 });
  });

  it("should support power (^) and right-associativity", () => {
    expect(evaluateMathFormula("2 ^ 3")).toEqual({ success: true, value: 8 });
    expect(evaluateMathFormula("2 ^ 3 ^ 2")).toEqual({ success: true, value: 512 }); // 2^(3^2) = 2^9 = 512
  });

  it("should support integer division (//) and modulo (%)", () => {
    expect(evaluateMathFormula("17 // 5")).toEqual({ success: true, value: 3 });
    expect(evaluateMathFormula("17 % 5")).toEqual({ success: true, value: 2 });
    expect(evaluateMathFormula("-17 // 5")).toEqual({ success: true, value: -3 });
  });

  it("should support square root (√ and sqrt)", () => {
    expect(evaluateMathFormula("√25")).toEqual({ success: true, value: 5 });
    expect(evaluateMathFormula("sqrt(144)")).toEqual({ success: true, value: 12 });
    expect(evaluateMathFormula("√A + sqrt(B)", { A: 9, B: 16 })).toEqual({ success: true, value: 7 });
  });

  it("should substitute variables correctly (e.g. IMC: Peso / (Altura/100)^2)", () => {
    // 80 kg, 180 cm -> 80 / (1.8)^2 = 80 / 3.24 ≈ 24.69
    const imcResult = evaluateMathFormula("A / ((B / 100) ^ 2)", { A: 80, B: 180 }, 2);
    expect(imcResult).toEqual({ success: true, value: 24.69 });
  });

  it("should handle decimals with comma or period", () => {
    expect(evaluateMathFormula("2.5 * 4")).toEqual({ success: true, value: 10 });
    expect(evaluateMathFormula("2,5 + 3,5")).toEqual({ success: true, value: 6 });
  });

  it("should handle unary plus and minus", () => {
    expect(evaluateMathFormula("-5 + 10")).toEqual({ success: true, value: 5 });
    expect(evaluateMathFormula("+5 - (-3)")).toEqual({ success: true, value: 8 });
  });

  it("should safely handle division by zero without crashing", () => {
    const res = evaluateMathFormula("10 / 0");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/divisão por zero/i);

    const intDivRes = evaluateMathFormula("10 // 0");
    expect(intDivRes.success).toBe(false);
    expect(intDivRes.error).toMatch(/divisão inteira por zero/i);

    const modRes = evaluateMathFormula("10 % 0");
    expect(modRes.success).toBe(false);
    expect(modRes.error).toMatch(/módulo por zero/i);
  });

  it("should safely handle square root of negative numbers", () => {
    const res = evaluateMathFormula("sqrt(-4)");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/raiz quadrada de número negativo/i);
  });

  it("should report missing or unpopulated variables", () => {
    const res = evaluateMathFormula("A + B", { A: 10 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/variável 'B' não preenchida/i);
  });

  it("should report invalid syntax or unbalanced parentheses", () => {
    expect(evaluateMathFormula("(10 + 20").success).toBe(false);
    expect(evaluateMathFormula("10 + * 20").success).toBe(false);
    expect(evaluateMathFormula("").success).toBe(false);
  });

  describe("Security, Prototype Poisoning & ReDoS Hardening", () => {
    it("should prevent prototype property access (constructor, __proto__, toString, valueOf)", () => {
      expect(evaluateMathFormula("constructor + 1", { constructor: 5 } as any).success).toBe(false);
      expect(evaluateMathFormula("__proto__ + 1", { __proto__: 5 } as any).success).toBe(false);
      expect(evaluateMathFormula("toString + 1", { toString: 5 } as any).success).toBe(false);
      expect(evaluateMathFormula("valueOf + 1", { valueOf: 5 } as any).success).toBe(false);
      expect(evaluateMathFormula("hasOwnProperty + 1").success).toBe(false);
    });

    it("should enforce maximum formula length limit (MAX_FORMULA_LENGTH)", () => {
      const longFormula = "1 + ".repeat(300) + "1";
      const res = evaluateMathFormula(longFormula);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/excede o tamanho máximo/i);
    });

    it("should prevent CPU exhaustion from colossal exponents", () => {
      const res = evaluateMathFormula("2 ^ 999999");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/expoente excede o limite/i);
    });
  });

  describe("Circular Dependency Detection (wouldCauseCircularDependency)", () => {
    it("should prevent immediate self-reference", () => {
      const fields = [
        { id: "calc_1", calculatedConfig: { variables: [] } },
      ];
      expect(wouldCauseCircularDependency("calc_1", "calc_1", fields)).toBe(true);
    });

    it("should detect direct 2-field cycle (A -> B and B -> A)", () => {
      const fields = [
        {
          id: "calc_A",
          calculatedConfig: {
            variables: [{ sourceFieldId: "calc_B" }],
          },
        },
        {
          id: "calc_B",
          calculatedConfig: {
            variables: [],
          },
        },
      ];
      // Tentando fazer calc_B puxar de calc_A causaria ciclo
      expect(wouldCauseCircularDependency("calc_B", "calc_A", fields)).toBe(true);
    });

    it("should detect indirect transitive cycle (A -> B -> C and C -> A)", () => {
      const fields = [
        {
          id: "calc_A",
          calculatedConfig: {
            variables: [{ sourceFieldId: "calc_B" }],
          },
        },
        {
          id: "calc_B",
          calculatedConfig: {
            variables: [{ sourceFieldId: "calc_C" }],
          },
        },
        {
          id: "calc_C",
          calculatedConfig: {
            variables: [],
          },
        },
      ];
      // Tentando fazer calc_C puxar de calc_A causaria ciclo
      expect(wouldCauseCircularDependency("calc_C", "calc_A", fields)).toBe(true);
      // Mas calc_D puxar de calc_C é válido
      expect(wouldCauseCircularDependency("calc_D", "calc_C", fields)).toBe(false);
    });
  });
});
