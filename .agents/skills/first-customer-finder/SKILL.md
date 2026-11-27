---
name: first-customer-finder
description: Encontra fisioterapeutas com dor ativa pública para a Pluri Fisio (posts/comentários recentes pedindo sistema de prontuário/agenda ou reclamando de papel/planilha/concorrentes), executa checagem de contra-evidência via LLM local custo zero (Ollama/OpenCode Free), seleciona a melhor estratégia do Super-Conversor Brain (80/20) e exige aprovação humana antes de gravar ou disparar no WhatsApp.
---

# First Customer Finder — Pluri Fisio (Sinais de Dor Ativa)

> **Escopo & Convivência:** Esta skill adapta o método `Kappaemme-git/codex-first-customer-finder-skill` + passagem de contra-evidência da `z0rats/first-customer-finder-skill`. Ela **complementa** (sem substituir ou conflitar com) a skill `auto-lead-hunter`: enquanto o `auto-lead-hunter` faz varredura ampla via Apify (Google Maps / Grupos FB), a `first-customer-finder` minera **sinais públicos de dor explícita e intenção imediata de compra**.

## Princípios Obrigatórios
1. **Somente Sinais Públicos Verificáveis:** Todo lead deve possuir `source_url` pública inspecionada, trecho literal da dor (`pain_excerpt`) e data/recência avaliada. Nunca invente URLs ou contatos privados.
2. **Passagem de Contra-Evidência Obrigatória:** Antes de qualificar, verifique se o autor NÃO é paciente procurando atendimento, vendedor de curso/equipamento, vaga de emprego ou clínica já satisfeita com outro software.
3. **Aprovação Humana (Regra do Agente 3):** Sempre exiba o plano completo (`--dry-run` primeiro) com link, dor, nota `0–5`, estratégia sugerida pelo Brain e prévia das mensagens antes de persistir em `platform_auto_leads` ou agendar envios.
4. **Tom Obrigatório da Pluri Fisio:** *"Natural, humano e simpático, sem perder o profissionalismo e a formalidade."* Trate profissionais de saúde com respeito acolhedor, frases curtas e diretas, sem gírias, sem textão de telemarketing e sem excesso de emojis.
5. **Constituição Obrigatória dos Agentes WhatsApp:** Toda abordagem gerada ou disparada deve cumprir integralmente [REGRAS_OBRIGATORIAS_AGENTES_WHATSAPP.md](file:///home/jougy/Documents/programacao/therapy-flow/docs/marketing/REGRAS_OBRIGATORIAS_AGENTES_WHATSAPP.md) (Truth Pack exato, sigilo técnico zero-vazamento, saudação segura, sequência em 5 passos e zero envio de mídia fria).

---

## Fluxo Operacional em 5 Passos

### Passo 1 — Carregar Critérios da Pluri Fisio & Histórico Local
Leia sob demanda os arquivos de referência necessários:
* [pluri-fisio-icp.md](file:///home/jougy/Documents/programacao/therapy-flow/.agents/skills/first-customer-finder/references/pluri-fisio-icp.md) — Perfis-alvo (`solo_physio`, `clinic_owner`, `studio_pilates`, recém-formado CREFITO, experiente no papel/planilha), queries em PT-BR e desqualificadores.
* [scoring-rubric.md](file:///home/jougy/Documents/programacao/therapy-flow/.agents/skills/first-customer-finder/references/scoring-rubric.md) — Rubrica `0–5`, trava de data ambígua e conversão para `ai_score (0–100)`.
* [history-dedup.md](file:///home/jougy/Documents/programacao/therapy-flow/.agents/skills/first-customer-finder/references/history-dedup.md) — Deduplicação local (`pain_signal_history`) e refinamento por feedback do usuário.

### Passo 2 — Minerar Sinais Públicos de Dor
Use **`search_web`** com as queries de dor ativa do `pluri-fisio-icp.md` (ex.: pedidos de indicação de sistema para fisioterapia, desabafos sobre prontuário/evolução CREFITO, faltas de pacientes no WhatsApp, planilhas financeiras, críticas a softwares engessados).
* Quando uma thread dinâmica exigir leitura completa, use o subagente **`browser`** (`Model: "flash"`) apenas em páginas públicas (nunca contorne login/CAPTCHA/anti-bot).
* Monte um arquivo JSON temporário de candidatos (em `.local-data/conversion-brain/raw-signals.json` ou via `--stdin`) com: `full_name`, `source_url`, `published_at`, `source_platform`, `pain_excerpt`, `city`, `state`, `phone`, `instagram_handle`, `email`, `icp_tier`.

### Passo 3 — Filtrar com LLM Local (Custo Zero) + Contra-Evidência
Execute sempre primeiro em modo de revisão (`--dry-run`):
```bash
npm run leads:find-signals -- --input=.local-data/conversion-brain/raw-signals.json --dry-run
```
O comando executará localmente:
1. Deduplicação contra `.local-data/conversion-brain/brain.sqlite` (`pain_signal_history`).
2. Triagem e checagem de contra-evidência via cascata custo zero (`Ollama mimo-v2.6:latest` → `gemma4:12b` → `OpenCode Free` → heurística determinística).
3. Pontuação na rubrica `0–5` (com trava se data for ambígua ou > 6 meses) → conversão `0–100`.
4. Seleção dinâmica da estratégia por **Personalidade × Origem × Dor (Política 80/20)** + geração de **Gancho Limpo de Conteúdo** (quando encontrado em post/comentário, aproveita o assunto de forma natural e elegante) + injeção dos Top Pontos Fortes e exclusão dos Pontos Fracos (`avoid_list`).

### Passo 4 — Apresentar Plano de Abordagem ao Usuário (Aprovação Prévia)
Apresente ao usuário a tabela gerada pelo comando contendo:
* **Lead** + perfil (`icp_tier`) + **Personalidade inferida** + **Nota (0–5)** (`ai_score` `0–100`)
* **Origem + Gancho de Conteúdo limpo** + link público verificado + status **Contra-evidência OK**
* **Linha Estratégica escolhida para aquela pessoa** (`S1..S6` + Top 3 ranqueadas p/ o perfil)
* **Prévia da abertura personalizada** (tom natural, humano, simpático, profissional e formal)

Aguarde confirmação ou refinamento do usuário (ex.: *"aprove os leads 1 e 3; descarte o 2 porque é clínica grande"*).

### Passo 5 — Persistir Aprovados & Retroalimentar o Ranking
1. Após aprovação explícita, grave em `platform_auto_leads` (sem `--dry-run`):
   ```bash
   npm run leads:find-signals -- --input=.local-data/conversion-brain/raw-signals.json
   ```
2. Os leads aparecem no Backoffice (`/platform/marketing?subtab=auto-lead`) com card dedicado em `LeadDossierSection.tsx` (mostrando Personalidade, Origem, Gancho, Top 3 Estratégias e botões **Copiar**).
3. Periodicamente, após conversas reais no WhatsApp, execute `npm run leads:learn` para avaliar pós-morte, atualizar rankings por contexto e revisar antes de publicar (`npm run leads:select -- --mode=dynamic --publish` ou `--strategy=<ID> --context=<origem>:<personalidade> --publish`).
