---
tags:
  - referencia
  - frontend
  - inputs
kind: inventory
area: engenharia
aliases:
  - Inventario de inputs
  - INVENTARIO_INPUTS
updated: '2026-05-28'
---
# Inventario de Inputs do Therapy Flow

Atualizado em `2026-05-28` a partir de varredura em `src/`.

## Escopo desta varredura

Comando-base usado para localizar campos:

```bash
rg -n "(<Input|<Textarea|<Select\b|<Checkbox\b|<RadioGroup\b|<Switch\b|<CommandInput\b|<input\b|<textarea\b|<select\b|<Slider\b|DateFieldInput)" src --glob '*.{ts,tsx}' --glob '!**/*.test.*' --glob '!src/components/ui/**'
```

- Inclui paginas e componentes que renderizam campos reais de entrada de dados.
- Inclui campos dinamicos gerados por schema quando o componente renderiza o controle final.
- Exclui testes.
- Exclui wrappers genericos em `src/components/ui/*`.
- Linhas sao referencias atuais aproximadas da varredura, uteis para retomar auditoria.

## Resumo de areas com entrada de dados

- Autenticacao: documento do owner, email, senha.
- Home/lista de pacientes: busca, ordenacao, filtros por status, origem, pagamento, agenda, recorrencia, grupos, colaborador, periodo e dias da semana.
- Agenda: selecao/criacao de evento, data/hora, alteracao de status.
- Cadastro de paciente: dados pessoais, origem, contato, endereco, alertas, historico clinico, emergencia, funcionalidade e observacoes.
- Cadastro compartilhado: senha numerica do link, cadastro do paciente e campos clinicos equivalentes ao cadastro completo.
- Detalhe do paciente: status, filtros de atendimentos, acoes em massa, grupo, recorrencia, agenda e link de compartilhamento.
- Sessao/atendimento: ficha dinamica, presenca, pagamento, tratamento, compartilhamento e documentos.
- Configuracoes: perfil proprio, clinica, colaboradores, desenvolvimento da equipe, seguranca, suporte e importacao de formularios.
- Editor de formularios: metadados do template, campos dinamicos, opcoes, obrigatoriedade, importacao JSON.
- Componentes de apoio: seletor de cores de grupos, compartilhamento de sessao, uso de substancias, input de data normalizada e editores de opcoes.

## `src/pages/Auth.tsx`

- `93` `owner-document`: `Input`; CPF/CNPJ do owner; usa `formatOwnerDocument(...)`; `required`; `autoFocus`; sem `maxLength` explicito.
- `107` `email`: `Input type="email"`; `required`; placeholder `seu@email.com`; sem `maxLength` explicito.
- `120` `password`: `Input` alterna `password`/`text`; `required`; `minLength={6}`; sem `maxLength` explicito.

## `src/pages/Index.tsx`

- `735` busca mobile: `Input`; `value={search}`; placeholder `Buscar paciente...`; `aria-label` especifico.
- `774` ordenacao mobile: `Select`; `value={sortKey}`; opcoes `HOME_PATIENT_SORT_OPTIONS`.
- `800` busca desktop: `Input`; `value={search}`; placeholder `Buscar paciente, CPF ou telefone...`.
- `840` status de atividade: `Checkbox` por `PATIENT_STATUS_OPTIONS`.
- `861` origem do paciente: `Checkbox` por `PATIENT_ORIGIN_OPTIONS`.
- `883` status de pagamento: `Checkbox` por `HOME_PATIENT_PAYMENT_STATUS_OPTIONS`; condicionado a permissao financeira.
- `905` status de agendamento: `Checkbox` por `HOME_PATIENT_AGENDA_STATUS_OPTIONS`.
- `926` recorrencia programada: `Checkbox` por `HOME_PATIENT_RECURRENCE_STATUS_OPTIONS`.
- `940` dias de recorrencia: `Checkbox` por `HOME_PATIENT_WEEKDAY_OPTIONS`.
- `1006` grupos: `Checkbox` visual dentro de botoes por grupo; selecao tambem usa botoes de cor.
- `1037` colaborador: `Input`; `value={collaboratorQuery}`; placeholder `Buscar por nome, email, função ou cargo`.
- `1062` colaboradores: `Checkbox` visual dentro de botoes por colaborador.
- `1105` `home-session-date-from`: `Input type="date"`; data inicial dos atendimentos.
- `1114` `home-session-date-to`: `Input type="date"`; data final dos atendimentos.
- `1134` dias dos atendimentos: `Checkbox` por `HOME_PATIENT_WEEKDAY_OPTIONS`.
- `1155` ordenacao desktop: `Select`; `value={sortKey}`; opcoes `HOME_PATIENT_SORT_OPTIONS`.

## `src/components/AgendaWidget.tsx`

- `705` `patientQuery`: `CommandInput`; busca/selecao de paciente; placeholder `Buscar paciente...`.
- `742` `newTitle`: `Input`; titulo livre para evento sem paciente.
- `752` `newTime`: `Input type="time"`; horario do novo evento.
- `798` `selectedStatusAction`: `Select`; acao de status do evento, incluindo opcao destrutiva quando aplicavel.
- `825` `homepage-agenda-date`: `Input type="date"`; edicao de data do evento selecionado.
- `834` `homepage-agenda-time`: `Input type="time"`; edicao de hora do evento selecionado.

## `src/pages/NovoPaciente.tsx`

- `106` `nome`: `Input`; nome do paciente; `autoFocus`; sem `maxLength`.
- `110` `nascimento`: `Input type="date"`; data de nascimento.
- `114` `cpf`: `Input`; usa `formatCpf(...)`; placeholder `000.000.000-00`; `maxLength={14}`.
- `118` `telefone`: `Input type="tel"`; usa `formatPhone(...)`; placeholder `(00) 00000-0000`; `maxLength={15}`.
- `122` `email`: `Input type="email"`; placeholder `paciente@email.com`; sem `maxLength`.

## `src/pages/CadastroCompleto.tsx`

### Identificacao e origem

- `350` `name`: `Input`; nome completo; aplica `capitalizeWords(...)`; sem `maxLength`.
- `357` `date-of-birth`: `Input type="date"`.
- `361` `cpf`: `Input`; `formatCpf(...)`; `maxLength={14}`.
- `367` `gender`: `Select`; genero.
- `380` `pronoun`: `Select`; pronome.
- `394` `rg`: `Input`; placeholder `0000000-0`; sem formatacao automatica.
- `399` `profession`: `Input`; profissao.
- `409` `originType`: `Select`; tipo de origem normalizado por `normalizePatientOriginType(...)`.
- `421` `originReferrerName`: `Input`; origem por indicacao.
- `433` `originInsuranceProvider`: `Input`; convenio.
- `442` `originInsurancePlan`: `Input`; plano.
- `451` `originInsuranceMemberId`: `Input`; carteirinha/identificador.
- `464` `originOtherName`: `Input`; origem livre.
- `473` `originOtherDescription`: `Textarea`; descricao da origem livre.
- `504` `bloodType`: `Select`; tipo sanguineo.

### Alertas, contato e endereco

- `515` `clinicalProfile.clinical_alerts`: `Textarea`; alertas clinicos.
- `573` `phone`: `Input`; `formatPhone(...)`; `maxLength={15}`.
- `577` `email`: `Input type="email"`.
- `590` `emergencyContact.name`: `Input`; contato de emergencia.
- `599` `emergencyContact.relationship`: `Input`; relacao.
- `609` `emergencyContact.phone`: `Input`; telefone de emergencia.
- `632` `cep`: `Input`; `handleCepLookup(...)`; `maxLength={9}`.
- `639` `country`: `Input`.
- `643` `state`: `Input`; placeholder `UF`.
- `647` `city`: `Input`.
- `652` `neighborhood`: `Input`.
- `656` `street`: `Input`.
- `661` `addressNumber`: `Input`.
- `665` `addressComplement`: `Input`.

### Historico clinico

- `526` `chronicConditions`: `Textarea`; condicoes cronicas.
- `530` `allergies`: `Textarea`; alergias.
- `534` `clinicalProfile.congenital_genetic_conditions`: `Textarea`.
- `544` `clinicalProfile.family_history`: `Textarea`.
- `686` `clinicalProfile.diagnoses`: `Textarea`.
- `696` `surgeries`: `Textarea`.
- `700` `clinicalProfile.implants_devices`: `Textarea`.
- `710` `clinicalProfile.falls_history`: `Textarea`.
- `720` `continuousMedications`: `Textarea`.
- `725` `clinicalProfile.functional_independence`: `Select`.
- `739` `clinicalProfile.mobility_aids`: `Textarea`.
- `754` `clinicalNotes`: `Textarea`.
- `758` `snapshotNote`: `Textarea`; nota para snapshot clinico.
- O componente `SubstanceUseClinicalSection` tambem pode ser renderizado nesta tela para registros de uso de substancias.

## `src/pages/CadastroPacienteCompartilhado.tsx`

- `337` `registration-password`: `Input type="password"`; `inputMode="numeric"`; `maxLength={6}`; aceita apenas digitos via `.replace(/\D/g, "").slice(0, 6)`.
- `400` `name`: `Input`; nome completo.
- `404` `date-of-birth`: `Input type="date"`.
- `408` `cpf`: `Input`; `disabled` e `readOnly`.
- `412` `gender`: `Select`.
- `425` `pronoun`: `Select`.
- `437` `rg`: `Input`.
- `441` `profession`: `Input`.
- `452` `originType`: `Select`.
- `464` `originReferrerName`: `Input`.
- `475` `originInsuranceProvider`: `Input`.
- `483` `originInsurancePlan`: `Input`.
- `491` `originInsuranceMemberId`: `Input`.
- `503` `originOtherName`: `Input`.
- `511` `originOtherDescription`: `Textarea`.
- `542` `bloodType`: `Select`.
- `553` `clinicalProfile.clinical_alerts`: `Textarea`.
- `558` `chronicConditions`: `Textarea`.
- `562` `allergies`: `Textarea`.
- `566` `clinicalProfile.congenital_genetic_conditions`: `Textarea`.
- `570` `clinicalProfile.family_history`: `Textarea`.
- `592` `phone`: `Input`; usa `formatPhone(...)`, mas sem `maxLength` explicito nesta tela.
- `596` `email`: `Input type="email"`.
- `609` `emergencyContact.name`: `Input`.
- `613` `emergencyContact.relationship`: `Input`.
- `618` `emergencyContact.phone`: `Input`.
- `640` `cep`: `Input`; `handleCepLookup(...)`; `maxLength={9}`.
- `647` `country`: `Input`.
- `651` `state`: `Input`.
- `655` `city`: `Input`.
- `660` `neighborhood`: `Input`.
- `664` `street`: `Input`.
- `669` `addressNumber`: `Input`.
- `673` `addressComplement`: `Input`.
- `694` `clinicalProfile.diagnoses`: `Textarea`.
- `698` `surgeries`: `Textarea`.
- `702` `clinicalProfile.implants_devices`: `Textarea`.
- `707` `clinicalProfile.falls_history`: `Textarea`.
- `712` `continuousMedications`: `Textarea`.
- `717` `clinicalProfile.functional_independence`: `Select`.
- `731` `clinicalProfile.mobility_aids`: `Textarea`.
- `740` `clinicalNotes`: `Textarea`.

## `src/pages/PacienteDetalhe.tsx`

- `1721` `patient.status`: `Select`; status do paciente; pode incluir opcao destrutiva de exclusao.
- `1812` `sessions-search`: `Input`; busca por grupo/atendimento; sem `maxLength`.
- `1823` `sessionStatusFilter`: `Select`; filtro de status de atendimento.
- `1837` `groupStatusFilter`: `Select`; filtro de status de grupo.
- `1856` `bulkMove`: `Select`; mover atendimentos selecionados para grupo; `disabled` sem selecao.
- `1867` `bulkStatusUpdate`: `Select`; alterar status em massa; `disabled` sem selecao.
- `2072` `groupName`: `CommandInput`; busca/criacao de grupo; placeholder `Buscar ou criar grupo...`.
- `2129` `groupStatus`: `Select`; status do grupo.
- `2225` recorrencia ativa: `Checkbox`; liga/desliga recorrencia do paciente.
- `2244` dias da semana recorrentes: `Checkbox`; pode ficar `disabled` conforme estado.
- `2258` `patient-recurrence-time`: `Input type="time"`; horario da recorrencia; pode ficar `disabled`.
- `2304` `patient-agenda-date`: `Input type="date"`; data de agenda.
- `2313` `patient-agenda-time`: `Input type="time"`; hora de agenda.
- `2369` `selectedAgendaStatusAction`: `Select`; acao/status de agenda.
- `2396` `selected-agenda-date`: `Input type="date"`; edicao de agenda selecionada.
- `2405` `selected-agenda-time`: `Input type="time"`; edicao de agenda selecionada.
- `2549` `shareLink`: `Input readOnly`; link de compartilhamento do cadastro.

## `src/pages/SessaoDetalhe.tsx`

### Componentes auxiliares internos

- `232` `PaymentStatusAutoControl`: `Checkbox`; marca pagamento como cortesia.
- `287` `CurrencyInput`: `Input type="text"`; `inputMode="decimal"`; `maxLength={PAYMENT_AMOUNT_INPUT_MAX_LENGTH}`; normaliza com `currencyDigitsToInput(...)`.

### Ficha dinamica de anamnese

- `1580` `queixa`: `Textarea`; `rows={3}`; `disabled={locked}`.
- `1596` `sintomas`: `Textarea`; `rows={2}`; `disabled={locked}`.
- `1615` `pain_score`: `Slider`; `max={10}`; `step={1}`; `disabled={locked}`.
- `1627` `complexity_score`: `Slider`; `max={10}`; `step={1}`; `disabled={locked}`.
- `1636` `observacoes`: `Textarea`; `rows={4}`; `disabled={locked}`.
- `1663` `short_text`: `Input`; valor em `anamnesisFormResponse[field.id]`; placeholder vem do schema; `disabled={locked}`.
- `1677` `long_text`: `Textarea`; `rows={4}`; placeholder vem do schema; `disabled={locked}`.
- `1692` `number`: `Input type="number"`; converte vazio para `null` e valor para `Number(...)`; `disabled={locked}`.
- `1707` `date`: `DateFieldInput`; data normalizada em componente proprio; `disabled={locked}`.
- `1725` `slider`: `Slider`; usa `field.min`/`field.max`; `step={1}`; `disabled={locked}`.
- `1741` `select`: `Select`; opcoes de `field.options`; `disabled={locked}`.
- `1783` `table`: `Input` por celula; placeholder usa nome da coluna; `disabled={locked}`.
- `1819` `multiple_choice`: `RadioGroup`; opcoes de matriz; itens respeitam `locked`.
- `1860` `checklist`: `Checkbox` por opcao; valor array de strings; itens respeitam `locked`.
- `1904` `section_selector`: `Switch` por opcao; controla array de secoes ativas; respeita `locked`.
- `2057` campos dinamicos de escala em pre-visualizacao/documento: `Slider`.

### Metadados, presenca, tratamento e pagamento

- `2155` `status`: `Select`; `rascunho`, `concluído`, `cancelado`; `disabled={locked}`.
- `2166` `groupId`: `Select`; grupo da sessao; inclui `none`; `disabled={locked}`.
- `2179` `anamnesisTemplateId`: `Select`; ficha complementar; troca limpa `anamnesisFormResponse`.
- `2500` `scheduled-start`: `Input type="datetime-local"`; min `2000-01-01T00:00`, max `2100-12-31T23:59`.
- `2520` `patient-arrived`: `Input type="datetime-local"`; possui botao `Agora`.
- `2544` `session-date`: `Input type="datetime-local"`; inicio do atendimento.
- `2573` `notes`: `Textarea`; anotacoes rapidas.
- `2662` `treatmentBlocks[].name`: `Input`.
- `2671` `treatmentBlocks[].frequency`: `Input`.
- `2680` `treatmentBlocks[].duration`: `Input`.
- `2690` `treatmentBlocks[].series`: `Input`.
- `2699` `treatmentBlocks[].repetitions`: `Input`.
- `2711` `treatmentBlocks[].instructions`: `Textarea`; `rows={3}`.
- `2728` `treatmentGeneralGuidance`: `Textarea`; `rows={5}`.
- `2760` `paymentMethod`: `Select`; opcoes `PAYMENT_METHOD_OPTIONS`, exceto cortesia no fluxo normal.
- `2779` `paymentInstallments`: `Select`; opcoes `PAYMENT_INSTALLMENT_OPTIONS`.
- `2798` `payment-status-date`: `Input type="date"`; min `2000-01-01`, max `2100-12-31`.
- `2864` `paymentAdjustmentReason`: `Textarea`; `maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}`.

### Dialogs rapidos

- `2904` `quick-scheduled-start`: `Input type="datetime-local"`; edicao rapida de presenca.
- `2926` `quick-patient-arrived`: `Input type="datetime-local"`; possui botao `Agora`.
- `2950` `quick-session-date`: `Input type="datetime-local"`; possui botao `Agora`.
- `3000` `quick-payment-status-date`: `Input type="date"`.
- `3013` `draftPaymentMethod`: `Select`.
- `3032` `draftPaymentInstallments`: `Select`.
- `quick-amount-original`, `quick-amount-charged`, `quick-amount-paid`: `CurrencyInput`; campos monetarios normalizados.
- `3120` `draftPaymentAdjustmentReason`: `Textarea`; `maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}`.

## `src/components/SessionShareDialog.tsx`

- `141` `query`: `Input`; busca colaboradores por nome, email, funcao ou cargo.
- `163` colaboradores: `Checkbox` visual por colaborador; desabilita usuarios ja compartilhados.

## `src/pages/FormularioEditor.tsx`

- `322` `templateImportInputRef`: `input type="file"`; `accept="application/json,.json"`; `className="sr-only"`.
- `392` `templateName`: `Input`; nome do template; `disabled={isBase}`.
- `401` `templateDescription`: `Input`; descricao do template; `disabled={isBase}`.
- `472` `field.label`: `Input`; rotulo do campo.
- `476` `field.helpText`: `Input`; texto de ajuda.
- `484` `field.type`: `Select`; tipo do campo.
- `506` `field.placeholder`: `Input`; placeholder.
- `510` `field.groupKey`: `Select`; container/grupo do campo.
- `531` `field.groupKey`: `Select`; secao pai para containers.
- `551` `field.sectionKey`: `Select`; visibilidade condicional.
- `570` `field.required`: `Checkbox`; obrigatoriedade.
- `581` `field.showInPatientList`: `Checkbox`; exibicao na lista de atendimentos.
- `611` `field.options`: `Textarea`; modo texto, uma opcao por linha.
- `625` `field.min`: `Input type="number"`; minimo de slider.
- `633` `field.max`: `Input type="number"`; maximo de slider.
- Usa `OptionListEditor` e `OptionMatrixEditor` para opcoes estruturadas.

## `src/pages/Configuracoes.tsx`

### Perfil proprio

- `1839` toggle de bloqueio/edicao de perfil: `Switch`.
- `1857` `ownProfileForm.email`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.email}`.
- `1880` `ownProfileForm.fullName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.personName}`.
- `1889` `ownProfileForm.socialName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.socialName}`.
- `1898` `ownProfileForm.birthDate`: `Input type="date"`.
- `1907` `ownProfileForm.cpf`: `Input`; `formatCpf(...)`; `maxLength={14}`.
- `1916` `ownProfileForm.phone`: `Input`; `formatPhone(...)`; `maxLength={15}`.
- `1925` `ownProfileForm.professionalLicense`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.professionalLicense}`.
- `1949` `ownProfileForm.address.cep`: `Input`; `maxLength={9}`.
- `1958` a `2003` endereco proprio: `Input` para rua, numero, complemento, bairro, cidade e estado; limites em `ADDRESS_FIELD_LIMITS`.

### Clinica

- `2077` `clinicName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicName}`.
- `2085` `clinicLogoUrl`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicLogoUrl}`.
- `2094` `clinicEmail`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicEmail}`.
- `2102` `clinicPhone`: `Input`; `formatPhone(...)`; `maxLength={15}`.
- `2122` `clinicLegalName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicLegalName}`.
- `2130` `clinic.cnpj`: `Input disabled`.
- `2134` `clinic.subscription_plan`: `Input disabled`.
- `2139` `clinicBusinessHours.summary`: `Textarea`; `maxLength={SETTINGS_TEXT_LIMITS.businessHours}`.
- `2162` a `2210` endereco da clinica: `Input` para CEP, rua, numero, complemento, bairro, cidade e estado; limites em `ADDRESS_FIELD_LIMITS`.

### Colaboradores e acessos

- `2296` `newSubaccountName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.personName}`.
- `2304` `newSubaccountEmail`: `Input type="email"`; `maxLength={SETTINGS_TEXT_LIMITS.email}`.
- `2313` `newSubaccountPassword`: `Input type="text"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`; criacao exige minimo de 6 caracteres.
- `2342` `newSubaccountRole`: `Select`; `admin`, `professional`, `assistant`, `estagiario`.
- `2359` `newSubaccountJobTitle`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.jobTitle}`.
- `2367` `newSubaccountSpecialty`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.specialty}`.
- `2403` `team-search`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.searchTerm}`.
- `2413` `teamRoleFilter`: `Select`.
- `2428` `teamStatusFilter`: `Select`.
- `2441` `teamSortKey`: `Select`.
- `2571` a `2636` edicao de colaborador: `Input` para nome, nome social, email, nascimento, CPF, registro profissional, telefone, especialidade e cargo.
- `2644` `editingSubaccount.operationalRole`: `Select`; pode depender da permissao `subaccounts_roles.manage`.
- `2662` `editingSubaccount.membershipStatus`: `Select`; `active`, `inactive`, `suspended`.
- `2678` `editingSubaccount.resetPassword`: `Input type="text"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`.
- `2690` `editingSubaccount.workingHours`: `Textarea`; `maxLength={SETTINGS_TEXT_LIMITS.workingHours}`.
- `2700` a `2748` endereco do colaborador: `Input` para CEP, rua, numero, complemento, bairro, cidade e estado.

### Desenvolvimento, seguranca e suporte

- `3031` `form.developmentStatus`: `Select`; opcoes de `DEVELOPMENT_STATUS_OPTIONS`.
- `3049` `form.internalLevel`: `Select`; opcoes de `DEVELOPMENT_LEVEL_OPTIONS`.
- `3067` `form.nextReviewAt`: `Input type="date"`.
- `3082` `form.onboardingFlowRead`: `Switch`.
- `3094` `form.onboardingInitialTraining`: `Switch`.
- `3181` `securityPassword`: `Input type="password"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`.
- `3191` `securityPasswordConfirm`: `Input type="password"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`.
- `3334` `securitySettings[...]`: `Switch` para alertas de senha, novo login, encerramento de sessoes e mudanca de acesso.
- `3513` `supportForm.category`: `Select`.
- `3536` `supportForm.subject`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.supportSubject}`.
- `3547` `supportForm.message`: `Textarea`; `maxLength={SETTINGS_TEXT_LIMITS.supportMessage}`.
- `3563` `supportForm.includeContext`: `Switch`.
- `3645` `templateImportInputRef`: `input type="file"`; importacao JSON de modelos de formulario.

## `src/components/GroupColorPaletteField.tsx`

- `335` opacidade: `input type="range"`; `min={0}`, `max={100}`.
- `368` `codeMode`: `Select`; alterna `hex`, `rgb`, `cmyk`.
- `385` `group-color-hex`: `Input`; `maxLength={6}`; normaliza HEX.
- `407` canais RGB: `Input`; `inputMode="numeric"`; limite logico `255` em `parseNumberInput(...)`.
- `430` canais CMYK: `Input`; `inputMode="decimal"`; limite logico `100`.
- `455` `group-color-alpha`: `Input`; `inputMode="numeric"`; limite logico `100`.

## `src/components/patients/SubstanceUseClinicalSection.tsx`

- `67` `record.name`: `Input`; substancia/comportamento.
- `75` `record.started_at`: `Input`; inicio.
- Controle de ilicitude: botoes segmentados `Sim`/`Nao`, nao aparece como `Input` no grep.
- `94` `record.dependency_level`: `Select`; opcoes `DEPENDENCY_LEVEL_OPTIONS`.
- `112` `record.frequency`: `Input`.
- `120` `record.motivation`: `Input`.
- `130` `record.notes`: `Textarea`; `rows={3}`.

## Componentes dinamicos de apoio

### `src/components/anamnesis/DateFieldInput.tsx`

- `25` `normalizedValue`: `Input type="text"`; `inputMode="numeric"`; normaliza com `normalizeDateInput(...)`; integra `Calendar` via `Popover`.

### `src/components/anamnesis/OptionListEditor.tsx`

- `27` `option.label`: `Input`; label de opcao vertical; sem `maxLength`.

### `src/components/anamnesis/OptionMatrixEditor.tsx`

- `33` `option.label`: `Input`; label de opcao em matriz; sem `maxLength`.

## Observacoes gerais

- `Configuracoes.tsx` continua sendo a area mais endurecida: muitos campos usam limites (`SETTINGS_TEXT_LIMITS`, `ADDRESS_FIELD_LIMITS`) e sanitizacao em handlers auxiliares.
- Cadastros de paciente, cadastro compartilhado, editor de formularios, `SessaoDetalhe.tsx`, `PacienteDetalhe.tsx`, `AgendaWidget.tsx` e buscas/filtros ainda concentram campos livres sem `maxLength` explicito.
- Campos clinicos longos talvez devam ter limites de backend/frontend por tipo de dado, especialmente historico, observacoes, tratamentos e respostas dinamicas de ficha.
- Campos monetarios em `SessaoDetalhe.tsx` usam `CurrencyInput` com normalizacao e `PAYMENT_AMOUNT_INPUT_MAX_LENGTH`, uma boa referencia para padronizar entradas numericas sensiveis.
- Datas de presenca/pagamento em `SessaoDetalhe.tsx` ja possuem intervalos min/max fixos em varios pontos.
- Existem entradas interativas fora de `<Input>` que tambem merecem auditoria de UX/acessibilidade: botoes de cor na Home, botoes de ilicitude no componente de substancias, botoes de selecao em listas e calendario em `DateFieldInput`.

## Notas relacionadas

- [[Mapa da vault]]
- [[Core do projeto]]
- [[TDD e checks]]
- [[Prompt - Homepage filtro e ordenacao de pacientes]]
