# Deploy do Frontend na Cloudflare Pages

## Estrategia escolhida

O frontend sera publicado por `Direct Upload` na Cloudflare Pages.

Isso faz sentido para este projeto porque:

- o app e um SPA em Vite;
- o build ja e gerado localmente em `dist`;
- o `.env` de producao fica local e ja contem a configuracao do Supabase remoto;
- evita duplicar secrets na Cloudflare neste primeiro deploy.

## Configuracao atual

- Pages project esperado: `therapy-flow`
- build local: `npm run build`
- diretorio publicado: `dist`
- fallback SPA: [public/_redirects](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/public/_redirects)
- configuracao do Wrangler: [wrangler.toml](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/wrangler.toml)

## Credenciais necessarias

Para publicar com o script de controle, voce precisa ter:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O build vai usar o `.env` local, entao o frontend sera compilado com:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Fluxo recomendado

1. Criar uma vez o projeto `therapy-flow` na Cloudflare Pages.
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
- O deploy usa `npx wrangler pages deploy dist`.
- Se o nome do projeto Pages nao for `therapy-flow`, voce pode sobrescrever com:

```sh
CLOUDFLARE_PAGES_PROJECT_NAME='outro-nome'
```

- Se quiser publicar em outra branch logica do Pages:

```sh
CLOUDFLARE_PAGES_BRANCH='preview'
```
