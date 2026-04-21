# Inventario de Inputs do Therapy Flow

Gerado em `2026-04-18` a partir de uma varredura manual no código em `src/`.

## Escopo desta varredura

- Inclui páginas e componentes que renderizam campos reais de entrada de dados.
- Inclui campos dinâmicos gerados por schema, quando o componente renderiza o controle final.
- Exclui testes.
- Exclui componentes base genéricos de UI em `src/components/ui/*` quando eles são apenas wrappers reutilizáveis e não uma tela de negócio.
- Em cada item, as "configurações básicas" priorizam: tipo do controle, `value`/binding, formatação, `maxLength`, `required`, `disabled`, `readOnly`, placeholder e observações relevantes.

## `src/pages/Auth.tsx`

- `src/pages/Auth.tsx:93` `owner-document`: `Input` de texto para CPF/CNPJ do owner; usa `formatOwnerDocument(...)`; `required`; `autoFocus`; placeholder de CPF/CNPJ; sem `maxLength` explícito.
- `src/pages/Auth.tsx:107` `email`: `Input` `type="email"`; `required`; placeholder `seu@email.com`; sem `maxLength` explícito.
- `src/pages/Auth.tsx:120` `password`: `Input` com `type` alternando entre `password` e `text`; `required`; `minLength={6}`; placeholder visual de senha; sem `maxLength` explícito.

## `src/pages/Index.tsx`

- `src/pages/Index.tsx:132` `search`: `Input` de busca de paciente; placeholder `Buscar paciente...`; `aria-label` para acessibilidade; sem `maxLength` explícito; usado como filtro local.

## `src/components/AgendaWidget.tsx`

- `src/components/AgendaWidget.tsx:277` `patientQuery`: `Input` com `list="agenda-patients"`; funciona como busca + seleção via `datalist`; placeholder `Busque e selecione um paciente`; sem `maxLength`.
- `src/components/AgendaWidget.tsx:297` `newTitle`: `Input` de título livre para eventos que não são atendimento; placeholder `Digite o título do evento`; sem `maxLength`.
- `src/components/AgendaWidget.tsx:307` `newTime`: `Input` `type="time"`; controla o horário do evento.

## `src/pages/NovoPaciente.tsx`

- `src/pages/NovoPaciente.tsx:106` `nome`: `Input` de nome completo; `autoFocus`; placeholder `Nome do paciente`; sem `maxLength`.
- `src/pages/NovoPaciente.tsx:110` `nascimento`: `Input` `type="date"` para data de nascimento.
- `src/pages/NovoPaciente.tsx:114` `cpf`: `Input` com `formatCpf(...)`; placeholder `000.000.000-00`; `maxLength={14}`.
- `src/pages/NovoPaciente.tsx:118` `telefone`: `Input` `type="tel"` com `formatPhone(...)`; placeholder `(00) 00000-0000`; `maxLength={15}`.
- `src/pages/NovoPaciente.tsx:122` `email`: `Input` `type="email"`; placeholder `paciente@email.com`; sem `maxLength`.

## `src/pages/CadastroCompleto.tsx`

- `src/pages/CadastroCompleto.tsx:212` `gender`: `Select`; opções fechadas de gênero; placeholder `Selecione`.
- `src/pages/CadastroCompleto.tsx:225` `pronoun`: `Select`; opções fechadas de pronome; placeholder `Selecione`.
- `src/pages/CadastroCompleto.tsx:239` `rg`: `Input` de RG; placeholder `0000000-0`; sem formatação automática.
- `src/pages/CadastroCompleto.tsx:243` `bloodType`: `Select`; usa `BLOOD_TYPES`.
- `src/pages/CadastroCompleto.tsx:255` `profession`: `Input` de profissão; placeholder `Ex: Engenheiro(a)`; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:271` `cep`: `Input` com `handleCepLookup(...)`; placeholder `00000-000`; `maxLength={9}`.
- `src/pages/CadastroCompleto.tsx:278` `country`: `Input` livre de país; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:282` `state`: `Input` livre de estado; placeholder `UF`; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:286` `city`: `Input` livre de cidade; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:291` `neighborhood`: `Input` livre de bairro; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:295` `street`: `Input` livre de rua; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:300` `addressNumber`: `Input` livre; placeholder `Ex: 123`; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:304` `addressComplement`: `Input` livre; placeholder `Apt, Bloco, etc.`; sem `maxLength`.
- `src/pages/CadastroCompleto.tsx:320` `chronic`: `Textarea`; placeholder de problemas crônicos; `rows={3}`.
- `src/pages/CadastroCompleto.tsx:324` `surgeries`: `Textarea`; placeholder de cirurgias; `rows={3}`.
- `src/pages/CadastroCompleto.tsx:328` `meds`: `Textarea`; placeholder de medicamentos; `rows={3}`.
- `src/pages/CadastroCompleto.tsx:332` `allergies`: `Textarea`; placeholder de alergias; `rows={2}`.
- `src/pages/CadastroCompleto.tsx:336` `clinicalNotes`: `Textarea`; placeholder de observações clínicas; `rows={3}`.

## `src/pages/CadastroPacienteCompartilhado.tsx`

- `src/pages/CadastroPacienteCompartilhado.tsx:272` `registration-password`: `Input` `type="password"`; `inputMode="numeric"`; `maxLength={6}`; sanitiza para apenas dígitos com `.replace(/\D/g, "").slice(0, 6)`; `disabled` quando o cadastro já está liberado ou vinculado.
- `src/pages/CadastroPacienteCompartilhado.tsx:321` `name`: `Input` de nome completo; sem `maxLength`.
- `src/pages/CadastroPacienteCompartilhado.tsx:325` `date-of-birth`: `Input` `type="date"`.
- `src/pages/CadastroPacienteCompartilhado.tsx:329` `cpf`: `Input` somente leitura; `disabled` e `readOnly`.
- `src/pages/CadastroPacienteCompartilhado.tsx:333` `phone`: `Input` com `formatPhone(...)`; sem `maxLength` explícito.
- `src/pages/CadastroPacienteCompartilhado.tsx:337` `email`: `Input` `type="email"`; sem `maxLength`.
- `src/pages/CadastroPacienteCompartilhado.tsx:341` `gender`: `Select`; opções fixas; placeholder `Selecione`.
- `src/pages/CadastroPacienteCompartilhado.tsx:354` `pronoun`: `Select`; opções fixas; placeholder `Selecione`.
- `src/pages/CadastroPacienteCompartilhado.tsx:366` `rg`: `Input` livre; sem formatação.
- `src/pages/CadastroPacienteCompartilhado.tsx:370` `blood-type`: `Select`; usa `BLOOD_TYPES`.
- `src/pages/CadastroPacienteCompartilhado.tsx:381` `profession`: `Input` livre; sem `maxLength`.
- `src/pages/CadastroPacienteCompartilhado.tsx:398` `cep`: `Input` com `handleCepLookup(...)`; placeholder `00000-000`; `maxLength={9}`.
- `src/pages/CadastroPacienteCompartilhado.tsx:405` `country`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:409` `state`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:413` `city`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:418` `neighborhood`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:422` `street`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:427` `address-number`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:431` `address-complement`: `Input` livre.
- `src/pages/CadastroPacienteCompartilhado.tsx:447` `chronic`: `Textarea`; `rows={3}`.
- `src/pages/CadastroPacienteCompartilhado.tsx:451` `surgeries`: `Textarea`; `rows={3}`.
- `src/pages/CadastroPacienteCompartilhado.tsx:455` `medications`: `Textarea`; `rows={3}`.
- `src/pages/CadastroPacienteCompartilhado.tsx:459` `allergies`: `Textarea`; `rows={3}`.
- `src/pages/CadastroPacienteCompartilhado.tsx:463` `clinical-notes`: `Textarea`; `rows={4}`.

## `src/pages/PacienteDetalhe.tsx`

- `src/pages/PacienteDetalhe.tsx:736` `patient.status`: `Select` de status do paciente; pode incluir opção destrutiva de exclusão quando permitido; `disabled` durante atualização/remoção.
- `src/pages/PacienteDetalhe.tsx:887` `sessions-search`: `Input` de busca por grupo ou atendimento; placeholder `Ex: lombar, rascunho, 18/03/2026`; sem `maxLength`.
- `src/pages/PacienteDetalhe.tsx:898` `sessionStatusFilter`: `Select` para filtrar atendimentos por status.
- `src/pages/PacienteDetalhe.tsx:912` `groupStatusFilter`: `Select` para filtrar grupos por status.
- `src/pages/PacienteDetalhe.tsx:931` `bulkMove`: `Select` de ação em massa para mover atendimentos para grupo; `disabled` sem seleção.
- `src/pages/PacienteDetalhe.tsx:942` `bulkStatusUpdate`: `Select` de ação em massa para alterar status; `disabled` sem seleção.
- `src/pages/PacienteDetalhe.tsx:1114` `groupName`: `Input` de nome do grupo; placeholder `Ex: Lombalgia crônica`; sem `maxLength`.
- `src/pages/PacienteDetalhe.tsx:1118` `groupStatus`: `Select` de status do grupo.
- `src/pages/PacienteDetalhe.tsx:1131` `groupColor`: `Select` de cor do grupo.
- `src/pages/PacienteDetalhe.tsx:1213` `shareLink`: `Input` `readOnly` para link de compartilhamento do cadastro.

## `src/pages/SessaoDetalhe.tsx`

- `src/pages/SessaoDetalhe.tsx:608` `queixa`: `Textarea`; `rows={3}`; placeholder da queixa principal; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:624` `sintomas`: `Textarea`; `rows={2}`; placeholder de sintomas; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:664` `observacoes`: `Textarea`; `rows={4}`; placeholder de observações da anamnese; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:691` `short_text` dinamico: `Input` textual; valor vem de `anamnesisFormResponse[field.id]`; placeholder configurável por schema; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:705` `long_text` dinamico: `Textarea`; `rows={4}`; placeholder por schema; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:720` `number` dinamico: `Input` `type="number"`; converte vazio para `null` e valor para `Number(...)`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:769` `select` dinamico: `Select`; opções vêm de `field.options`; placeholder `Selecione`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:811` `table` dinamico: `Input` textual por célula da tabela; placeholder usa o nome da coluna; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:848` `multiple_choice` dinamico: `RadioGroup`; opções renderizadas em matriz rolável; `disabled={locked}` por item.
- `src/pages/SessaoDetalhe.tsx:881` `checklist` dinamico: `Checkbox` por opção; seleciona array de `string`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:916` `section_selector` dinamico: `Switch` por opção; controla array de seções ativas; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1096` `status`: `Select` do atendimento; opções `rascunho`, `concluído`, `cancelado`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1107` `groupId`: `Select` de grupo; inclui opção `none`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1120` `anamnesisTemplateId`: `Select` de ficha complementar; limpa `anamnesisFormResponse` ao trocar; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1307` `notes`: `Textarea` de anotações rápidas; `rows={2}`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1395` `treatmentBlocks[].name`: `Input` de nome do tratamento; placeholder `Ex: Alongamento lombar`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1404` `treatmentBlocks[].frequency`: `Input` de frequência; placeholder `Ex: a cada 8h`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1413` `treatmentBlocks[].duration`: `Input` de duração; placeholder `Ex: por 15 dias`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1423` `treatmentBlocks[].series`: `Input` textual; placeholder `Opcional`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1432` `treatmentBlocks[].repetitions`: `Input` textual; placeholder `Opcional`; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1444` `treatmentBlocks[].instructions`: `Textarea`; `rows={3}`; placeholder de instruções adicionais; `disabled={locked}`.
- `src/pages/SessaoDetalhe.tsx:1461` `treatmentGeneralGuidance`: `Textarea`; `rows={5}`; placeholder de orientações gerais; `disabled={locked}`.
- Controle associado, sem linha no `rg`: `DateFieldInput` e `Slider` tambem são usados aqui para campos dinamicos `date`, `slider`, `pain_score` e `complexity_score`.

## `src/pages/FormularioEditor.tsx`

- `src/pages/FormularioEditor.tsx:321` `templateImportInputRef`: `input` nativo `type="file"`; `accept="application/json,.json"`; `className="sr-only"`; usado para importar modelo.
- `src/pages/FormularioEditor.tsx:391` `templateName`: `Input` textual do nome da ficha/estrutura; placeholder `Ex: Ficha ortopédica inicial`; `disabled={isBase}`.
- `src/pages/FormularioEditor.tsx:400` `templateDescription`: `Input` textual de descrição; placeholder `Ex: triagem inicial para dor lombar`; `disabled={isBase}`.
- `src/pages/FormularioEditor.tsx:471` `field.label`: `Input` textual do rótulo do campo.
- `src/pages/FormularioEditor.tsx:475` `field.helpText`: `Input` textual de ajuda do campo.
- `src/pages/FormularioEditor.tsx:483` `field.placeholder`: `Input` textual de placeholder do campo.
- `src/pages/FormularioEditor.tsx:487` `field.groupKey`: `Select` para agrupar campo em contêiner; placeholder `Sem contêiner`.
- `src/pages/FormularioEditor.tsx:508` `field.groupKey` para contêineres: `Select` de seção pai; placeholder `Sem seção pai`.
- `src/pages/FormularioEditor.tsx:528` `field.sectionKey`: `Select` de vinculação condicional; placeholder `Sempre visível`.
- `src/pages/FormularioEditor.tsx:547` `field.required`: `Checkbox` de obrigatoriedade.
- `src/pages/FormularioEditor.tsx:558` `field.showInPatientList`: `Checkbox`; aparece apenas no bloco base; controla exibição na lista de atendimentos.
- `src/pages/FormularioEditor.tsx:588` `field.options` em modo texto: `Textarea`; `rows={4}`; uma opção por linha.
- `src/pages/FormularioEditor.tsx:602` `field.min`: `Input` `type="number"`; mínimo de slider.
- `src/pages/FormularioEditor.tsx:610` `field.max`: `Input` `type="number"`; máximo de slider.
- `src/pages/FormularioEditor.tsx` tambem usa `OptionListEditor` e `OptionMatrixEditor` para opções estruturadas, em vez de `Textarea`, dependendo do tipo do campo.
- Os componentes `OptionListEditor` e `OptionMatrixEditor` possuem inputs de texto internos para edição de `label` de cada opção, que são disparados via `onChange` para atualizar o array de `options` do campo no editor.

## `src/pages/Configuracoes.tsx`

### Perfil proprio

- `src/pages/Configuracoes.tsx:1818` `ownProfileForm.email`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.email}`; atualiza por `updateOwnProfileField(...)`, que aplica sanitização frontend.
- `src/pages/Configuracoes.tsx:1837` `ownProfileForm.fullName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.personName}`; pode estar `disabled` por lock de preenchimento único; passa por sanitização.
- `src/pages/Configuracoes.tsx:1846` `ownProfileForm.socialName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.socialName}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1855` `ownProfileForm.birthDate`: `Input` `type="date"`; pode estar `disabled`.
- `src/pages/Configuracoes.tsx:1864` `ownProfileForm.cpf`: `Input`; usa `formatCpf(...)`; `maxLength={14}`; pode estar `disabled`.
- `src/pages/Configuracoes.tsx:1873` `ownProfileForm.phone`: `Input`; usa `formatPhone(...)`; `maxLength={15}`; pode estar `disabled`.
- `src/pages/Configuracoes.tsx:1882` `ownProfileForm.professionalLicense`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.professionalLicense}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1902` `ownProfileForm.address.cep`: `Input`; usa `formatCep(...)`; `maxLength={9}`; pode estar `disabled`.
- `src/pages/Configuracoes.tsx:1911` `ownProfileForm.address.street`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.street}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1920` `ownProfileForm.address.number`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.number}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1929` `ownProfileForm.address.complement`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.complement}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1938` `ownProfileForm.address.neighborhood`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.neighborhood}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1947` `ownProfileForm.address.city`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.city}`; pode estar `disabled`; passa por sanitização.
- `src/pages/Configuracoes.tsx:1956` `ownProfileForm.address.state`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.state}`; pode estar `disabled`; passa por sanitização.

### Perfil da clinica

- `src/pages/Configuracoes.tsx:2030` `clinicName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicName}`; passa por `updateClinicField(...)` com sanitização.
- `src/pages/Configuracoes.tsx:2038` `clinicLogoUrl`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicLogoUrl}`; placeholder `https://...`; sanitizado.
- `src/pages/Configuracoes.tsx:2047` `clinicEmail`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicEmail}`; sanitizado.
- `src/pages/Configuracoes.tsx:2055` `clinicPhone`: `Input`; usa `formatPhone(...)`; `maxLength={15}`.
- `src/pages/Configuracoes.tsx:2075` `clinicLegalName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.clinicLegalName}`; sanitizado.
- `src/pages/Configuracoes.tsx:2083` `clinic.cnpj`: `Input` `disabled`.
- `src/pages/Configuracoes.tsx:2087` `clinic.subscription_plan`: `Input` `disabled`.
- `src/pages/Configuracoes.tsx:2092` `clinicBusinessHours.summary`: `Textarea`; `maxLength={SETTINGS_TEXT_LIMITS.businessHours}`; usa `sanitizeMultilineInput(...)`; placeholder de horario de funcionamento.
- `src/pages/Configuracoes.tsx:2115` `clinicAddress.cep`: `Input`; usa `formatCep(...)`; `maxLength={9}`.
- `src/pages/Configuracoes.tsx:2123` `clinicAddress.street`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.street}`; sanitizado.
- `src/pages/Configuracoes.tsx:2131` `clinicAddress.number`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.number}`; sanitizado.
- `src/pages/Configuracoes.tsx:2139` `clinicAddress.complement`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.complement}`; sanitizado.
- `src/pages/Configuracoes.tsx:2147` `clinicAddress.neighborhood`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.neighborhood}`; sanitizado.
- `src/pages/Configuracoes.tsx:2155` `clinicAddress.city`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.city}`; sanitizado.
- `src/pages/Configuracoes.tsx:2163` `clinicAddress.state`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.state}`; sanitizado.

### Colaboradores e acessos

- `src/pages/Configuracoes.tsx:2249` `newSubaccountName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.personName}`; sanitizado.
- `src/pages/Configuracoes.tsx:2257` `newSubaccountEmail`: `Input` `type="email"`; `maxLength={SETTINGS_TEXT_LIMITS.email}`; sanitizado.
- `src/pages/Configuracoes.tsx:2266` `newSubaccountPassword`: `Input` `type="text"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`; sanitizado; criação exige pelo menos 6 caracteres.
- `src/pages/Configuracoes.tsx:2295` `newSubaccountRole`: `Select` de papel operacional; opções `admin`, `professional`, `assistant`, `estagiario`.
- `src/pages/Configuracoes.tsx:2312` `newSubaccountJobTitle`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.jobTitle}`; sanitizado.
- `src/pages/Configuracoes.tsx:2320` `newSubaccountSpecialty`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.specialty}`; sanitizado.
- `src/pages/Configuracoes.tsx:2356` `teamSearchTerm`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.searchTerm}`; placeholder `Nome, e-mail, cargo ou papel`; sanitizado.
- `src/pages/Configuracoes.tsx:2366` `teamRoleFilter`: `Select` de filtro por papel.
- `src/pages/Configuracoes.tsx:2381` `teamStatusFilter`: `Select` de filtro por status.
- `src/pages/Configuracoes.tsx:2394` `teamSortKey`: `Select` de ordenação.
- `src/pages/Configuracoes.tsx:2524` `editingSubaccount.fullName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.personName}`; sanitizado.
- `src/pages/Configuracoes.tsx:2532` `editingSubaccount.socialName`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.socialName}`; sanitizado.
- `src/pages/Configuracoes.tsx:2540` `editingSubaccount.email`: `Input` `type="email"`; `maxLength={SETTINGS_TEXT_LIMITS.email}`; sanitizado.
- `src/pages/Configuracoes.tsx:2549` `editingSubaccount.birthDate`: `Input` `type="date"`.
- `src/pages/Configuracoes.tsx:2557` `editingSubaccount.cpf`: `Input`; usa `formatCpf(...)`; `maxLength={14}`.
- `src/pages/Configuracoes.tsx:2565` `editingSubaccount.professionalLicense`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.professionalLicense}`; sanitizado.
- `src/pages/Configuracoes.tsx:2573` `editingSubaccount.phone`: `Input`; usa `formatPhone(...)`; `maxLength={15}`.
- `src/pages/Configuracoes.tsx:2581` `editingSubaccount.specialty`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.specialty}`; sanitizado.
- `src/pages/Configuracoes.tsx:2589` `editingSubaccount.jobTitle`: `Input`; `maxLength={SETTINGS_TEXT_LIMITS.jobTitle}`; sanitizado.
- `src/pages/Configuracoes.tsx:2597` `editingSubaccount.operationalRole`: `Select`; `disabled` sem permissão `subaccounts_roles.manage`.
- `src/pages/Configuracoes.tsx:2615` `editingSubaccount.membershipStatus`: `Select`; opções `active`, `inactive`, `suspended`.
- `src/pages/Configuracoes.tsx:2631` `editingSubaccount.resetPassword`: `Input` `type="text"`; `maxLength={SETTINGS_TEXT_LIMITS.password}`; placeholder `Deixe em branco para manter`.
- `src/pages/Configuracoes.tsx:2643` `editingSubaccount.workingHours`: `Textarea`; `maxLength={SETTINGS_TEXT_LIMITS.workingHours}`; placeholder de jornada; sanitizado.
- `src/pages/Configuracoes.tsx:2653` `editingSubaccount.address.cep`: `Input`; usa `formatCep(...)`; `maxLength={9}`.
- `src/pages/Configuracoes.tsx:2661` `editingSubaccount.address.street`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.street}`; sanitizado.
- `src/pages/Configuracoes.tsx:2669` `editingSubaccount.address.number`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.number}`; sanitizado.
- `src/pages/Configuracoes.tsx:2677` `editingSubaccount.address.complement`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.complement}`; sanitizado.
- `src/pages/Configuracoes.tsx:2685` `editingSubaccount.address.neighborhood`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.neighborhood}`; sanitizado.
- `src/pages/Configuracoes.tsx:2693` `editingSubaccount.address.city`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.city}`; sanitizado.
- `src/pages/Configuracoes.tsx:2701` `editingSubaccount.address.state`: `Input`; `maxLength={ADDRESS_FIELD_LIMITS.state}`; sanitizado.

### Desenvolvimento da equipe

- `src/pages/Configuracoes.tsx:2984` `teamDevelopmentForm.developmentStatus`: `Select`; opções de `DEVELOPMENT_STATUS_OPTIONS`; label exibido por `getDevelopmentStatusMeta(...)`.
- `src/pages/Configuracoes.tsx:3002` `teamDevelopmentForm.internalLevel`: `Select`; opções de `DEVELOPMENT_LEVEL_OPTIONS`; label exibido por `getDevelopmentLevelMeta(...)`.
- `src/pages/Configuracoes.tsx:3020` `teamDevelopmentForm.nextReviewAt`: `Input` `type="date"`.
- `src/pages/Configuracoes.tsx:3035` `teamDevelopmentForm.onboardingFlowRead`: `Switch` booleano.
- `src/pages/Configuracoes.tsx:3047` `teamDevelopmentForm.onboardingInitialTraining`: `Switch` booleano.

### Seguranca

- `src/pages/Configuracoes.tsx:3134` `securityPassword`: `Input` `type="password"`; placeholder `Mínimo de 6 caracteres`; `maxLength={SETTINGS_TEXT_LIMITS.password}`; sanitizado.
- `src/pages/Configuracoes.tsx:3144` `securityPasswordConfirm`: `Input` `type="password"`; placeholder `Repita a nova senha`; `maxLength={SETTINGS_TEXT_LIMITS.password}`; sanitizado.
- `src/pages/Configuracoes.tsx:3287` `securitySettings[...]`: `Switch` repetido para `alertPasswordChanged`, `alertNewLogin`, `alertOtherSessionsEnded`, `alertAccessChange`.

### Suporte

- `src/pages/Configuracoes.tsx:3466` `supportForm.category`: `Select`; categoria do contato de suporte.
- `src/pages/Configuracoes.tsx:3489` `supportForm.subject`: `Input`; placeholder `Ex: erro ao salvar atendimento`; `maxLength={SETTINGS_TEXT_LIMITS.supportSubject}`; sanitizado.
- `src/pages/Configuracoes.tsx:3500` `supportForm.message`: `Textarea`; placeholder de descrição do problema; `maxLength={SETTINGS_TEXT_LIMITS.supportMessage}`; sanitizado por `updateSupportFormField(...)`.
- `src/pages/Configuracoes.tsx:3516` `supportForm.includeContext`: `Switch` booleano para incluir contexto automatico na mensagem.

### Formularios

- `src/pages/Configuracoes.tsx:3598` `templateImportInputRef`: `input` nativo `type="file"`; `accept="application/json,.json"`; `className="sr-only"`; usado para importar modelos de ficha.

## Componentes dinamicos de apoio

### `src/components/anamnesis/DateFieldInput.tsx`

- `src/components/anamnesis/DateFieldInput.tsx:24` `value`: `Input` `type="text"` para data normalizada; `inputMode="numeric"`; placeholder configurável; usa `normalizeDateInput(...)`; pode ficar `disabled`.
- O componente integra um `Calendar` via `Popover` (linha 48), que ao selecionar uma data dispara `onChange` com `formatDateValue(date)`, atualizando o valor do input.

### `src/components/anamnesis/OptionListEditor.tsx`

- `src/components/anamnesis/OptionListEditor.tsx:27` `option.label`: `Input` textual para lista vertical de opções; placeholder `Opção inicial` ou `Nova opção`; sem `maxLength`.

### `src/components/anamnesis/OptionMatrixEditor.tsx`

- `src/components/anamnesis/OptionMatrixEditor.tsx:32` `option.label`: `Input` textual para matriz de opções; placeholder `Opção inicial` ou `Nova opção`; sem `maxLength`.

## Observacoes gerais

- `Configuracoes.tsx` e utilitários associados hoje são a área mais endurecida no frontend: vários campos já passam por sanitização e limites explícitos via `SETTINGS_TEXT_LIMITS`, `ADDRESS_FIELD_LIMITS`, `sanitizeSingleLineInput(...)` e `sanitizeMultilineInput(...)`.
- `NovoPaciente.tsx`, `CadastroCompleto.tsx`, `CadastroPacienteCompartilhado.tsx`, `PacienteDetalhe.tsx`, `SessaoDetalhe.tsx`, `Auth.tsx`, `AgendaWidget.tsx` e partes do `FormularioEditor.tsx` ainda têm vários campos livres sem `maxLength` explícito.
- Há bastante uso de `Select`, `Checkbox`, `Switch` e `RadioGroup` para entradas estruturadas, o que reduz superfície de texto livre em algumas áreas.
- Para uma segunda passada de endurecimento, os melhores candidatos são: autenticacao, cadastros de paciente, tratamentos em `SessaoDetalhe`, busca/filtros textuais e editor de formularios.
