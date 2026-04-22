---
tags:
  - produto
  - equipe
  - configuracoes
kind: spec
area: produto
aliases:
  - Configuracoes - Desenvolvimento da equipe
  - Desenvolvimento da equipe
  - dev_equipe_config
---
# Configuracoes > Desenvolvimento da equipe

## Objetivo

Este arquivo descreve a estrategia inicial para a subpagina `Configuracoes > Desenvolvimento da equipe`.

A ideia desta area e acompanhar evolucao profissional, rotina, alinhamento e maturidade operacional da equipe da clinica, sem conflitar com:

- `Editar perfil`
- `Perfil da clinica`
- `Colaboradores e acessos`
- `Seguranca`
- `Assinatura e pagamentos`

## Limite desta subpagina

Para evitar redundancia, esta subpagina nao deve ser o lugar principal para:

- criar subcontas;
- editar dados cadastrais completos de colaboradores;
- alterar cargos, especialidades, status ou papeis de acesso;
- resetar senha;
- gerenciar sessoes, alertas ou eventos de seguranca;
- administrar cobranca, plano ou tesouraria.

Essas responsabilidades ficam melhor distribuidas assim:

- `Editar perfil`: dados da propria conta
- `Perfil da clinica`: dados institucionais da clinica
- `Colaboradores e acessos`: cadastro administrativo, papeis, status, hierarquia e subcontas
- `Seguranca`: senha, sessoes, alertas e eventos sensiveis
- `Desenvolvimento da equipe`: evolucao, acompanhamento e organizacao do crescimento da equipe

## O que esta subpagina deve ser

Ela deve responder perguntas como:

- Como esta a evolucao da equipe dentro da clinica?
- Quem esta ativo e engajado na rotina?
- Quem esta no onboarding e ainda precisa de acompanhamento?
- Quem precisa de treinamento, supervisao ou alinhamento?
- Como organizar objetivos internos sem criar um sistema pesado de RH?

Essa area deve ser mais de acompanhamento e desenvolvimento do que de controle formal.

## Diferenca em relacao a Colaboradores e acessos

Essa separacao precisa ficar muito clara.

### Colaboradores e acessos

Foca em:

- quem faz parte da clinica;
- qual o papel operacional;
- qual o status da conta;
- quais dados administrativos a subconta possui;
- quem pode acessar o que.

### Desenvolvimento da equipe

Foca em:

- como cada colaborador esta evoluindo;
- como esta a rotina de acompanhamento interno;
- quais pendencias de onboarding e treinamento existem;
- quais metas e checkpoints internos estao em aberto;
- como visualizar maturidade e engajamento da equipe.

## Regras gerais

- Esta subpagina so faz sentido no plano `clinic`.
- Usuarios do plano `solo` nao precisam ver essa area.
- Nem todo colaborador precisa ter o mesmo nivel de visibilidade aqui.
- O ideal no MVP e separar:
  - visao administrativa da equipe
  - visao pessoal do proprio desenvolvimento

## Estrutura sugerida da subpagina

A pagina pode ser organizada em 5 blocos:

1. Panorama da equipe
2. Onboarding e adaptacao
3. Desenvolvimento individual
4. Treinamentos e alinhamentos
5. Sinais operacionais da equipe

## 1. Panorama da equipe

Este bloco serve para dar uma visao geral rapida.

Opcoes sugeridas:

- quantidade total de colaboradores ativos
- quantidade em onboarding
- quantidade com pendencias de desenvolvimento
- quantidade com acompanhamento em dia
- distribuicao por papel operacional

Esse bloco e mais de leitura e orientacao.

Ele nao deve virar painel financeiro nem painel de seguranca.

## 2. Onboarding e adaptacao

Esse bloco ajuda a acompanhar entrada de novos colaboradores.

Opcoes sugeridas:

- quem entrou recentemente
- quem ainda nao completou o perfil minimo
- quem ainda nao acessou a plataforma
- quem ainda nao concluiu itens basicos de onboarding
- checklist simples de adaptacao

Exemplos de checklist:

- primeiro acesso realizado
- perfil basico preenchido
- senha definitiva configurada
- leitura do fluxo clinico interno
- treinamento inicial concluido

Importante:

- o dado cadastral em si continua em `Colaboradores e acessos`;
- aqui aparece apenas o progresso de adaptacao.

## 3. Desenvolvimento individual

Este bloco e o coracao da subpagina.

Ele serve para acompanhar cada colaborador ao longo do tempo.

Opcoes sugeridas:

- status de desenvolvimento
- nivel atual interno
- objetivos em aberto
- feedback mais recente
- proxima revisao agendada
- observacoes internas de acompanhamento

Exemplos de status de desenvolvimento:

- em onboarding
- em evolucao
- consolidado
- precisa de supervisao
- em pausa

Exemplos de nivel interno:

- estagiario
- junior
- pleno
- senior
- referencia interna

Observacao importante:

- isso nao substitui o `cargo` administrativo;
- isso pode coexistir com o cargo, mas com outro objetivo.

Por exemplo:

- `cargo`: Fisioterapeuta
- `nivel interno de desenvolvimento`: Junior

## 4. Treinamentos e alinhamentos

Este bloco e voltado para organizacao interna de aprendizado.

Opcoes sugeridas:

- registrar treinamentos internos
- marcar participacao em treinamento
- marcar treinamentos pendentes
- registrar alinhamentos clinicos
- registrar supervisoes tecnicas
- registrar revisoes de processo

Para o MVP, isso pode ser bem leve:

- titulo do treinamento
- data
- participantes
- status
- observacao curta

Nao precisa nascer como LMS nem como plataforma de cursos.

## 5. Sinais operacionais da equipe

Este bloco usa sinais da propria plataforma para ajudar a observar a equipe.

Exemplos:

- ultimo acesso
- quantidade recente de atendimentos criados
- quantidade recente de atendimentos finalizados
- formularios mais usados
- colaborador com baixa atividade recente
- colaborador com uso consistente da rotina

Importante:

- isso nao deve virar vigilancia invasiva;
- o foco deve ser apoio de gestao e alinhamento;
- o ideal e mostrar tendencia operacional simples, nao controle excessivo.

## O que pode entrar no MVP

Se fosse priorizar uma primeira versao realmente util, eu faria:

1. Panorama da equipe
2. Lista de colaboradores com status de desenvolvimento
3. Campo de observacao interna por colaborador
4. Data da ultima revisao e proxima revisao
5. Checklist simples de onboarding
6. Sinais operacionais basicos:
   - ultimo acesso
   - atendimentos recentes

Isso ja gera valor real sem exigir um modulo grande demais.

## O que pode ficar para depois

- trilha completa de carreira
- metas individuais avancadas
- comparativos de desempenho
- biblioteca de treinamentos
- certificacoes internas
- historico detalhado de feedbacks
- score automatico de maturidade
- dashboard analitico mais sofisticado

## Proposta de acesso

### Plano solo

Nao deve exibir esta subpagina.

### Plano clinic

#### Owner e admin

Podem:

- ver panorama geral da equipe
- acompanhar onboarding
- registrar evolucao individual
- registrar treinamentos e revisoes
- ver sinais operacionais agregados

#### Professional

Pode, no MVP, ter uma visao limitada:

- ver o proprio status de desenvolvimento
- ver seus proprios checkpoints
- ver seus treinamentos e revisoes

Nao deve ver:

- observacoes internas dos colegas
- panorama administrativo completo da equipe

#### Assistant

Pode ficar sem acesso no MVP, ou com acesso apenas ao proprio desenvolvimento se isso fizer sentido depois.

## Dados que fazem sentido nesta subpagina

### Dados bons para mostrar

- nome
- papel operacional
- especialidade
- nivel interno de desenvolvimento
- status de desenvolvimento
- data da ultima revisao
- proxima revisao
- ultimo acesso
- indicadores operacionais simples

### Dados que nao devem ser foco aqui

- CPF
- endereco
- telefone completo
- dados sensiveis de seguranca
- historico tecnico de sessoes abertas
- dados financeiros

## Sugestao de UX

Para manter coerencia com o resto da plataforma:

- topo com resumo em cards
- lista principal de colaboradores em blocos
- filtros simples:
  - status de desenvolvimento
  - papel operacional
  - especialidade
- bloco expandivel por colaborador
- tags visuais para nivel e status

Essa tela pode conversar bem com a interface ja existente de `Colaboradores e acessos`, mas sem repetir os mesmos formulários.

## Possivel estrutura de dados futura

Se essa area virar implementacao, uma base simples poderia incluir algo como:

- `team_development_profiles`
- `team_development_reviews`
- `team_training_records`
- `team_onboarding_checklists`

Mas isso deve ser tratado depois, quando a estrategia estiver fechada.

## Conflitos evitados por esta proposta

Esta estrategia evita conflito com outras subpaginas porque:

- nao usa `Seguranca` para falar de desenvolvimento;
- nao usa `Colaboradores e acessos` para falar de evolucao profissional;
- nao usa `Editar perfil` para acompanhamento interno;
- nao usa `Perfil da clinica` para gestao de equipe;
- nao usa `Assinatura` para indicadores de colaborador.

## Objetivo desta nota

Este arquivo serve para orientar o desenho da subpagina `Configuracoes > Desenvolvimento da equipe` sem misturar:

- gestao administrativa;
- controle de acesso;
- seguranca;
- faturamento;
- perfil institucional.

O foco aqui deve ser:

- onboarding;
- desenvolvimento;
- alinhamento;
- sinais operacionais simples;
- apoio a uma gestao de equipe leve no MVP.

## Notas relacionadas

- [[Core do projeto]]
- [[Clinica e colaborador no MVP]]
- [[Hierarquias de colaboradores e acessos]]
- [[Configuracoes - Seguranca]]
