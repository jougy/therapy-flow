---
name: auto-lead-hunter
description: Pipeline de prospecção de leads no Antigravity usando o Browser Subagent no Apify + Subagente Curador SDR (substituto gratuito do Lindy AI) para alimentar a tabela de contatos do Backoffice (/platform/marketing?subtab=auto-lead).
---

# Skill: Auto-Lead Hunter (Browser no Apify + Curador Antigravity)

Esta skill substitui integrações pagas externas (como o Lindy AI) usando diretamente **2 subagentes do próprio Antigravity** + o script local [antigravity-lead-curator.mjs](file:///Users/jougy/Documents/therapy-flow/scripts/leads/antigravity-lead-curator.mjs) com o seu token gratuito do **Apify** salvo no **Pulumi ESC**.

## Fluxo dos 2 Subagentes

### Etapa 1: Subagente de Navegador (`browser`, `Model: "flash"`) no Apify Console
1. Abra o **Apify Console** (`https://console.apify.com/actors/store` ou runs salvas em `https://console.apify.com/actors/runs`).
2. Selecione um Actor gratuito/compatível, por exemplo:
   - `apify/facebook-groups-scraper` (posts e comentários de grupos de Fisioterapia/Pilates)
   - `compass/crawler-google-places` (clínicas e estúdios no Google Maps com WhatsApp/site direto)
3. Configure os grupos/palavras-chave de intenção (`sistema`, `prontuário`, `agenda`, `abrir clínica`, `pilates`) e inicie a execução (ou consulte a última run concluída).
4. Ao concluir, capture o **`datasetId`** (ou exporte os itens JSON da run).
   - *Regra estrita:* Nunca contorne CAPTCHAs ou faça login com credenciais inventadas; pause se a sessão exigir autenticação do usuário.

### Etapa 2: Subagente Curador (`lead-curator`, `Model: "flash"`) — Papel do Lindy AI
O subagente curador recebe os itens brutos (ou o `datasetId` do Apify) e executa a curadoria SDR:
1. Extrai e normaliza **WhatsApp (E.164)**, **`@instagram`**, **e-mail**, **clínica** e **cidade/UF**.
2. Filtra estudantes/spam e atribui **Lead Score (`0-100`)** + classificação ICP (`clinic_owner`, `studio_pilates`, `solo_physio`).
3. Escreve um **Icebreaker personalizado** citando o grupo/post original.
4. Executa o script local conectado ao Pulumi ESC:
   ```bash
   pulumi env run joao-tdoval-gmail-com-org/plurihealth/pluri-prod -- \
     node scripts/leads/antigravity-lead-curator.mjs --dataset-id=<DATASET_ID>
   ```
   Ou, se estiver operando sem `SUPABASE_SERVICE_ROLE_KEY` no terminal, gera o JSON curado com `--dry-run` para colagem direta no botão **"+ Adicionar / Importar" -> "Importar CSV / JSON"** da subaba **Auto-Lead** (`/platform/marketing?subtab=auto-lead`).

## Integração Tripla de Agendas no SaaS
Após inserção em `platform_auto_leads`, os triggers do Postgres e o botão **"Sincronizar Agendas"** do SaaS cruzam automaticamente os telefones/e-mails com:
- **WhatsApp Bot (`+55 11 96047-4566`)** (reuniões concluídas ou tentativas paradas em `waiting_day`/`waiting_time`)
- **WhatsApp Comercial (`+55 11 98011-3936`)** (transbordos e marcações comerciais)
- **Agenda Master (`/platform/agenda`)** (exibindo data/horário, canal e **quem marcou** na Tabela de Contatos)
