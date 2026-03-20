# Therapy Flow

Sistema de prontuario eletronico com frontend em Vite + React e backend em Supabase.

## Fluxo recomendado

- Desenvolvimento local: rode o frontend apontando para uma stack local do Supabase.
- Banco de producao: mantenha qualquer alteracao em `supabase/migrations`.
- Frontend de producao: conecte o repositorio ao Vercel para deploy automatico a cada merge na branch `main`.
- Banco de producao: use o workflow do GitHub Actions deste repositorio para aplicar migrations em producao quando houver push na `main`.

## Desenvolvimento local

### Pre-requisitos

- Node.js 20+.
- Docker Desktop, Rancher Desktop, Podman ou outro runtime compativel com Docker APIs.

### Subindo tudo localmente

```bash
npm ci
npm run dev:local
```

Esse comando faz duas coisas:

1. sobe a stack local do Supabase se ela ainda nao estiver rodando;
2. gera/atualiza o arquivo `.env.local` com a `API URL` e a `ANON KEY` locais antes de iniciar o Vite.

URLs uteis da stack local:

- App: `http://localhost:8080`
- Supabase API: `http://127.0.0.1:54321`
- Banco Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase Studio: `http://127.0.0.1:54323`
- Inbucket/Mailpit: `http://127.0.0.1:54324`

Se quiser controlar a stack manualmente:

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:env:local
npm run supabase:stop
```

## Trabalhando com migrations

Fluxo sugerido:

1. rode o projeto localmente com `npm run dev:local`;
2. faca alteracoes no banco local pelo Studio, SQL editor ou arquivos `.sql`;
3. gere ou ajuste migrations em `supabase/migrations`;
4. valide o app localmente;
5. abra um PR;
6. depois do merge na `main`, o frontend entra em deploy e as migrations sobem para producao.

Exemplo para gerar uma migration a partir do banco local:

```bash
npx supabase db diff -f nome_da_migration
```

Se quiser recriar o banco local do zero aplicando as migrations:

```bash
npm run supabase:reset
```

## Deploy automatico

### Frontend

O caminho mais simples para este app e usar o Git integration do Vercel:

1. importe este repositorio no Vercel;
2. defina a Production Branch como `main`;
3. configure as variaveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. a cada merge na `main`, o Vercel publica uma nova versao automaticamente.

### Banco Supabase

O workflow `.github/workflows/deploy-supabase.yml` aplica as migrations da pasta `supabase/migrations` no projeto remoto quando houver push na `main`.

Configure estes secrets no GitHub:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

O `project ref` atual usado no deploy e `pmnwwdmgxzawsxzpnigw`.

## CI

O workflow `.github/workflows/ci.yml` roda `lint`, `test` e `build` em `pull_request` e tambem em `push` para `main`.
