---
name: monolith-slicer
description: Padrão de estrangulamento incremental para fatiar arquivos >500 linhas (ex. PacienteDetalhe.tsx, SessaoDetalhe.tsx) em subpastas modulares com barrel leve, sem quebrar imports.
---

# Monolith Slicer (Pluri-Health)

1. **Quando aplicar:**
   - Sempre que precisar editar um arquivo acima de **500 linhas** (monolito legado) ou criar um módulo novo.
2. **Estratégia de Estrangulamento Incremental:**
   - **Não reescreva o arquivo inteiro de uma vez.** Extraia apenas a aba, modal, hook ou seção que você está alterando.
   - Crie uma subpasta dedicada (ex.: `src/pages/paciente-detalhe/` ou `components/`).
   - Mova o bloco para um arquivo focado (`< 250` linhas), tipado com os tipos fatiados de `src/integrations/supabase/types/` (nunca importe `database.ts` inteiro).
   - Reexporte se necessário pelo arquivo original (barrel leve) para manter compatibilidade de rotas/imports.
3. **Validação:**
   - Rode `npm run check:monoliths`, `npm run check:types` e `npm run check:quick`.
