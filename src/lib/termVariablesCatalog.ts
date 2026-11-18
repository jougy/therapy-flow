/**
 * Catálogo padrão de variáveis sugeridas para Termos e Documentos Clínicos.
 * Reexportado por `@/lib/termVariables`.
 */

export type TermVariableCategory =
  | "paciente"
  | "responsavel"
  | "colaborador"
  | "owner"
  | "clinica"
  | "sessao"
  | "sistema";

export interface TermVariableDefinition {
  key: string;
  name: string;
  label: string;
  description: string;
  category: TermVariableCategory;
  example: string;
}

export const SUGGESTED_TERM_VARIABLES: readonly TermVariableDefinition[] = [
  // Paciente
  {
    key: "<nome_paciente>",
    name: "nome_paciente",
    label: "Nome do Paciente",
    description: "Nome completo do paciente atendido",
    category: "paciente",
    example: "Maria da Silva",
  },
  {
    key: "<cpf_paciente>",
    name: "cpf_paciente",
    label: "CPF do Paciente",
    description: "Cadastro de Pessoa Física do paciente",
    category: "paciente",
    example: "000.000.000-00",
  },
  {
    key: "<rg_paciente>",
    name: "rg_paciente",
    label: "RG do Paciente",
    description: "Documento de identidade (RG) do paciente",
    category: "paciente",
    example: "12.345.678-9",
  },
  {
    key: "<data_nascimento_paciente>",
    name: "data_nascimento_paciente",
    label: "Data de Nascimento do Paciente",
    description: "Data de nascimento no padrão DD/MM/AAAA",
    category: "paciente",
    example: "15/04/1990",
  },
  {
    key: "<estado_civil_paciente>",
    name: "estado_civil_paciente",
    label: "Estado Civil do Paciente",
    description: "Estado civil informado no cadastro do paciente",
    category: "paciente",
    example: "Solteiro(a)",
  },
  {
    key: "<profissao_paciente>",
    name: "profissao_paciente",
    label: "Profissão do Paciente",
    description: "Ocupação profissional do paciente",
    category: "paciente",
    example: "Professor(a)",
  },
  {
    key: "<endereco_paciente>",
    name: "endereco_paciente",
    label: "Endereço do Paciente",
    description: "Endereço residencial completo do paciente",
    category: "paciente",
    example: "Rua das Flores, 123, Centro - São Paulo/SP",
  },
  {
    key: "<telefone_paciente>",
    name: "telefone_paciente",
    label: "Telefone do Paciente",
    description: "Telefone celular ou WhatsApp de contato",
    category: "paciente",
    example: "(11) 98765-4321",
  },
  {
    key: "<email_paciente>",
    name: "email_paciente",
    label: "E-mail do Paciente",
    description: "Endereço eletrônico do paciente",
    category: "paciente",
    example: "paciente@email.com",
  },
  {
    key: "<assinatura_paciente>",
    name: "assinatura_paciente",
    label: "Assinatura Eletrônica do Paciente",
    description: "Carimbo de assinatura eletrônica (estilo Gov.br) com dados e assinatura do paciente",
    category: "paciente",
    example: "Carimbo digital com nome, CPF, data/hora, local e ID Global",
  },

  // Responsável Legal
  {
    key: "<nome_responsavel>",
    name: "nome_responsavel",
    label: "Nome do Responsável Legal",
    description: "Nome do responsável legal (para menores de idade ou tutelados)",
    category: "responsavel",
    example: "João da Silva",
  },
  {
    key: "<cpf_responsavel>",
    name: "cpf_responsavel",
    label: "CPF do Responsável Legal",
    description: "Cadastro de Pessoa Física do responsável legal",
    category: "responsavel",
    example: "111.222.333-44",
  },
  {
    key: "<telefone_responsavel>",
    name: "telefone_responsavel",
    label: "Telefone do Responsável Legal",
    description: "Telefone celular ou WhatsApp do responsável legal",
    category: "responsavel",
    example: "(11) 99876-5432",
  },
  {
    key: "<assinatura_responsavel>",
    name: "assinatura_responsavel",
    label: "Assinatura Eletrônica do Responsável",
    description: "Carimbo de assinatura eletrônica (estilo Gov.br) do responsável legal",
    category: "responsavel",
    example: "Carimbo digital com nome, CPF, data/hora, local e ID Global",
  },

  // Colaborador / Profissional
  {
    key: "<nome_colaborador>",
    name: "nome_colaborador",
    label: "Nome do Profissional / Colaborador",
    description: "Nome do terapeuta ou profissional que atende o paciente",
    category: "colaborador",
    example: "Dr. Carlos Eduardo",
  },
  {
    key: "<email_colaborador>",
    name: "email_colaborador",
    label: "E-mail do Colaborador",
    description: "E-mail institucional ou de contato do profissional",
    category: "colaborador",
    example: "carlos@clinica.com.br",
  },
  {
    key: "<crp_crm_colaborador>",
    name: "crp_crm_colaborador",
    label: "Registro Profissional (CRP / CRM / CREFITO)",
    description: "Número do conselho regional de classe profissional",
    category: "colaborador",
    example: "CREFITO-3/12345-F",
  },
  {
    key: "<assinatura_colaborador>",
    name: "assinatura_colaborador",
    label: "Assinatura Eletrônica do Colaborador",
    description: "Carimbo de assinatura eletrônica (estilo Gov.br) com dados, registro e imagem .webp do profissional",
    category: "colaborador",
    example: "Carimbo digital com nome, CPF, conselho, data/hora e assinatura",
  },

  // Owner / Proprietário da Clínica
  {
    key: "<nome_owner>",
    name: "nome_owner",
    label: "Nome do Proprietário (Owner)",
    description: "Nome completo do proprietário ou responsável técnico da clínica",
    category: "owner",
    example: "Dra. Juliana Mendes",
  },
  {
    key: "<crm_owner>",
    name: "crm_owner",
    label: "Conselho Regional do Owner (CRM / CRP / CREFITO)",
    description: "Número do registro profissional do proprietário da clínica",
    category: "owner",
    example: "CRM/SP 123456",
  },
  {
    key: "<assinatura_owner>",
    name: "assinatura_owner",
    label: "Assinatura Eletrônica do Owner",
    description: "Carimbo de assinatura eletrônica (estilo Gov.br) do proprietário da clínica",
    category: "owner",
    example: "Carimbo digital com nome, CPF, conselho, data/hora e assinatura",
  },

  // Clínica
  {
    key: "<nome_clinica>",
    name: "nome_clinica",
    label: "Nome da Clínica",
    description: "Nome fantasia ou razão social da clínica",
    category: "clinica",
    example: "Clínica Pluri Saúde",
  },
  {
    key: "<cnpj_clinica>",
    name: "cnpj_clinica",
    label: "CNPJ da Clínica",
    description: "Cadastro Nacional de Pessoa Jurídica da clínica",
    category: "clinica",
    example: "12.345.678/0001-90",
  },
  {
    key: "<endereco_clinica>",
    name: "endereco_clinica",
    label: "Endereço da Clínica",
    description: "Endereço completo da clínica",
    category: "clinica",
    example: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
  },
  {
    key: "<telefone_clinica>",
    name: "telefone_clinica",
    label: "Telefone da Clínica",
    description: "Telefone ou WhatsApp institucional da clínica",
    category: "clinica",
    example: "(11) 3333-4444",
  },
  {
    key: "<email_clinica>",
    name: "email_clinica",
    label: "E-mail da Clínica",
    description: "E-mail oficial de contato da clínica",
    category: "clinica",
    example: "contato@clinicapluri.com.br",
  },
  {
    key: "<cidade_clinica>",
    name: "cidade_clinica",
    label: "Cidade da Clínica",
    description: "Cidade/UF de localização da clínica",
    category: "clinica",
    example: "São Paulo - SP",
  },

  // Sessão / Atendimento
  {
    key: "<valor_sessao>",
    name: "valor_sessao",
    label: "Valor da Sessão",
    description: "Valor cobrado pelo atendimento ou sessão clínica",
    category: "sessao",
    example: "R$ 180,00",
  },
  {
    key: "<duracao_sessao>",
    name: "duracao_sessao",
    label: "Duração da Sessão",
    description: "Tempo previsto de duração do atendimento",
    category: "sessao",
    example: "50 minutos",
  },

  // Sistema / Data e Hora
  {
    key: "<data>",
    name: "data",
    label: "Data",
    description: "Data corrente do preenchimento ou assinatura (DD/MM/AAAA)",
    category: "sistema",
    example: "16/11/2026",
  },
  {
    key: "<data_atual>",
    name: "data_atual",
    label: "Data Atual",
    description: "Data corrente do preenchimento ou assinatura (DD/MM/AAAA)",
    category: "sistema",
    example: "16/11/2026",
  },
  {
    key: "<horario>",
    name: "horario",
    label: "Horário (hh:mm)",
    description: "Horário corrente da emissão ou assinatura no padrão hh:mm",
    category: "sistema",
    example: "14:30",
  },
  {
    key: "<horario_atual>",
    name: "horario_atual",
    label: "Horário Atual (hh:mm)",
    description: "Horário corrente da emissão ou assinatura no padrão hh:mm",
    category: "sistema",
    example: "14:30",
  },
  {
    key: "<data_extenso>",
    name: "data_extenso",
    label: "Data por Extenso",
    description: "Data corrente formatada por extenso em português",
    category: "sistema",
    example: "16 de novembro de 2026",
  },
];
