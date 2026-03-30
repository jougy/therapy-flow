# Deploy do Frontend na Cloudflare

## Estrategia escolhida

O frontend sera publicado na Cloudflare usando `Wrangler` com `Workers Static Assets`.

Isso faz sentido para este projeto porque:

- o app e um SPA em Vite;
- o build ja e gerado localmente em `dist`;
- o `.env` de producao fica local e ja contem a configuracao do Supabase remoto;
- fica alinhado com o build conectado ao GitHub, que esta usando `Workers Builds`.

## Configuracao atual

- worker/projeto esperado: `therapy-flow`
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

1. Garantir que o worker/projeto `therapy-flow` exista na Cloudflare.
2. Rodar o deploy pelo [control.sh](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/control.sh).

Opcao interativa:

```sh
./control.sh
```

Depois escolha `cloudflare-pages-deploy`.

Opcao direta:

```sh
CLOUDFLARE_API_TOKEN='...' \
CLOUDFLARE_ACCOUNT_ID='...' \
./control.sh --run cloudflare-pages-deploy
```

## Observacoes

- O script faz o build local antes do upload.
- O deploy usa `npx wrangler deploy`.
- O nome usado no deploy vem do [wrangler.toml](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/wrangler.toml).
- Nao deve existir `public/_redirects` com regra catch-all quando o deploy estiver em `Workers Static Assets`, porque isso causa loop de fallback na Cloudflare.
- Se o repositorio continuar conectado ao GitHub na Cloudflare, os builds de PR devem usar essa mesma configuracao.
