# Scripts de Operação

Esta pasta reúne atalhos operacionais usados para subir o ambiente local, publicar partes do sistema e administrar contas diretamente no Supabase.

O conjunto está dividido em dois blocos:

- `control.sh`: central de comandos para ambiente local, deploy e alguns atalhos administrativos.
- `account-admin*.{mjs,sh}`: gerenciador administrativo de contas e pacientes, com wrappers para macOS, Linux e produção.

## Visão geral dos arquivos

### `control.sh`

Script shell com menu interativo e modo não interativo via `--run`.

Ele resolve tarefas como:

- iniciar e limpar Docker/Colima no macOS;
- subir, parar, reinstalar e resetar o Supabase local;
- aplicar migrations localmente;
- aplicar migrations no Supabase remoto;
- instalar, iniciar e parar o frontend em background;
- rodar build/deploy do frontend na Cloudflare;
- criar e listar contas rapidamente no ambiente local usando `SERVICE_ROLE_KEY`.

Pontos importantes:

- foi pensado para macOS e usa `open` e `colima` em algumas rotas;
- carrega `~/.profile` antes de comandos Node/npm/npx/Supabase;
- guarda PID e logs do frontend em `scripts/ops/.control/`.

Formas de uso:

```sh
sh scripts/ops/control.sh
sh scripts/ops/control.sh --list
sh scripts/ops/control.sh --run supabase-start
sh scripts/ops/control.sh --run cloudflare-pages-deploy
```

Comandos principais expostos por ele:

- `docker-start`
- `docker-clean`
- `supabase-start`
- `supabase-restart`
- `supabase-stop`
- `supabase-install`
- `supabase-reinit`
- `supabase-online-deploy`
- `db-update`
- `db-reset`
- `frontend-install`
- `frontend-start`
- `frontend-restart`
- `frontend-stop`
- `frontend-logs`
- `cloudflare-pages-deploy`
- `account-create`
- `account-list`

### `account-admin.mjs`

É o gerenciador administrativo principal. Ele usa `@supabase/supabase-js` com `service_role` para operar diretamente no backend.

Esse script:

- lista contas gerenciadas;
- filtra e busca contas por e-mail, clínica, documento, ID e código;
- cria contas `solo` e `clinic`;
- cria subcontas;
- edita acesso de owner e subconta;
- altera limite de acessos simultâneos em clínica;
- exclui pacote `solo`, clínica inteira ou subconta;
- lista, cria, edita e exclui pacientes por clínica.

Ele possui dois modos:

- `local`: lê a URL e a `SERVICE_ROLE_KEY` do Supabase local via `npx supabase status -o env`;
- `prod`: lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de um arquivo `supabase.env` fora do repositório.

Além disso, ele exige uma chave local de confiança da máquina atual antes de liberar operações administrativas.

Fluxo de segurança implementado:

- gera um par Ed25519 local com `init-key`;
- grava chave privada, chave pública e fingerprint em um diretório administrativo local;
- a cada execução, valida a chave assinando um challenge local;
- se a chave não existir ou estiver inconsistente, o script falha.

Arquivos usados por esse fluxo:

- chave privada: `~/.pronto-health-fisio-admin/id_ed25519.pem` no modo local padrão;
- chave pública: `~/.pronto-health-fisio-admin/id_ed25519.pub.pem`;
- fingerprint confiável: `~/.pronto-health-fisio-admin/trusted_fingerprint`;
- no Linux com `account-admin-linux.sh`, o diretório padrão local vira `~/.pronto-health-fisio-admin-linux`;
- no modo `prod`, o diretório padrão muda para `~/.pronto-health-fisio-admin-prod`.

Uso típico:

```sh
./scripts/ops/account-admin-local.sh init-key
./scripts/ops/account-admin-local.sh
./scripts/ops/account-admin-local.sh list --json
./scripts/ops/account-admin-linux.sh init-key
./scripts/ops/account-admin-linux.sh list --json
./scripts/ops/account-admin-prod.sh create-clinic --email owner@teste.com --password 123456 --cnpj 12345678901234
```

Comandos CLI suportados:

- `init-key`
- `list`
- `view`
- `create-solo`
- `update-solo-access`
- `delete-solo`
- `create-clinic`
- `update-clinic-owner-access`
- `delete-clinic`
- `create-subaccount`
- `update-subaccount-status`
- `delete-subaccount`

Quando chamado sem comando, ele abre um menu interativo de administração.

### `account-admin-local.sh`

Wrapper mínimo para o gerenciador administrativo local.

Função dele:

- carrega `~/.profile`;
- executa `node account-admin.mjs`;
- usa o modo padrão `local`.

É o entrypoint mais simples para operar contra o Supabase local.

### `account-admin-linux.sh`

Wrapper equivalente ao `account-admin-local.sh`, mas pensado para Linux.

Função dele:

- carrega `~/.profile` quando existir;
- define o nome do CLI mostrado nas mensagens;
- isola o diretório administrativo local em `~/.pronto-health-fisio-admin-linux`;
- executa `node account-admin.mjs`.

No Manjaro, este é o entrypoint recomendado para criar um acesso exclusivo desta máquina:

```sh
chmod +x scripts/ops/account-admin-linux.sh
./scripts/ops/account-admin-linux.sh init-key
./scripts/ops/account-admin-linux.sh
```

Esse `init-key` gera uma chave Ed25519 nova e independente das chaves usadas no mac.

### `account-admin-prod.sh`

Wrapper do gerenciador administrativo em modo produção.

Função dele:

- carrega `~/.profile` se existir;
- força `THERAPY_FLOW_ADMIN_MODE=prod`;
- define o nome do CLI mostrado nas mensagens;
- resolve o diretório administrativo de produção;
- define o caminho do arquivo `supabase.env` com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`;
- chama `node account-admin.mjs`.

Esse wrapper não publica código nem migrations. Ele serve para operações administrativas diretas no backend remoto já existente.

### `account-admin-lib.mjs`

Biblioteca auxiliar do gerenciador administrativo.

Responsabilidades:

- normalização de texto e dígitos;
- validação de CPF/CNPJ do owner;
- normalização e derivação de status administrativo;
- classificação de conta (`solo_owner`, `clinic_owner`, `clinic_subaccount`);
- filtros e ordenação da listagem;
- cálculo do fingerprint da chave pública;
- validação do material criptográfico local;
- resolução do limite de acessos simultâneos com fallback para campos legados.

É a base das regras de negócio do admin CLI.

### `account-admin-cli-lib.mjs`

Biblioteca auxiliar focada no menu e no CRUD simplificado de pacientes.

Responsabilidades:

- definir as opções do menu principal;
- definir o menu quando uma conta está selecionada;
- montar payload de criação de paciente;
- montar payload de edição de paciente;
- calcular idade do paciente a partir da data de nascimento.

Ela é consumida por `account-admin.mjs`.

### `.control/frontend.log`

Arquivo gerado em runtime.

Ele recebe os logs do frontend quando `control.sh` sobe o Vite em background com `frontend-start`.

Arquivos relacionados gerados dinamicamente:

- `scripts/ops/.control/frontend.pid`
- `scripts/ops/.control/frontend.log`

Esses arquivos não são a fonte da lógica. São apenas artefatos operacionais temporários.

## Dependências operacionais

Dependendo do comando, esses scripts assumem a presença de:

- macOS ou Linux;
- `node` e `npm`;
- `npx`;
- `@supabase/supabase-js`;
- Supabase CLI;
- Docker/Colima;
- `wrangler`;
- variáveis de ambiente ou arquivos com credenciais.

Credenciais mais relevantes:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF` ou `VITE_SUPABASE_PROJECT_ID` no `.env`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Relação com local e produção

### Ambiente local

O fluxo local é mais forte em `control.sh`, `account-admin-local.sh` e `account-admin-linux.sh`.

Exemplos:

- `supabase-start` sobe a stack local;
- `db-update` aplica migrations localmente com `supabase db push --local`;
- `account-admin-local.sh` e `account-admin-linux.sh` operam com a `SERVICE_ROLE_KEY` do Supabase local.

### Ambiente remoto

Existem dois fluxos remotos diferentes nesta pasta:

- `supabase-online-deploy` em `control.sh`: linka um projeto Supabase remoto e aplica migrations;
- `account-admin-prod.sh`: faz operações administrativas diretas no backend de produção via `service_role`.

Ou seja:

- deploy de schema/migrations remotas passa por `supabase-online-deploy`;
- gestão operacional de contas e pacientes em produção passa por `account-admin-prod.sh`.

## Cuidados

- `account-admin.mjs` usa permissões administrativas altas; trate `supabase.env`, `service_role` e a chave local como segredos.
- `delete-clinic`, `delete-solo`, `delete-subaccount` e exclusão de pacientes são operações destrutivas.
- `control.sh supabase-online-deploy` altera `supabase/config.toml` para o `project_ref` remoto informado.
- no Linux, prefira `account-admin-linux.sh` para manter um diretório de confiança separado e explícito para essa máquina.
