# Lovable Handoff

## Objetivo

Este arquivo serve como fonte de verdade para pedidos feitos ao Lovable.

Como o Lovable tem limite diario de uso e, neste projeto, ele e o caminho pratico para aplicar mudancas no Supabase remoto, cada uso deve tentar resolver um bloco inteiro de trabalho de ponta a ponta.

## Como usar

Antes de abrir o Lovable, atualize a secao `Current Tasks` deste arquivo.

Depois, envie ao Lovable algo como:

```text
Leia o arquivo LOVABLE_HANDOFF.md deste repositorio e execute tudo o que estiver na secao "Current Tasks".

Siga exatamente as regras do arquivo, principalmente:
- aplicar no Supabase qualquer migration nova necessaria;
- manter as migrations versionadas em supabase/migrations;
- subir o codigo atualizado para o GitHub ao final;
- informar claramente o que foi alterado, quais migrations foram criadas/aplicadas e o que ficou pendente.
```

## Regras fixas para o Lovable

1. Leia este arquivo inteiro antes de implementar qualquer mudanca.
2. Execute todas as tarefas nao concluidas da secao `Current Tasks` em uma unica rodada, quando isso for viavel.
3. Nao altere arquivos ou dependencias sem necessidade.
4. Preserve o padrao visual e estrutural atual do sistema, salvo quando a tarefa pedir uma mudanca explicita de UX/UI.
5. Se uma tarefa exigir mudanca de banco, RLS, RPC, auth, storage ou qualquer comportamento acoplado ao Supabase:
   - crie a migration correspondente em `supabase/migrations`;
   - aplique essa migration no projeto Supabase conectado dentro do proprio Lovable;
   - mantenha o repositorio e o banco sincronizados.
6. Nunca faca mudanca manual no banco sem deixar a migration versionada no repositorio.
7. Se tipos do Supabase precisarem ser atualizados por causa de schema novo, atualize tambem os tipos gerados usados no app.
8. Ao finalizar, suba o codigo para o GitHub.
9. No resumo final, informe:
   - arquivos alterados;
   - migrations criadas;
   - se as migrations foram aplicadas com sucesso no Supabase;
   - se houve push para o GitHub;
   - o que ainda ficou pendente ou bloqueado.

## Checklist rapido para tarefas com banco

Sempre que alguma tarefa tocar no banco, o Lovable deve:

- criar migration em `supabase/migrations`;
- aplicar a migration no Supabase remoto;
- validar se o app continua funcionando;
- sincronizar codigo e schema;
- subir tudo para o GitHub.

## Current Tasks

Use este formato:

- [ ] Titulo curto da tarefa
  Contexto:
  Resultado esperado:
  Restricoes:
  Precisa de migration?: sim/nao
  Criterios de aceitacao:

Exemplo:

- [ ] Ajustar fluxo de compartilhamento com paciente
  Contexto:
  O formulario compartilhado precisa bloquear nova edicao depois da conclusao.
  Resultado esperado:
  O paciente envia uma vez, o formulario fica bloqueado e aparece a mensagem final.
  Restricoes:
  Nao quebrar o cadastro interno da equipe.
  Precisa de migration?: sim
  Criterios de aceitacao:
  O link continua funcionando, o envio cria ou atualiza os dados corretamente e a migration fica aplicada no Supabase remoto.

Adicione abaixo as tarefas reais antes de chamar o Lovable:

- [ ] Preencher aqui a proxima demanda
  Contexto:
  Resultado esperado:
  Restricoes:
  Precisa de migration?:
  Criterios de aceitacao:

## Definition of Done

Uma rodada do Lovable so deve ser considerada concluida quando:

- o codigo estiver implementado;
- qualquer migration necessaria existir em `supabase/migrations`;
- a migration tiver sido aplicada no Supabase remoto pelo proprio Lovable;
- as alteracoes tiverem sido enviadas ao GitHub;
- o resumo final disser claramente o que foi feito e o que nao foi feito.
