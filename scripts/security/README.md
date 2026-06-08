# Security attack harness local

Scripts locais para forcar rotas, API anonima do Supabase, concorrencia e payloads de entrada da plataforma.

## Uso rapido

```sh
npm run security:attack:local
```

Os relatorios sao gravados em `core/security-reports/`.

## Scripts

- `node scripts/security/browser-route-audit.mjs`: abre rotas com Playwright e procura vazamento de telas protegidas, tela de erro global e erros de console.
- `node scripts/security/supabase-public-surface-audit.mjs`: consulta tabelas/RPCs com a chave anonima e sinaliza se dados sensiveis aparecem sem login.
- `node scripts/security/concurrency-smoke.mjs`: faz requisicoes paralelas leves contra o frontend.
- `node scripts/security/generate-payload-corpus.mjs`: gera corpus de payloads para fuzz manual ou automacoes futuras.

## Travas

Por padrao os scripts recusam alvos que nao sejam `localhost`, `127.0.0.1` ou `::1`.

Variaveis uteis:

```sh
ATTACK_BASE_URL=http://localhost:8080
ATTACK_SUPABASE_URL=http://127.0.0.1:54321
ATTACK_SUPABASE_ANON_KEY=...
ATTACK_REQUESTS=120
ATTACK_CONCURRENCY=20
ATTACK_PATH=/
```

Use `ALLOW_NON_LOCAL_ATTACK_TARGET=1` somente em ambiente explicitamente autorizado e controlado.
