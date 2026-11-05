---
tags:
  - juridico
  - politica-de-privacidade
  - lgpd
  - gdpr
  - hipaa
  - seguranca
  - compliance
kind: documento
area: juridico
aliases:
  - Politica de Privacidade Pluri Health
  - Privacy Policy PT-BR
---

# Política de Privacidade e Proteção de Dados - Pluri Health

**Última atualização:** 04 de Novembro de 2026  
**Versão:** 1.0.0

---

## 1. Introdução e Visão Geral

Bem-vindo à **Pluri Health** ("Plataforma", "nós", "nosso"). A Pluri Health é uma solução integrada de tecnologia e software como serviço (SaaS) voltada à gestão clínica, agendamento de consultas, evolução de prontuários eletrônicos, gestão de equipes e relacionamento em saúde (com verticais especializadas, incluindo a Pluri Fisio).

A proteção da sua privacidade e o tratamento ético, transparente e seguro dos seus dados constituem a base de todas as nossas operações. Esta Política de Privacidade ("Política") tem por objetivo esclarecer de forma simples, transparente e acessível como tratamos os dados pessoais e dados pessoais sensíveis de saúde coletados através da Plataforma, de nossas Landing Pages e serviços correlatos, em estrita conformidade com:
- A **Lei Geral de Proteção de Dados Pessoais do Brasil (LGPD)** – Lei nº 13.709/2018;
- O **Regulamento Geral sobre a Proteção de Dados da União Europeia (GDPR)** – Regulamento (UE) 2016/679;
- Os padrões de segurança em saúde digital inspirados pelo **HIPAA** (Health Insurance Portability and Accountability Act) para proteção de registros eletrônicos de saúde;
- As resoluções deontológicas e normativas dos conselhos de saúde (ex.: CFM, CREFITO, CFP, COFFITO) e a Lei do Prontuário Eletrônico (Lei nº 13.787/2018).

Esta Política deve ser lida conjuntamente com os nossos [[Termos de Uso e Consentimento - Owner (PT-BR)]] e [[Termos de Uso e Consentimento - Colaborador (PT-BR)]].

---

## 2. Papéis e Enquadramento Legal (Controlador vs. Operador)

Para os efeitos das legislações de proteção de dados, é fundamental distinguir os dois papéis de tratamento operados dentro da Plataforma:

### 2.1. A Clínica Assinante (Controladora dos Dados de Saúde e Formulários)
- A Clínica (ou o profissional autônomo que contrata a Plataforma como Owner) atua como **Controladora exclusiva** dos dados pessoais de seus pacientes e de seus colaboradores internos.
- **Modularidade Total das Anamneses e Fichas Clínicas:** A Pluri Health fornece um construtor de formulários flexível e modular. A decisão sobre quais perguntas, campos, escalas ou informações clínicas serão coletadas do paciente é de **responsabilidade 100% exclusiva da Clínica e de seus profissionais de saúde**, atuando no estrito cumprimento da ética profissional e da legislação aplicável.
- É da Clínica a competência indelegável de obter as bases legais cabíveis (ex.: tutela da saúde ou consentimento livre e informado do paciente), respeitar o princípio da necessidade/minimização (Art. 6º, III da LGPD) e garantir a exatidão dos dados inseridos.

### 2.2. A Pluri Health (Operadora de Dados da Infraestrutura)
- A Pluri Health atua preponderantemente como **Operadora** de tecnologia em relação aos registros, formulários customizados, prontuários eletrônicos e dados de pacientes inseridos pelas Clínicas.
- Como o sistema é altamente modular e configurável pelo usuário, a Pluri Health **não determina, não prevê e não controla previamente o conteúdo clínico específico** que cada clínica decide coletar em suas fichas de avaliação. Nós fornecemos apenas a infraestrutura segura para processamento e armazenamento sob demanda.
- Atuamos como **Controladora** apenas em relação aos dados de cadastro direto dos Usuários da Plataforma (Owners e Colaboradores para gestão de conta, autenticação, cobrança de assinatura, segurança e prevenção a fraudes).

---

## 3. Dados Coletados e Formas de Coleta

Dividimos os dados tratados pela Pluri Health nas seguintes categorias essenciais:

### 3.1. Dados de Conta e Identificação (Profissionais e Clínicas)
- **Dados Cadastrais:** Nome completo, e-mail corporativo/pessoal, telefone/WhatsApp, CPF, documento profissional de classe (ex.: CREFITO, CRM, CRP), nome fantasia e Razão Social da clínica, CNPJ e endereço.
- **Credenciais de Acesso:** Senha criptografada (hash seguro via algoritmos de derivação de chaves), credenciais de segundo fator (2FA TOTP), logs de autenticação e identificador global de usuário (`usr_xxx`).
- **Dados Financeiros de Assinatura:** Dados para faturamento de planos (processados diretamente via gateway de pagamento parceiro em conformidade PCI-DSS; a Pluri Health não armazena números completos de cartão de crédito).

### 3.2. Dados de Pacientes inseridos pelas Clínicas (Dados Pessoais e Sensíveis Definidos pela Clínica)
- **Identificação Cadastral Básica do Paciente:** Nome completo, CPF, RG, data de nascimento, sexo/gênero, contato de emergência, nome do responsável legal (para menores de idade), telefone, e-mail e endereço.
- **Campos Clínicos Modulares e Customizados (Sensíveis):** Em razão da arquitetura aberta e modular dos formulários de anamnese e fichas de avaliação da Plataforma, os dados clínicos coletados são definidos autonomamente por cada profissional ou clínica. Tais campos podem abranger histórico de saúde, diagnósticos, evolução de tratamento, condutas fisioterapêuticas/médicas, anotações clínicas e documentos ou laudos anexados. A definição da extensão dessa coleta e a sua pertinência clínica são de inteira e exclusiva responsabilidade da Clínica Controladora.

### 3.3. Dados de Navegação, Metadados e Telemetria
- **Dados Técnicos:** Endereço IP (anonimizado para telemetria analítica), tipo de navegador, sistema operacional, fuso horário/timezone do dispositivo (para integridade de agendamentos) e resolução de tela.
- **Logs de Auditoria e Segurança:** Registros de data/hora de login, visualização ou edição de prontuários (para rastreabilidade de acesso exigida pelos conselhos profissionais).
- **Cookies e Armazenamento Local:** Cookies técnicos e itens de IndexedDB/LocalStorage estritamente necessários para manter a sessão ativa, preferências de idioma/marca e suporte offline temporário. Não utilizamos cookies invasivos de terceiros para rastreamento publicitário sem consentimento prévio.

---

## 4. Finalidades e Bases Legais do Tratamento

Todo tratamento de dados realizado pela Pluri Health fundamenta-se estritamente em hipóteses previstas na legislação (Art. 7º e Art. 11 da LGPD; Art. 6º e Art. 9º do GDPR):

| Categoria de Dado | Finalidade Principal | Base Legal (LGPD / GDPR) |
| :--- | :--- | :--- |
| **Dados de Cadastro do Usuário/Clínica** | Criação de conta, autenticação segura, gestão da assinatura e suporte técnico. | Execução de Contrato (Art. 7º, V) |
| **Dados Sensíveis do Paciente (Prontuário)** | Armazenamento de evoluções, agendamento de consultas e continuidade do cuidado. | Tutela da Saúde (Art. 11, II, "f") sob instrução da Clínica Controladora |
| **Notificações e Lembretes (WhatsApp/SMS)** | Envio de avisos de horário, confirmação e reagendamento de consultas. | Execução de Contrato e Consentimento do Paciente |
| **Logs de Acesso e Auditoria** | Cumprimento do Marco Civil da Internet (Art. 15), rastreabilidade de acessos a prontuários e auditoria clínica. | Cumprimento de Obrigação Legal (Art. 7º, II) e Legítimo Interesse (Art. 7º, IX) |
| **Telemetria e Métricas Agregadas** | Análise de desempenho da plataforma, detecção de erros de runtime e otimização de infraestrutura (Zero-PHI). | Legítimo Interesse (Art. 7º, IX) com anonimização ativa |

> [!IMPORTANT]
> **Proibição de Venda de Dados:** A Pluri Health **nunca** vende, aluga ou monetiza dados de pacientes, prontuários ou cadastros de clínicas sob nenhuma hipótese.

---

## 5. Compartilhamento de Dados com Suboperadores e Categorias de Infraestrutura

Para prestar um serviço de alta performance, resiliência clínica contínua e conformidade médica, a Pluri Health contrata fornecedores de infraestrutura e plataformas especializadas de padrão internacional (Suboperadores / Sub-processors). Todos são submetidos a criteriosa avaliação de segurança e vinculados a acordos estritos de processamento de dados (DPA):

1. **Infraestrutura em Nuvem e Banco de Dados Gerenciado:** Provedores de nuvem de padrão enterprise com centros de processamento de dados de alta segurança física e lógica, criptografia de dados em repouso e certificações independentes de conformidade (ISO/IEC 27001, SOC 2 Type II).
2. **Armazenamento de Documentos e Mídias Clínicas:** Camada especializada de armazenamento em nuvem com alta durabilidade, redundância geográfica e controle criptográfico estrito para salvaguarda de anexos e arquivos clínicos.
3. **Plataforma de Mensageria e Notificações Automatizadas:** Gateways corporativos de mensageria instantânea (como WhatsApp Business API) e comunicações transacionais, operados sob permissão estrita e exclusivamente para o envio de lembretes e avisos operacionais agendados pela clínica.
4. **Camada de Confiabilidade e Telemetria (Zero-PHI):** Serviços especializados de diagnóstico e estabilidade operacional, blindados por algoritmo próprio de sanitização que remove qualquer dado pessoal ou clínico na origem antes do envio de métricas técnicas.
5. **Gateway de Cobrança e Serviços Financeiros:** Instituições de pagamento autorizadas e supervisionadas pelo Banco Central do Brasil, homologadas no padrão PCI-DSS, responsáveis pelo processamento seguro das assinaturas e emissão de cobranças.
6. **Cumprimento Legal e Requisições Oficiais:** Apenas em casos estritos em que houver determinação judicial regular ou requisição formal de autoridade legalmente competente (como o Poder Judiciário ou a ANPD), nos limites estritos da lei.

---

## 6. Transferência Internacional de Dados

Determinados componentes de nossa infraestrutura de computação em nuvem operam em data centers de excelência técnica localizados no exterior (como nos Estados Unidos ou na União Europeia). Toda e qualquer transferência internacional de dados é realizada sob estritas salvaguardas jurídicas e técnicas, incluindo:
- Cláusulas Padrão Contratuais (Standard Contractual Clauses - SCCs) e termos de conformidade com o GDPR;
- Regulamentações aplicáveis da ANPD pertinentes à transferência internacional de dados pessoais (Resolução CD/ANPD nº 19/2024);
- Acordos de Associação de Negócios e aditivos de privacidade que asseguram aos dados dos usuários brasileiros nível de proteção equivalente ou superior ao exigido pela LGPD.

---

## 7. Segurança da Informação, Arquitetura Multicloud e Salvaguardas de Alto Nível

A segurança e a inviolabilidade das informações constituem a prioridade absoluta da engenharia da Pluri Health. Empregamos uma abordagem de **defesa em profundidade (Defense-in-Depth)** e padrões reconhecidos mundialmente para manter seus dados clínicos permanentemente íntegros, privados e disponíveis:

### 7.1. O Diferencial da Arquitetura Multicloud para a Segurança da Clínica
A Pluri Health opera sob uma **arquitetura moderna e distribuída em Multicloud**, o que traz vantagens decisivas de segurança, confiabilidade e proteção de dados para a sua clínica:
- **Resiliência e Continuidade de Negócio (Zero Single Point of Failure):** A segregação de serviços entre diferentes provedores globais de nuvem de primeira linha garante que a operação do consultório não dependa de uma infraestrutura centralizada única. Caso um datacenter enfrente instabilidade regional, as demais camadas de dados e comunicação permanecem isoladas e protegidas.
- **Isolamento de Funções e Princípio da Menor Exposição:** Em vez de concentrar autenticação, prontuários, arquivos pesados e telemetria em um único servidor, cada camada opera em ambientes especializados com barreiras independentes de segurança.
- **Redundância e Sobrevivência de Dados:** Backups criptografados e salvaguardas de arquivos contam com replicação redundante de altíssima durabilidade, garantindo a preservação legal de prontuários médicos mesmo em cenários extremos de desastre técnico.

### 7.2. Padrões Criptográficos e Controles de Acesso
- **Criptografia Avançada em Trânsito (TLS 1.3):** Todo o tráfego entre os navegadores/dispositivos e nossos servidores é criptografado obrigatoriamente por protocolos modernos HTTPS com certificados digitais fortes, impedindo qualquer tentativa de interceptação (*eavesdropping* ou ataques *man-in-the-middle*).
- **Criptografia em Repouso (Padrão AES-256):** Todos os bancos de dados, volumes de armazenamento e cópias de segurança permanecem cifrados em repouso com o algoritmo AES-256, o mais rigoroso padrão de criptografia simétrica adotado por instituições financeiras e governos.
- **Isolamento Lógico Estrito de Clínicas (Multi-Tenant com Políticas em Nível de Linha):** O sistema utiliza isolamento lógico por tenant no nível do motor do banco de dados (Row Level Security). Esse mecanismo impede estruturalmente que os registros de uma clínica sejam consultados, cruzados ou visualizados por qualquer outro usuário de outra clínica.
- **Controle de Acesso Baseado em Funções (RBAC com Privilégio Mínimo):** O Administrador da Clínica governa com granularidade os privilégios de cada profissional, assistente ou estagiário (`can(capability)`), assegurando que cada colaborador acesse estritamente o necessário para sua atribuição profissional.
- **Autenticação Segura com Segundo Fator (2FA/MFA via TOTP):** Proteção reforçada contra sequestro de contas por meio de suporte nativo a autenticadores em dois fatores, aliada a mecanismos de proteção contra ataques automatizados de força bruta (*rate-limiting* inteligente).
- **Trilha de Auditoria Clínica Ativa:** O sistema registra data, hora e autoria de ações críticas e acessos a prontuários, viabilizando rastreabilidade completa e compliance perante conselhos de classe (CFM, CREFITO, etc.).
- **Sanitização de Telemetria (Zero-PHI):** Nosso pipeline técnico conta com filtros inteligentes que eliminam proativamente dados de identificação pessoal e prontuários antes do envio de métricas técnicas, garantindo que nossas ferramentas de observabilidade monitorem a saúde do sistema sem jamais expor dados de pacientes.

> [!NOTE]
> Em consonância com as melhores práticas de governança e para proteger a integridade de nossas defesas, a Pluri Health detalha os padrões públicos e certificações de alto nível adotados, mantendo sob sigilo estrito detalhes operacionais internos, chaves criptográficas e topologias de rede cujo conhecimento público poderia fragilizar a segurança dos sistemas.

### 7.3. Processamento Local no Navegador (Client-Side Privacy)
Como parte do nosso compromisso de vanguarda com *Privacy by Design* e minimização do tráfego desnecessário de dados em rede:
- Determinadas ferramentas de apoio clínico (como o Corretor Ortográfico Clínico contextual e o Estúdio de Demarcações em Fotos de Exames) operam através de processamento **local no navegador (Client-Side)**.
- Isso significa que o texto digitado durante a digitação de notas e rascunhos rápidos é processado diretamente na memória volátil do dispositivo do profissional, sem depender do envio a servidores externos ou motores remotos de inteligência artificial de terceiros para simples conferência textual, preservando a intimidade do atendimento.

### 7.4. Gestão de Acessos e Desligamento de Colaboradores (Offboarding)
- O Administrador da Clínica (Owner) possui autonomia total para criar, alterar e inativar contas de colaboradores vinculados à clínica.
- É **obrigação e responsabilidade estrita da Clínica** revogar imediatamente o acesso de qualquer profissional de saúde, assistente, recepcionista ou estagiário assim que ocorrer o término do respectivo vínculo empregatício, societário ou de estágio.
- A Pluri Health não se responsabiliza por acessos indevidos realizados por ex-colaboradores caso a Clínica tenha sido omissa ou negligente na inativação imediata de suas respectivas credenciais.

---

## 8. Notificações, Mensageria Instantânea e Lembretes (WhatsApp)

A Plataforma disponibiliza integração para envio automatizado de lembretes de agenda e avisos de confirmação de consulta para pacientes:
- **Autorização Prévia Obrigatória:** É de responsabilidade exclusiva da Clínica assegurar que o paciente forneceu seu número de telefone e autorizou expressamente o recebimento de avisos operacionais de agendamento via WhatsApp ou SMS.
- **Isenção sobre Redes de Telecomunicação de Terceiros:** A entrega efetiva dessas comunicações depende da disponibilidade das redes de operadoras de telefonia e da infraestrutura da plataforma WhatsApp/Meta. A Pluri Health não se responsabiliza por eventuais falhas, bloqueios anti-spam locais configurados no dispositivo do paciente ou atrasos decorrentes de instabilidades sistêmicas dessas redes de terceiros.

---

## 9. Retenção, Ciclo de Vida dos Dados e Exceção Legal à Eliminação

### 9.1. Guarda Legal Obrigatória de Prontuários (Prazo de 20 Anos)
- Em conformidade com o Art. 6º da Lei Federal nº 13.787/2018 e as resoluções ético-profissionais dos conselhos de saúde (como CFM 1.821/2007 e diretrizes do COFFITO/CREFITO), os prontuários eletrônicos de pacientes devem ser mantidos pelo prazo mínimo obrigatório de **20 (vinte) anos** a contar da data do último registro de atendimento.
- A responsabilidade legal de manter a custódia desse acervo é da **Clínica (Controladora)**. Enquanto a assinatura estiver ativa, a Pluri Health mantém os dados salvaguardados com segurança contínua.

### 9.2. Exceção Legal ao Direito de Eliminação de Prontuários (Art. 16, I da LGPD)
- Esclarece-se expressamente aos titulares de dados (pacientes) que a solicitação de **eliminação ou exclusão de dados** prevista no Art. 18, VI da LGPD **NÃO é aplicável ao prontuário clínico de saúde** antes de decorrido o prazo legal de 20 anos.
- O armazenamento do prontuário durante esse período fundamenta-se no cumprimento de obrigação legal e regulatória (Art. 16, I da LGPD e Art. 17, 3, "b" do GDPR) e na tutela do exercício regular de direitos em eventual defesa em processos judiciais ou éticos. Caso um paciente solicite a exclusão de seu prontuário, a Clínica e a Pluri Health prestarão os esclarecimentos legais pertinentes, sendo vedado o descarte antecipado.

### 9.3. Encerramento de Contrato e Portabilidade
- Ao solicitar o cancelamento da conta, a Clínica tem direito à **portabilidade integral dos dados** (exportação estruturada de pacientes, fichas e prontuários) no prazo de até 30 (trinta) dias.
- Findo o prazo acordado ou após solicitação formal de exclusão pela Clínica, a Pluri Health realizará a desativação da conta e o expurgo ou anonimização definitiva das informações em seus servidores operacionais, ressalvada a retenção de dados estritamente necessária ao cumprimento de obrigações fiscais e regulatórias nossas perante órgãos tributários (ex.: notas fiscais por 5 anos).

---

## 10. Tratamento de Dados do Programa de Parceiros e Afiliados

A Pluri Health mantém um programa de parceria e afiliados voltado a profissionais e empresas promotoras:
- **Segregação Estrita de Bases:** Os dados cadastrais, contratuais e bancários de afiliados são processados em bases segregadas, utilizadas estritamente para apuração de comissões, cumprimento de exigências fiscais/tributárias e validação cadastral (KYC).
- **Sem Cruzamento com Dados Médicos:** Os dados de afiliados jamais são cruzados, compartilhados ou vinculados aos prontuários clínicos de pacientes de clínicas atendidas pela Plataforma.

---

## 11. Tratamento de Dados de Menores de Idade

O atendimento de pacientes crianças e adolescentes exige cuidados reforçados. O Pluri Health disponibiliza funcionalidade específica e o [[Termo de Consentimento para Menor de Idade (LGPD)]], em estrita conformidade com o Art. 14 da LGPD:
- O cadastro de menores na Plataforma exige a indicação e qualificação expressa de pelo menos um dos pais ou do responsável legal.
- Os dados de saúde do menor são tratados no melhor interesse da criança/adolescente e com a finalidade exclusiva de prestação da assistência fisioterapêutica/médica pela Clínica.

---

## 12. Direitos dos Titulares de Dados

Tanto os profissionais de saúde cadastrados quanto os pacientes possuem direitos garantidos pela legislação de privacidade (Art. 18 da LGPD e Arts. 15-22 do GDPR):

1. **Confirmação e Acesso:** Saber se a Plataforma trata seus dados e obter cópia legível das informações.
2. **Correção:** Solicitar a retificação de dados pessoais incompletos, inexatos ou desatualizados.
3. **Anonimização, Bloqueio ou Eliminação:** Solicitar a eliminação de dados pessoais que sejam considerados excessivos ou tratados em desconformidade legal (observada a exceção legal de guarda obrigatória de prontuários descrita na Seção 9.2).
4. **Portabilidade:** Obter seus dados em formato interoperável (ex.: JSON/CSV/ZIP) para transferência a outro fornecedor de serviços.
5. **Informação sobre Compartilhamento:** Saber com quais categorias de infraestrutura os dados foram compartilhados.
6. **Revogação do Consentimento:** Revogar o consentimento previamente fornecido para finalidades opcionais (ex.: comunicações informativas ou marketing).

> [!NOTE]
> **Canal para Pacientes da Clínica:** Caso você seja um paciente atendido por uma clínica que utiliza a Pluri Health, as solicitações de acesso ou retificação do seu prontuário clínico devem ser direcionadas **diretamente à sua Clínica (Controladora)**. Como Operadora, a Pluri Health prestará todo o auxílio técnico ao Administrador da Clínica para que sua solicitação seja atendida dentro dos prazos legais.

---

## 13. Notificação de Incidentes de Segurança

Caso ocorra qualquer incidente de segurança relevante que possa comprometer a confidencialidade ou integridade dos dados sob nossa guarda:
- A Pluri Health comunicará formalmente e sem demora injustificada às Clínicas afetadas (Controladores), detalhando a natureza do incidente, os dados potencialmente envolvidos e as medidas de mitigação adotadas, permitindo que a Clínica cumpra suas obrigações de notificação perante a ANPD e os titulares em até 3 dias úteis (ou no prazo determinado pelas normas da ANPD);
- Colaboraremos ativamente na investigação forense e na contenção imediata do evento.

---

## 14. Contato do Encarregado de Dados (DPO)

Para exercer seus direitos de privacidade, tirar dúvidas sobre esta Política ou enviar comunicações formais sobre o tratamento de seus dados na Pluri Health, entre em contato com nosso Encarregado de Proteção de Dados:

- **Controlador da Plataforma:** Pluri Health Tecnologia Ltda.
- **Encarregado pelo Tratamento de Dados (DPO):** Jougy & Time de Privacidade e Governança Pluri Health
- **Canal Oficial de Privacidade / E-mail do DPO:** `privacidade@pluri.health` / `dpo@pluri.health`
- **Endereço Institucional:** Brasil

---

## 15. Alterações e Atualizações desta Política

A Pluri Health poderá atualizar esta Política de Privacidade a qualquer tempo para refletir melhorias contínuas de produto, novos recursos ou alterações legislativas.
- Sempre que houver alterações substanciais nas finalidades ou no modo de tratamento, publicaremos um aviso destacado na Plataforma ou notificaremos os Administradores de Clínica via e-mail ou aviso no painel antes da entrada em vigor das alterações.
- O uso continuado da Plataforma após o aviso de atualização constitui o consentimento e a ciência das novas diretrizes estabelecidas.

---

*Documento integrante da governança jurídica da Vault Pluri Health. Registrado em conformidade com as diretrizes da ANPD, LGPD, GDPR e boas práticas em saúde digital.*
