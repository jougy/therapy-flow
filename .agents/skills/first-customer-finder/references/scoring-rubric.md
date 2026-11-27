# Rubrica de Pontuação (0–5) & Contra-Evidência

Baseada na estrutura transparente da `Kappaemme-git/codex-first-customer-finder-skill` combinada à validação negativa da `z0rats/first-customer-finder-skill`.

## 1. As 5 Dimensões (Nota 0 a 5 cada)

| Dimensão | 5 (Excelente) | 3 (Moderado) | 0–1 (Fraco / Bloqueado) |
| :--- | :--- | :--- | :--- |
| **`evidence_strength`** | Post/comentário público com `source_url` real e trecho literal expressando a dor | Perfil público consistente com sinais indiretos (ex.: clínica recém-aberta em diretório) | Sem link verificável ou afirmação sem fonte |
| **`pain_severity`** | Pede indicação explícita de sistema ou reclama abertamente de papel/planilha/faltas | Menciona rotina manual ou início de consultório sem reclamar ainda | Sem menção de necessidade operacional |
| **`timing_urgency`** | Publicado nos últimos **30 dias** ou clínica recém-inaugurada / CREFITO recente | Publicado entre **1 e 6 meses** | **Trava de data:** se a data for ambígua ou `> 6 meses`, travar no máximo em **`2`** |
| **`icp_fit`** | Fisioterapeuta autônomo, domiciliar, clínica 1–5 salas ou estúdio de Pilates no Brasil | Profissional de saúde correlato ou clínica em transição | Paciente, vaga de emprego, vendedor ou mega-clínica |
| **`reachability`** | Telefone/WhatsApp público + `@instagram` ou e-mail direto | Apenas rede social/link de comentário público | Sem canal público de contato adequado |

## 2. Checagem Obrigatória de Contra-Evidência
Para cada candidato, o filtro local (`Ollama mimo-v2.6/gemma4` ou `OpenCode Free`) responde explicitamente:
* `is_patient_seeking_care`: `true | false`
* `is_seller_or_recruiter`: `true | false`
* `already_uses_competitor_happily`: `true | false`
* `counter_evidence_passed`: só é `true` quando **todos os 3 acima são `false`**.

> Se `counter_evidence_passed === false`, o score final `0–5` é limitado a no máximo **`1.5`** e o candidato é marcado como **descartado** no plano de aprovação.

## 3. Conversão Determinística para `platform_auto_leads.ai_score` (0–100)
```text
raw_avg_5 = (
  evidence_strength * 0.25 +
  pain_severity     * 0.25 +
  timing_urgency    * 0.20 +
  icp_fit           * 0.20 +
  reachability      * 0.10
)

ai_score = counter_evidence_passed
  ? clamp(round(raw_avg_5 * 20), 10, 100)
  : clamp(round(raw_avg_5 * 10), 5, 35)
```

* `intent_score_5 >= 3.8` (`ai_score >= 76`) → **Prioridade Máxima (Onda 1 após aprovação)**
* `intent_score_5 >= 3.0` (`ai_score >= 60`) → **Qualificado (Onda 2 após aprovação)**
* `< 3.0` → **Manter apenas como observação ou descartar**
