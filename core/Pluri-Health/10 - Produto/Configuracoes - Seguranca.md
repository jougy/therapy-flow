---
tags:
  - produto
  - seguranca
  - configuracoes
kind: spec
area: produto
aliases:
  - Configuracoes - Seguranca
  - Seguranca
  - security_conf
---
# Configuracoes > Seguranca

## Objetivo

Este arquivo redefine a proposta da subpagina `Configuracoes > Seguranca` para que ela nao entre em conflito com outras areas que ja existem ou que ja estao claramente separadas dentro de `Configuracoes`.

A ideia central e simples:

- `Seguranca` nao deve virar uma segunda versao de `Editar perfil`;
- `Seguranca` nao deve virar uma segunda versao de `Colaboradores e acessos`;
- `Seguranca` nao deve virar uma segunda versao de `Assinatura e pagamentos`;
- `Seguranca` deve focar em protecao da conta, sessoes, autenticacao, alertas e historico de eventos sensiveis.

## Limite desta subpagina

Para evitar redundancia, esta pagina nao deve ser o lugar principal para:

- editar dados pessoais comuns do usuario;
- editar dados institucionais da clinica;
- gerenciar subcontas e papeis;
- alterar limites de plano;
- administrar financeiro, cobranca ou tesouraria.

Essas responsabilidades ficam melhor distribuidas assim:

- `Editar perfil`: dados cadastrais e pessoais da propria conta
- `Perfil da clinica`: dados institucionais e marca da clinica
- `Colaboradores e acessos`: subcontas, papeis, status e dados administrativos da equipe
- `Assinatura e pagamentos`: plano, cobranca e limites comerciais
- `Seguranca`: protecao de acesso e rastreabilidade basica

## O que a pagina de Seguranca deve ser

Ela deve ser uma area de confianca e protecao.

Ou seja, o usuario entra nessa subpagina para responder perguntas como:

- Minha conta esta protegida?
- Tem alguma sessao aberta que eu nao reconheco?
- Quando foi meu ultimo acesso?
- Minha senha foi alterada recentemente?
- Houve alguma acao sensivel relevante nesta conta?
- Se eu sou admin, houve alguma acao critica recente envolvendo acessos?

## Estrutura sugerida

A subpagina pode ser organizada em 4 blocos principais:

1. Acesso da minha conta
2. Sessoes e dispositivos
3. Alertas e protecoes
4. Historico de eventos sensiveis

Para `owner/admin` do plano `clinic`, pode existir um quinto bloco:

5. Visao administrativa de seguranca

## 1. Acesso da minha conta

Este e o bloco mais pessoal e mais universal da pagina.

Opcoes sugeridas:

- Alterar senha
- Ver data e hora do ultimo acesso
- Ver data e hora da ultima alteracao de senha
- Ver se a conta esta com senha provisoria ou definitiva
- Encerrar todas as outras sessoes

O que nao deve entrar aqui:

- nome, telefone, CPF, especialidade, cargo, endereco

Esses dados pertencem a `Editar perfil` ou `Colaboradores e acessos`, nao a `Seguranca`.

## 2. Sessoes e dispositivos

Este bloco deve mostrar onde a conta esta aberta.

Opcoes sugeridas:

- listar a sessao atual
- listar outras sessoes abertas
- mostrar navegador e ultima atividade aproximada
- marcar qual sessao e a atual
- encerrar uma sessao especifica
- encerrar todas as outras sessoes

Para o MVP, isso ja seria suficiente:

- `Sessao atual`
- `Outras sessoes`
- `Ultimo acesso`
- `Encerrar outras sessoes`

Nao precisa transformar esse bloco em uma tela tecnica demais.

## 3. Alertas e protecoes

Este bloco trata de notificacoes e sinais de risco.

Opcoes sugeridas:

- Receber alerta por e-mail ao trocar senha
- Receber alerta por e-mail em novo login relevante
- Receber alerta por e-mail quando a conta for desconectada de outros dispositivos
- Receber alerta por e-mail quando houver alteracao de acesso importante

No plano `clinic`, alguns alertas adicionais podem fazer sentido para `owner/admin`:

- alerta de criacao de subconta
- alerta de mudanca de papel operacional
- alerta de reset de senha de subconta
- alerta de bloqueio ou reativacao de subconta

Importante:

- a configuracao do alerta mora em `Seguranca`;
- a acao administrativa em si continua morando em `Colaboradores e acessos`.

Essa separacao evita conflito entre as subpaginas.

## 4. Historico de eventos sensiveis

Esse bloco deve registrar eventos importantes ligados a protecao da conta.

Exemplos de eventos:

- senha alterada
- nova sessao iniciada
- outras sessoes encerradas
- logout forcado
- reset de senha executado por administrador
- papel de acesso alterado

Cada evento deve tentar mostrar:

- o que aconteceu
- quando aconteceu
- quem executou, se aplicavel
- em qual conta ocorreu, se aplicavel

Para o MVP, esse historico pode ser curto e objetivo.

Nao precisa ser uma auditoria completa ainda.

## 5. Visao administrativa de seguranca

Este bloco so deve aparecer para `owner/admin` no plano `clinic`.

Mesmo aqui, ele nao deve duplicar `Colaboradores e acessos`.

Entao, a ideia nao e editar subcontas por aqui, e sim acompanhar sinais de risco e acoes sensiveis.

Exemplos do que pode entrar:

- ultimo acesso da equipe
- subcontas com senha provisoria
- subcontas sem ultimo acesso recente
- subcontas com muitas trocas de senha
- historico recente de eventos administrativos de seguranca

Exemplos do que nao deve entrar:

- editar cargo
- editar especialidade
- editar horario de trabalho
- editar papel operacional diretamente
- criar nova subconta
- editar dados cadastrais completos da subconta

Tudo isso continua em `Colaboradores e acessos`.

## Diferenca entre Solo e Clinic

### Plano solo

No plano `solo`, a pagina `Seguranca` pode ser bem enxuta e centrada no proprio usuario:

- alterar senha
- ver ultimo acesso
- gerenciar sessoes abertas
- configurar alertas basicos
- ver historico de eventos sensiveis

Nao deve ter:

- visao administrativa da equipe
- eventos de subcontas
- qualquer bloco relacionado a colaboradores

### Plano clinic

No plano `clinic`, todos os usuarios podem ter a parte de seguranca da propria conta.

Mas a parte administrativa de seguranca deve ser restrita a `owner/admin`.

Assim fica coerente com a regra atual da plataforma:

- todos cuidam da propria seguranca;
- apenas administradores cuidam da seguranca operacional da equipe.

## Regras de acesso sugeridas

### Todos os usuarios

Podem:

- alterar a propria senha
- ver o proprio ultimo acesso
- ver as proprias sessoes
- encerrar as proprias outras sessoes
- configurar alertas pessoais de seguranca
- ver o proprio historico basico de eventos de seguranca

### Owner e admin do plano clinic

Podem tambem:

- ver o bloco administrativo de seguranca
- ver eventos sensiveis relacionados a acessos da equipe
- ver sinais simples de risco operacional ligados a subcontas

Mas mesmo eles nao devem usar essa subpagina para editar dados de subconta.

### Professional e assistant do plano clinic

Devem ver apenas a parte da propria conta.

Nao devem ver:

- eventos administrativos da equipe
- alertas de seguranca da clinica como um todo
- listas operacionais de subcontas dentro desta pagina

## Dados que fazem sentido exibir

### Na propria conta

- e-mail de acesso
- ultimo acesso
- ultima troca de senha
- quantidade de sessoes abertas
- status de alertas ativados

### Na visao administrativa

- nome do colaborador
- papel operacional
- status de atividade
- ultimo acesso
- ultimo evento sensivel relevante

Evitar aqui:

- CPF
- endereco
- telefone pessoal completo sem necessidade
- dados detalhados de perfil

Esses dados pertencem a outras subpaginas.

## MVP recomendado

Para a primeira versao realmente util, eu priorizaria:

1. Alterar senha
2. Ver ultimo acesso
3. Listar sessoes abertas
4. Encerrar outras sessoes
5. Alertas basicos por e-mail
6. Historico curto de eventos sensiveis
7. No plano `clinic` e so para `owner/admin`: visao resumida de eventos administrativos de seguranca

Isso entrega valor real sem embaralhar responsabilidades com outras areas de `Configuracoes`.

## O que pode entrar depois

Quando a plataforma amadurecer, esta pagina pode crescer para incluir:

- autenticacao em dois fatores
- codigos de recuperacao
- dispositivos confiaveis
- regras configuraveis de expiracao de sessao
- politica minima de senha por clinica
- historico administrativo mais completo
- aprovacoes extras para acoes muito sensiveis

Mas isso deve vir depois, quando a estrutura basica ja estiver bem resolvida.

## Sugestao de UX

Para ficar coerente com o restante da plataforma:

- cards separados por contexto
- textos curtos e muito objetivos
- destaque visual para acoes de risco
- informacoes de tempo sempre visiveis em formato claro
- acoes destrutivas com confirmacao

Exemplo de ordem visual:

1. `Acesso da minha conta`
2. `Sessoes e dispositivos`
3. `Alertas e protecoes`
4. `Historico de eventos sensiveis`
5. `Visao administrativa de seguranca` quando aplicavel

## Relacao com outras subpaginas

Esta proposta deve ser lida junto com:

- [[Clinica e colaborador no MVP]]
- [[Hierarquias de colaboradores e acessos]]
- [[Configuracoes - Desenvolvimento da equipe]]
- `Configuracoes > Editar perfil`
- `Configuracoes > Colaboradores e acessos`
- `Configuracoes > Assinatura e pagamentos`

## Objetivo desta nota

Este arquivo deve orientar uma implementacao de `Seguranca` que seja:

- util;
- coerente com a arquitetura atual;
- sem redundancia com outras subpaginas;
- simples o bastante para o MVP;
- preparada para crescer depois.

## Notas relacionadas

- [[Core do projeto]]
- [[Clinica e colaborador no MVP]]
- [[Hierarquias de colaboradores e acessos]]
- [[Configuracoes - Desenvolvimento da equipe]]
