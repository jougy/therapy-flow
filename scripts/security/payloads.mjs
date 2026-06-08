export const textPayloads = [
  {
    name: "xss-script-tag",
    value: "<script>alert('xss')</script>",
    risk: "HTML/script injection",
  },
  {
    name: "xss-img-onerror",
    value: "<img src=x onerror=alert('xss')>",
    risk: "HTML event handler injection",
  },
  {
    name: "sql-ish",
    value: "'; drop table patients; --",
    risk: "SQL-like input passed through unexpected paths",
  },
  {
    name: "formula-injection",
    value: "=IMPORTXML(\"https://example.invalid\", \"//x\")",
    risk: "Spreadsheet formula injection in exports",
  },
  {
    name: "control-chars",
    value: "texto\u0000\u0008\u000b\u001f\u007fcom-controles",
    risk: "Control characters and log/output corruption",
  },
  {
    name: "unicode-bidi",
    value: "paciente-\u202eexe.txt",
    risk: "Bidirectional text spoofing",
  },
  {
    name: "path-traversal",
    value: "../../../../../etc/passwd",
    risk: "Path traversal if user text reaches file paths",
  },
  {
    name: "oversized",
    value: "A".repeat(20000),
    risk: "Oversized text and layout/storage stress",
  },
];

export const numericPayloads = [
  { name: "negative-money", value: "-999999999999999.99" },
  { name: "huge-money", value: "999999999999999999999999.99" },
  { name: "nan", value: "NaN" },
  { name: "infinity", value: "Infinity" },
  { name: "scientific", value: "1e309" },
  { name: "locale-chaos", value: "R$ 1.234.567.890,9999" },
];

export const routePayloads = [
  "/",
  "/auth",
  "/clinicas",
  "/clinica/invalid-route-key",
  "/clinica/%2e%2e/%2e%2e/configuracoes",
  "/pacientes/novo",
  "/pacientes/fde97aca-684b-4f6d-a3fe-ddcee3daec15",
  "/pacientes/fde97aca-684b-4f6d-a3fe-ddcee3daec15/sessao/novo",
  "/configuracoes",
  "/configuracoes?secao=clinic",
  "/%2e%2e/%2e%2e/pacientes",
  "/clinica/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
];
