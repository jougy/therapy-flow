---
tags:
  - deploy
  - infra
  - cloudflare
kind: guide
area: engenharia
aliases:
  - Deploy - Cloudflare Pages
  - Deploy Cloudflare
  - CLOUDFLARE_PAGES_DEPLOY
---
# Deploy do Frontend na Cloudflare

## Estrategia escolhida

O frontend sera publicado na Cloudflare usando `Wrangler` com `Workers Static Assets`.

Isso faz sentido para este projeto porque:

- o app e um SPA em Vite;
- o build ja e gerado localmente em `dist`;
- o `.env` de producao fica local e ja contem a configuracao do Supabase remoto;
- fica alinhado com o build conectado ao GitHub, que esta usando `Workers Builds`.

## Configuracao atual

- worker/projeto esperado: `pronto-health-fisio`
- build local: `npm run build`
- diretorio publicado: `dist` via [wrangler.toml](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/wrangler.toml)
- fallback SPA: `not_found_handling = "single-page-application"` no [wrangler.toml](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/wrangler.toml)

## Credenciais necessarias

Para publicar com o script de controle, voce precisa ter:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O build vai usar o `.env` local, entao o frontend sera compilado com:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Fluxo recomendado

1. Garantir que o worker/projeto `pronto-health-fisio` exista na Cloudflare.
2. Rodar o deploy pelo seu script local privado de operacao, que nao fica versionado no repositorio.

Opcao interativa:

O fluxo local deve:

```sh
npm run build
npx wrangler deploy
```

Opcao direta:

```sh
CLOUDFLARE_API_TOKEN='...' \
CLOUDFLARE_ACCOUNT_ID='...' \
npx wrangler deploy
```

## Observacoes

- O script faz o build local antes do upload.
- O deploy usa `npx wrangler deploy`.
- O nome usado no deploy vem do [wrangler.toml](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/wrangler.toml).
- Nao deve existir `public/_redirects` com regra catch-all quando o deploy estiver em `Workers Static Assets`, porque isso causa loop de fallback na Cloudflare.
- Se o repositorio continuar conectado ao GitHub na Cloudflare, os builds de PR devem usar essa mesma configuracao.

## Armadilhas Recorrentes no Build do Cloudflare Pages (GitHub Webhook)

1. **`bun install --frozen-lockfile` (Lockfile defasado)**:
   - A Cloudflare executa `bun install --frozen-lockfile` ao clonar o repositório. Se você alterar a versão no `package.json` ou adicionar dependências sem atualizar o `bun.lock` via `npx bun install` ou `npm install`, a Cloudflare rejeita o build com: `error: lockfile had changes, but lockfile is frozen`.
   - **Solução**: Sempre commitar o `bun.lock` e `package-lock.json` atualizados após qualquer alteração em dependências ou versão.

2. **`UNRESOLVED_IMPORT` por arquivos fora de `src/` ou ignorados**:
   - Se um componente importar um arquivo markdown ou asset situado em uma pasta no `.gitignore` (ex: `core/Pluri-Health/`), o build local funcionará por causa dos arquivos no disco local, mas o Cloudflare falhará porque essa pasta não foi enviada ao Git.
   - **Solução**: Mover assets consumidos pelo aplicativo frontend para `src/assets/` ou `public/`.

## Notas relacionadas

- [[Mapa da vault]]
- [[Ambiente e operacao]]
- [[TDD e checks]]
