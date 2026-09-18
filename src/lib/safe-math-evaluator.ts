/**
 * Safe Math Evaluator
 * 
 * Avaliador matemático seguro sem uso de eval() nem new Function().
 * Utiliza um parser por descida recursiva (Recursive Descent Parser).
 * 
 * Suporte a:
 * - Operadores: +, -, *, /, ^ (potência), % (porcentagem ou módulo), // (divisão inteira), √ ou sqrt (raiz quadrada)
 * - Parênteses: ( e )
 * - Números inteiros e decimais (ponto ou vírgula no input)
 * - Variáveis alfanuméricas: A, B, C...
 * - Tratamento de divisão por zero, raiz de número negativo e sintaxe inválida.
 */

export interface MathEvalResult {
  success: boolean;
  value?: number;
  error?: string;
}

export type VariableValues = Record<string, number | null | undefined>;

/** Limite máximo de caracteres por fórmula para evitar DoS */
export const MAX_FORMULA_LENGTH = 500;

/** Limite de expoente absoluto para evitar estouro computacional ou travamento de CPU */
const MAX_EXPONENT_MAGNITUDE = 1000;

/** Palavras reservadas e propriedades perigosas bloqueadas como identificadores */
const BLOCKED_IDENTIFIERS = new Set([
  "CONSTRUCTOR",
  "PROTOTYPE",
  "__PROTO__",
  "VALUEOF",
  "TOSTRING",
  "TOLOCALESTRING",
  "HASOWNPROPERTY",
  "ISPROTOTYPEOF",
  "PROPERTYISENUMERABLE",
  "APPLY",
  "BIND",
  "CALL",
  "EVAL",
  "FUNCTION",
]);

type TokenType =
  | "NUMBER"
  | "IDENTIFIER"
  | "PLUS"
  | "MINUS"
  | "MULTIPLY"
  | "DIVIDE"
  | "INT_DIVIDE" // //
  | "POWER" // ^
  | "MODULO" // %
  | "SQRT" // √ or sqrt
  | "LPAREN"
  | "RPAREN"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  numValue?: number;
  pos: number;
}

/**
 * Tokeniza a expressão matemática de forma estritamente linear O(N).
 * Usa verificações de código de caractere sem regex catastrófico (anti-ReDoS).
 */
export function tokenizeMathExpression(expression: string): { tokens?: Token[]; error?: string } {
  if (expression.length > MAX_FORMULA_LENGTH) {
    return { error: `Fórmula excede o tamanho máximo permitido de ${MAX_FORMULA_LENGTH} caracteres` };
  }

  const tokens: Token[] = [];
  let i = 0;
  const len = expression.length;

  while (i < len) {
    const ch = expression[i];

    // Pula espaços em branco (O(1))
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Divisão inteira //
    if (ch === "/" && i + 1 < len && expression[i + 1] === "/") {
      tokens.push({ type: "INT_DIVIDE", value: "//", pos: i });
      i += 2;
      continue;
    }

    if (ch === "+") {
      tokens.push({ type: "PLUS", value: "+", pos: i });
      i++;
      continue;
    }

    if (ch === "-") {
      tokens.push({ type: "MINUS", value: "-", pos: i });
      i++;
      continue;
    }

    if (ch === "*") {
      tokens.push({ type: "MULTIPLY", value: "*", pos: i });
      i++;
      continue;
    }

    if (ch === "/") {
      tokens.push({ type: "DIVIDE", value: "/", pos: i });
      i++;
      continue;
    }

    if (ch === "^") {
      tokens.push({ type: "POWER", value: "^", pos: i });
      i++;
      continue;
    }

    if (ch === "%") {
      tokens.push({ type: "MODULO", value: "%", pos: i });
      i++;
      continue;
    }

    if (ch === "√") {
      tokens.push({ type: "SQRT", value: "√", pos: i });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", pos: i });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", pos: i });
      i++;
      continue;
    }

    // Números (inteiros ou decimais com ponto ou vírgula)
    const isDigit = (c: string) => c >= "0" && c <= "9";
    if (isDigit(ch) || (ch === "." && i + 1 < len && isDigit(expression[i + 1]))) {
      const startPos = i;
      let numStr = "";
      let hasDecimal = false;

      while (i < len) {
        const c = expression[i];
        if (isDigit(c)) {
          numStr += c;
          i++;
        } else if (c === "." || c === ",") {
          if (hasDecimal) break;
          // Se for vírgula, valida se o próximo é dígito para evitar consumir vírgulas inválidas
          if (c === "," && (i + 1 >= len || !isDigit(expression[i + 1]))) {
            break;
          }
          hasDecimal = true;
          numStr += ".";
          i++;
        } else {
          break;
        }
      }

      const parsedNum = parseFloat(numStr);
      if (isNaN(parsedNum)) {
        return { error: `Número inválido na posição ${startPos + 1}` };
      }

      tokens.push({
        type: "NUMBER",
        value: numStr,
        numValue: parsedNum,
        pos: startPos,
      });
      continue;
    }

    // Identificadores (letras maiúsculas/minúsculas ou _)
    const isAlpha = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
    const isAlphanumeric = (c: string) => isAlpha(c) || isDigit(c);

    if (isAlpha(ch)) {
      const startPos = i;
      let ident = "";

      while (i < len && isAlphanumeric(expression[i])) {
        ident += expression[i];
        i++;
      }

      const upperIdent = ident.toUpperCase();

      // Blindagem contra protótipo de objeto
      if (BLOCKED_IDENTIFIERS.has(upperIdent)) {
        return { error: `Identificador proibido ou reservado '${ident}' na posição ${startPos + 1}` };
      }

      if (upperIdent === "SQRT") {
        tokens.push({ type: "SQRT", value: "sqrt", pos: startPos });
      } else {
        tokens.push({ type: "IDENTIFIER", value: upperIdent, pos: startPos });
      }
      continue;
    }

    return { error: `Caractere inesperado '${ch}' na posição ${i + 1}` };
  }

  tokens.push({ type: "EOF", value: "", pos: len });
  return { tokens };
}

class MathParser {
  private tokens: Token[];
  private current: number = 0;
  private variables: Record<string, number>;

  constructor(tokens: Token[], variables: Record<string, number> = Object.create(null)) {
    this.tokens = tokens;
    this.variables = variables;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    const tok = this.peek();
    if (tok.type !== "EOF") {
      this.current++;
    }
    return tok;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.peek().type === type) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  public parse(): { value?: number; error?: string } {
    try {
      if (this.peek().type === "EOF") {
        return { error: "Fórmula vazia" };
      }
      const val = this.parseExpression();
      if (this.peek().type !== "EOF") {
        return { error: `Sintaxe inesperada próximo a '${this.peek().value}'` };
      }
      if (!Number.isFinite(val)) {
        return { error: "Resultado numérico indefinido ou infinito" };
      }
      return { value: val };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { error: err.message };
      }
      return { error: "Erro na avaliação da fórmula" };
    }
  }

  // Expression = Additive
  private parseExpression(): number {
    return this.parseAdditive();
  }

  // Additive = Multiplicative ( ('+' | '-') Multiplicative )*
  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.advance().type;
      const right = this.parseMultiplicative();
      if (op === "PLUS") {
        left += right;
      } else {
        left -= right;
      }
    }

    return left;
  }

  // Multiplicative = Power ( ('*' | '/' | '//' | '%') Power )*
  private parseMultiplicative(): number {
    let left = this.parsePower();

    while (
      this.peek().type === "MULTIPLY" ||
      this.peek().type === "DIVIDE" ||
      this.peek().type === "INT_DIVIDE" ||
      this.peek().type === "MODULO"
    ) {
      const op = this.advance().type;
      const right = this.parsePower();

      if (op === "MULTIPLY") {
        left *= right;
      } else if (op === "DIVIDE") {
        if (right === 0) {
          throw new Error("Divisão por zero");
        }
        left /= right;
      } else if (op === "INT_DIVIDE") {
        if (right === 0) {
          throw new Error("Divisão inteira por zero");
        }
        left = Math.trunc(left / right);
      } else if (op === "MODULO") {
        if (right === 0) {
          throw new Error("Módulo por zero");
        }
        left = left % right;
      }
    }

    return left;
  }

  // Power = Unary ( '^' Power )? -- Associativo à direita com proteção contra DoS de expoente
  private parsePower(): number {
    const left = this.parseUnary();

    if (this.peek().type === "POWER") {
      this.advance();
      const right = this.parsePower();
      if (Math.abs(right) > MAX_EXPONENT_MAGNITUDE) {
        throw new Error(`Expoente excede o limite de segurança de ±${MAX_EXPONENT_MAGNITUDE}`);
      }
      return Math.pow(left, right);
    }

    return left;
  }

  // Unary = ('+' | '-') Unary | SQRT Primary | Primary
  private parseUnary(): number {
    if (this.match("PLUS")) {
      return this.parseUnary();
    }
    if (this.match("MINUS")) {
      return -this.parseUnary();
    }
    if (this.match("SQRT")) {
      const operand = this.parseUnary();
      if (operand < 0) {
        throw new Error("Raiz quadrada de número negativo não é permitida");
      }
      return Math.sqrt(operand);
    }

    return this.parsePrimary();
  }

  // Primary = NUMBER | IDENTIFIER | '(' Expression ')'
  private parsePrimary(): number {
    const token = this.peek();

    if (token.type === "NUMBER") {
      this.advance();
      return token.numValue ?? 0;
    }

    if (token.type === "IDENTIFIER") {
      this.advance();
      const varName = token.value;

      // Blindagem estrita contra Object.prototype
      if (!Object.prototype.hasOwnProperty.call(this.variables, varName)) {
        throw new Error(`Variável '${varName}' não preenchida`);
      }
      const val = this.variables[varName];
      if (typeof val !== "number" || !Number.isFinite(val)) {
        throw new Error(`Valor da variável '${varName}' inválido`);
      }
      return val;
    }

    if (token.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpression();
      if (!this.match("RPAREN")) {
        throw new Error("Parêntese ')' esperado para fechar expressão");
      }
      return expr;
    }

    if (token.type === "EOF") {
      throw new Error("Fim inesperado da fórmula");
    }

    throw new Error(`Elemento inesperado '${token.value}'`);
  }
}

/**
 * Avalia uma expressão matemática de forma segura.
 * 
 * @param formula Exemplo: "A / (B / 100) ^ 2" ou "sqrt(A) + B // 2"
 * @param variables Mapa de valores das variáveis { A: 70, B: 175 }
 * @param decimalPlaces Opcional: arredondar resultado para N casas decimais (0 a 10)
 */
export function evaluateMathFormula(
  formula: string,
  variables: VariableValues = {},
  decimalPlaces?: number
): MathEvalResult {
  if (!formula || typeof formula !== "string" || !formula.trim()) {
    return { success: false, error: "Fórmula não informada" };
  }

  const cleanFormula = formula.trim();

  // Tokeniza
  const tokenResult = tokenizeMathExpression(cleanFormula);
  if (tokenResult.error || !tokenResult.tokens) {
    return { success: false, error: tokenResult.error || "Erro de sintaxe" };
  }

  // Normaliza variáveis sanitizadas em dicionário limpo sem prototype (Object.create(null))
  const cleanVars: Record<string, number> = Object.create(null);
  if (variables && typeof variables === "object") {
    for (const [k, v] of Object.entries(variables)) {
      const sanitizedKey = k.toUpperCase().trim();
      if (!BLOCKED_IDENTIFIERS.has(sanitizedKey) && typeof v === "number" && Number.isFinite(v)) {
        cleanVars[sanitizedKey] = v;
      }
    }
  }

  const parser = new MathParser(tokenResult.tokens, cleanVars);
  const result = parser.parse();

  if (result.error !== undefined || result.value === undefined) {
    return { success: false, error: result.error || "Erro no cálculo" };
  }

  let finalValue = result.value;
  if (typeof decimalPlaces === "number" && decimalPlaces >= 0 && decimalPlaces <= 10) {
    const factor = Math.pow(10, decimalPlaces);
    finalValue = Math.round((finalValue + Number.EPSILON) * factor) / factor;
  }

  return {
    success: true,
    value: finalValue,
  };
}

/**
 * Interface simplificada de campo para detecção de ciclo de dependências.
 */
export interface CalculatedFieldDependencyNode {
  id: string;
  calculatedConfig?: {
    variables?: Array<{
      sourceFieldId?: string;
    }>;
  };
}

/**
 * Detecta se a adição ou existência de dependências entre campos calculados gera um ciclo (loop infinito).
 * Algoritmo DFS com conjunto de nós visitados e pilha de recursão. Complexidade O(V + E).
 *
 * @param targetFieldId ID do campo que está sendo avaliado ou modificado
 * @param candidateSourceFieldId ID do campo que seria a fonte
 * @param allFields Lista de todos os campos do formulário
 * @returns true se um ciclo for detectado, impedindo a dependência
 */
export function wouldCauseCircularDependency(
  targetFieldId: string,
  candidateSourceFieldId: string,
  allFields: CalculatedFieldDependencyNode[]
): boolean {
  if (!targetFieldId || !candidateSourceFieldId) return false;
  if (targetFieldId === candidateSourceFieldId) return true;

  // Constrói grafo de adjacência (campo -> conjunto de campos de onde ele puxa)
  const adjacency = new Map<string, string[]>();
  for (const f of allFields) {
    const sources: string[] = [];
    if (f.calculatedConfig?.variables) {
      for (const v of f.calculatedConfig.variables) {
        if (v.sourceFieldId) {
          sources.push(v.sourceFieldId);
        }
      }
    }
    adjacency.set(f.id, sources);
  }

  // Simula a adição da aresta: targetFieldId puxa de candidateSourceFieldId
  const currentSources = adjacency.get(targetFieldId) || [];
  adjacency.set(targetFieldId, [...currentSources, candidateSourceFieldId]);

  // DFS a partir de candidateSourceFieldId para ver se chega de volta a targetFieldId
  const visited = new Set<string>();
  const stack = [candidateSourceFieldId];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === targetFieldId) {
      return true; // Ciclo detectado!
    }

    if (!visited.has(curr)) {
      visited.add(curr);
      const nextNodes = adjacency.get(curr) || [];
      for (const next of nextNodes) {
        if (!visited.has(next)) {
          stack.push(next);
        }
      }
    }
  }

  return false;
}
