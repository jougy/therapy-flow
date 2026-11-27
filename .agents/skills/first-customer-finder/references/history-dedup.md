# Histórico Local, Deduplicação & Feedback Iterativo

Seguindo `references/feedback-and-history.md` da skill original, o histórico de prospecção fica salvo localmente no SQLite do **Super-Conversor Brain** (`.local-data/conversion-brain/brain.sqlite`, tabela `pain_signal_history`) para nunca gastar créditos nem abordar duas vezes a mesma pessoa.

## 1. Chaves de Deduplicação
Antes de incluir qualquer novo candidato no plano de aprovação, `scripts/leads/brain/cli.mjs find-signals` verifica:
1. **`source_url` normalizada** (sem parâmetros `utm_*`, `?igshid=`, etc.).
2. **Telefone normalizado** (`55 + DDD + número` hashed em SHA-256 local `phone_hash`).
3. **Handle social** (`@instagram` ou URL de perfil em lowercase).

Se já existir em `pain_signal_history` (ou já tiver `feedback_status` igual a `rejected` / `contacted` / `converted`), o candidato é ignorado automaticamente e exibido apenas no contador de deduplicados.

## 2. Ciclo de Refinamento com Feedback Humano
Quando o usuário revisar o plano exibido por `--dry-run` e der feedback — por exemplo:
* *"Os sinais de autônomos com CREFITO novo foram ótimos; evite clínicas grandes."*
* *"Foque em quem reclamou de prontuário em papel ou faltas."*

Registre os preferidos/descartados com `feedback_status` (`approved` / `rejected`) e ajuste as próximas queries de busca em `search_web` respeitando os novos filtros informados.
