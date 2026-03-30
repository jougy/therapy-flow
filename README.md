# Pronto Health - Fisio

Pronto Health - Fisio e uma plataforma para organizacao clinica, prontuario e acompanhamento de pacientes, pensada para operacao simples no dia a dia e evolucao gradual com base em feedback real de uso.

## Ideia do projeto

O foco do produto e concentrar em um unico sistema:

- agenda de atendimentos e eventos
- gestao de pacientes
- grupos de acompanhamento por paciente
- prontuario e historico de sessoes
- operacao compartilhada entre colaboradores da mesma clinica

## Direcao do MVP

Neste momento, o produto esta sendo estruturado para:

- funcionar bem para clinicas pequenas e medias
- permitir mais de um colaborador por clinica
- manter os dados organizados pela clinica
- registrar autoria e profissional responsavel sem introduzir RBAC completo ainda
- evoluir por etapas, com entregas utilizaveis desde cedo

## Documentacao principal

- Visao central e mapa dos documentos: [CORE.md](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/CORE.md)
- Ambiente local, deploy e operacao tecnica: [AMBIENTE_E_OPERACAO.md](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/AMBIENTE_E_OPERACAO.md)
- Estrutura inicial de clinica e colaborador no MVP: [CLINICA_COLABORADOR_MVP.md](/Users/jougy/Documents/programacao/Prontuario/therapy-flow/CLINICA_COLABORADOR_MVP.md)

## Estado atual

O projeto usa frontend em Vite + React e backend em Supabase, com desenvolvimento local separado do ambiente de producao e deploy automatico a partir da `main`.
