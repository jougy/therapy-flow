# ROTEIRO DE FALA — Tutorial Pluri Health (vídeo único, 7–10 min)

> **Instruções:** texto literal, palavra a palavra. Notas de tela entre `[...]`. Tempos estimados por seção.
> **Público-alvo:** fisioterapeutas, 25–35 anos, pouca experiência com tecnologia — linguagem simples, acolhedora, sem jargões.

---

## 0. ABERTURA `[0:00 – 0:30]` (~75 palavras)

`[Tela: home do Pluri Health, logo em destaque]`

Oi, tudo bem? Se você é fisioterapeuta e quer organizar sua rotina clínica sem complicação, esse vídeo é pra você.

Em menos de dez minutos eu vou te mostrar tudo o que o Pluri Health faz: desde criar sua conta, até gerenciar pacientes, agenda, atendimentos e pagamentos.

Pode ficar tranquila — não precisa ter familiaridade com tecnologia. É só me acompanhando clicando junto. Bora?

---

## 1. LOGIN E CRIAR CONTA `[0:30 – 1:20]` (~110 palavras)

`[Tela: /auth — cartão "Entrar"]`

Primeiro, vamos acessar. Aqui na tela de login, você digita seu e-mail e sua senha, e clica em **Entrar**. Se um dia você esquecer a senha, é só clicar em **Esqueci minha senha** que o sistema te ajuda a recuperar.

`[Tela: /auth/cadastro — formulário "Criar conta"]`

Ainda não tem conta? Clique em **Criar conta**. O cadastro é rápido: nome completo, data de nascimento, contato no WhatsApp, sua profissão com o número do conselho — no caso da fisio, o CREFITO —, e-mail e senha.

Confira tudo e clique em **Criar conta**. Pronto: sua conta pessoal está criada.

---

## 2. ESPAÇO PESSOAL `[1:20 – 2:30]` (~155 palavras)

`[Tela: /espacopessoal — título "Espaço pessoal", menu lateral]`

Esse aqui é o seu **Espaço pessoal**. Ele é seu — não de nenhuma clínica. É de onde você acessa tudo. Repare nesse menu lateral, tem cinco opções.

**Clínicas**: é a lista das clínicas em que você trabalha. Se alguém te convidar pra uma clínica nova, o convite aparece aqui, e você aceita com um clique.

`[Destaque: item "Minhas Estatísticas"]`

**Minhas Estatísticas**: seu resumo pessoal — total de pacientes atendidos, total de atendimentos, e gráficos da sua evolução.

`[Destaque: item "Meu Portfólio"]`

**Meu Portfólio**: seu acervo técnico, com todos os atendimentos que você já fez. Fica tudo registrado de forma segura, em conformidade com a LGPD.

`[Destaque: item "Novidades"]`

**Novidades**: o histórico de atualizações da plataforma. Sempre que sai função nova, você fica sabendo aqui.

E **Configurações**: onde você edita seu perfil, sua senha e suas notificações. Simples assim.

---

## 3. DENTRO DA CLÍNICA `[2:30 – 4:00]` (~200 palavras)

`[Tela: home da clínica /clinica/:key/]`

Agora vamos entrar em uma clínica. Essa é a tela principal, onde você vai passar a maior parte do tempo.

`[Destaque: barra de busca "Buscar paciente, CPF ou telefone..."]`

No topo tem a **barra de busca**. Digite o nome, o CPF ou o telefone, e o paciente aparece na hora.

`[Destaque: botão "Filtro" e "Ordem"]`

Ao lado, **Filtros**: você pode filtrar por status de pagamento, por grupo, por colaborador, por período. E **Ordem**: escolha se quer a lista por nome, por pacientes mais recentes, por quantidade de sessões...

`[Destaque: abas "Pacientes" | "Atendimentos"]`

Aqui embaixo, duas abas: **Pacientes** e **Atendimentos** — troque entre elas pra ver a lista que preferir.

`[Destaque: botão "Novo Paciente"]`

Pra cadastrar alguém, clique em **Novo Paciente** — já vou mostrar como funciona.

`[Destaque: widget "Agenda"]`

O widget de **Agenda** mostra os agendamentos de hoje, e o botão **Ver agenda completa** leva pra agenda inteira.

`[Destaque: botão "Estatísticas"]`

E o botão **Estatísticas** abre o resumo geral da clínica: total de atendimentos, receita, cancelamentos, tudo em gráfico.

`[Zoom: card de um paciente — símbolos]`

Por último, repare nos símbolos dos cards. O **♀ ou ♂** é o gênero. O selo colorido mostra o status: ativo, pausado, inativo. O círculo com **cifrão** é o financeiro: pago, pendente ou em crédito. O **relógio** é o próximo agendamento — azul pra futuro, verde pra hoje. E a pílula com as letras **D, S, T, Q...** são os dias da semana fixos desse paciente.

---

## 4. CRIANDO UM NOVO PACIENTE `[4:00 – 5:00]` (~145 palavras)

`[Tela: /pacientes/novo — formulário "Pré-Cadastro"]`

Clicando em **Novo Paciente**, você vê esse formulário de pré-cadastro. É bem direto: nome completo, data de nascimento, documento, gênero, WhatsApp e e-mail. Preencha e clique em **Concluir Pré-Cadastro**.

`[Destaque: aviso "Paciente menor de idade"]`

Repare numa coisa importante: se a data de nascimento indicar que é menor de idade, o sistema avisa na hora e pede os dados do responsável legal — isso é exigência da LGPD, e o Pluri Health já cuida disso sozinho.

`[Tela: modal "Compartilhamento Seguro"]`

Agora, um recurso que economiza muito tempo: em vez de você preencher tudo, clique em **Compartilhar agora**. Um link seguro é gerado com senha de acesso — é só mandar pro paciente pelo WhatsApp, e ele mesmo completa o próprio cadastro.

Se preferir, clique em **Preencher cadastro completo agora** e você mesma preenche as oito abas do prontuário. E claro: qualquer coisa pode ser editada depois, em **Editar cadastro**.

---

## 5. PÁGINA DO PACIENTE `[5:00 – 6:10]` (~170 palavras)

`[Tela: página do paciente /pacientes/:id]`

Esse é o prontuário do paciente. Vamos aos destaques.

`[Destaque: botão "Resumo clínico"]`

**Resumo clínico**: um panorama rápido — pontos de atenção pra consulta rápida e histórico resumido. Perfeito quando o paciente chega e você precisa se lembrar de tudo em segundos.

`[Destaque: alertas do cabeçalho "Alergias", "Risco de queda"]`

Repare nesses alertas aqui em cima: alergias, risco de queda, outros riscos. São os **indicadores de atenção** — fiquem sempre visíveis pra ninguém errar.

`[Destaque: menu "Opções"]`

No menu **Opções**, você encontra **Ver cadastro completo**, e **Imprimir cadastro (PDF)** — sai um dossiê diagramado em A4, com termo de consentimento incluso.

`[Destaque: widget de agenda interno]`

A agenda interna permite **Agendar** nova sessão direto daqui.

E o botão mais importante: **Iniciar atendimento agora**. É nele que a mágica acontece.

---

## 6. DENTRO DO ATENDIMENTO `[6:10 – 7:10]` (~155 palavras)

`[Tela: página da sessão]`

Dentro do atendimento, a primeira aba é **Presença**: registre o **horário agendado**, o **horário de chegada** e o início real da sessão — até atraso fica registrado.

`[Destaque: abas "Anamnese" | "Arquivos" | "Tratamento" | "Pagamento"]`

Na aba **Anamnese**, você responde as fichas da clínica e a escala de dor, o EVA. Em **Arquivos**, anexe exames e documentos. Em **Tratamento**, registre conduta e evolução.

`[Destaque: abas de pagamento "Avulso" | "Pacote" | "Cortesia"]`

Na aba **Pagamento**, escolha se é avulso, cortesia, ou de um **pacote**. Pra pacote, é só nomear — como *Pacote de 10 Sessões* —, colocar quantidade, valor e dias da semana. O sistema desconta cada sessão automaticamente.

Tudo fica salvo em rascunho, e ao finalizar: *atendimento concluído e registrado no prontuário*.

---

## 7. ABA ATENDIMENTOS DO PACIENTE `[7:10 – 8:00]` (~130 palavras)

`[Tela: aba "Atendimentos" do paciente]`

Voltando ao prontuário, a aba **Atendimentos** traz toda a linha do tempo do paciente.

Use a busca **Buscar no prontuário** pra achar qualquer sessão. E repare nesse interruptor: **Detalhado** ou **Compacto** — detalhado mostra tudo; compacto deixa a lista limpa e rápida.

`[Destaque: card de sessão com resumo]`

Cada card traz o **resumo da sessão**: data, status, tags, indicadores como *EVA 7 de 10*, e botões como **Evoluir**.

`[Destaque: aba "Estatísticas"]`

E na aba **Estatísticas**, o dashboard do paciente: média geral, mínimo, máximo — tudo em gráfico. Dá até pra imprimir ou ir direto pro gerenciador de formulários.

---

## 8. AGENDA COMPLETA `[8:00 – 8:30]` (~75 palavras)

`[Tela: /agenda — título "Agenda da Clínica"]`

A agenda completa tem **quatro visões**. Escolha aqui em cima:

**Ano**, pra enxergar o grande panorama; **Mês**, pra visão geral do calendário; **Semana**, pra planejar os seus dias; e **Dia**, com hora a hora, pra executar.

Use o botão **Hoje** pra voltar sempre ao dia atual, e **Novo Agendamento** pra criar qualquer compromisso — atendimento, reunião ou lembrete.

---

## 9. GERENCIADOR DE FORMULÁRIOS `[8:30 – 9:20]` (~130 palavras)

`[Tela: /configuracoes/formularios — "Gerenciar formulários"]`

Aqui você personaliza a anamnese da sua clínica. Tudo em duas abas.

A primeira é o **Bloco Padrão Universal**: é a parte obrigatória da anamnese, aplicada em *todas* as fichas, antes de qualquer ficha complementar. Você edita uma vez e vale pra clínica inteira.

A segunda é **Fichas Complementares**: são as fichas extras, específicas de cada tratamento ou linha de cuidado. Clique em **Nova ficha** pra criar.

E tem a **Biblioteca de Modelos**: modelos feitos pela comunidade, com pré-visualização interativa, que você importa com um clique. E se quiser, pode publicar os seus.

---

## 10. CONFIGURAÇÕES DA CLÍNICA `[9:20 – 10:00]` (~120 palavras)

`[Tela: /configuracoes — "Configurações da Clínica"]`

Por fim, as configurações da clínica, nesses itens:

**Perfil da clínica**: dados institucionais, logotipo e endereço.

**Colaboradores e acessos**: convites e papéis — dono, admin, profissional, assistente, estagiário. Cada um com seu nível de acesso.

**Segurança da clínica**: sessões ativas e auditoria de dados.

**Assinatura e pagamentos**: seu plano, faturas e formas de pagamento.

**Termos da clínica**: os modelos de consentimento de adultos e permissão dos pais.

E **Lixeira**: tudo que foi excluído fica guardado e pode ser recuperado.

---

## 11. ENCERRAMENTO `[10:00 – 10:20]` (~55 palavras)

`[Tela: home da clínica, depois logo Pluri Health]`

E é isso! Viu como é mais simples do que parece? Crie sua conta, aproveite os **7 dias de teste gratuito** e comece hoje a organizar sua prática clínica.

Se gostou, deixa o like e se inscreve — nos próximos vídeos eu mostro os recursos avançados de gestão financeira. Até a próxima!

---

**Total estimado:** ~1.470 palavras ≈ **10 min** em ritmo calmo e didático (≈145 palavras/min). Se quiser fechar em 8 min, corte os blocos 8 (Agenda) e 9 (Formulários) pela metade — são os mais autoexplicativos.
