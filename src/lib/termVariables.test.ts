import { describe, expect, it } from "vitest";
import {
  SUGGESTED_TERM_VARIABLES,
  extractVariablesFromMarkdown,
  formatCurrentTimeHHMM,
  formatDateExtenso,
  interpolateTermVariables,
  renderElectronicSignatureStamp,
} from "./termVariables";

describe("termVariables", () => {
  describe("SUGGESTED_TERM_VARIABLES", () => {
    it("contains all standard and newly requested variables", () => {
      const keys = SUGGESTED_TERM_VARIABLES.map((v) => v.key);
      const expectedKeys = [
        "<nome_paciente>",
        "<cpf_paciente>",
        "<data_nascimento_paciente>",
        "<telefone_paciente>",
        "<email_paciente>",
        "<rg_paciente>",
        "<endereco_paciente>",
        "<estado_civil_paciente>",
        "<profissao_paciente>",
        "<assinatura_paciente>",
        "<nome_responsavel>",
        "<cpf_responsavel>",
        "<telefone_responsavel>",
        "<assinatura_responsavel>",
        "<nome_colaborador>",
        "<email_colaborador>",
        "<crp_crm_colaborador>",
        "<assinatura_colaborador>",
        "<nome_owner>",
        "<crm_owner>",
        "<assinatura_owner>",
        "<nome_clinica>",
        "<cnpj_clinica>",
        "<endereco_clinica>",
        "<telefone_clinica>",
        "<email_clinica>",
        "<cidade_clinica>",
        "<data_atual>",
        "<horario_atual>",
        "<data_extenso>",
        "<valor_sessao>",
        "<duracao_sessao>",
      ];

      for (const expectedKey of expectedKeys) {
        expect(keys).toContain(expectedKey);
      }
    });
  });

  describe("extractVariablesFromMarkdown", () => {
    it("extracts custom and default variables in <variable> format", () => {
      const text = `
# Termo da Clínica <nome_clinica>
Eu, <nome_paciente>, portador do CPF <cpf_paciente>, confirmo atendimento com <nome_colaborador>.
Em caso de menor, responsável: <nome_responsavel>.
Variável customizada criada pelo usuário: <campo_customizado_xyz>.
Data: <data_atual>.
      `;

      const variables = extractVariablesFromMarkdown(text);
      expect(variables).toEqual([
        "<nome_clinica>",
        "<nome_paciente>",
        "<cpf_paciente>",
        "<nome_colaborador>",
        "<nome_responsavel>",
        "<campo_customizado_xyz>",
        "<data_atual>",
      ]);
    });

    it("deduplicates multiple occurrences of the same variable", () => {
      const text = `O paciente <nome_paciente> assina aqui. Paciente: <nome_paciente>.`;
      const variables = extractVariablesFromMarkdown(text);
      expect(variables).toEqual(["<nome_paciente>"]);
    });

    it("ignores standard HTML tags like <p>, <br>, <strong>", () => {
      const text = `<p>Olá mundo<br>Texto <strong>negrito</strong> com <nome_paciente>.</p>`;
      const variables = extractVariablesFromMarkdown(text);
      expect(variables).toEqual(["<nome_paciente>"]);
    });

    it("returns empty array when text has no variables", () => {
      const text = `Texto comum sem nenhuma tag de variável.`;
      expect(extractVariablesFromMarkdown(text)).toEqual([]);
    });
  });

  describe("interpolateTermVariables", () => {
    it("replaces variables using keys with angle brackets", () => {
      const template = `Eu, <nome_paciente>, CPF <cpf_paciente>, em <data_atual>.`;
      const values = {
        "<nome_paciente>": "Ana Paula",
        "<cpf_paciente>": "123.456.789-00",
        "<data_atual>": "16/11/2026",
      };

      const result = interpolateTermVariables(template, values);
      expect(result).toBe("Eu, Ana Paula, CPF 123.456.789-00, em 16/11/2026.");
    });

    it("replaces variables using keys without angle brackets", () => {
      const template = `Clínica: <nome_clinica> - Terapeuta: <nome_colaborador>.`;
      const values = {
        nome_clinica: "Clínica Vida",
        nome_colaborador: "Dr. Roberto",
      };

      const result = interpolateTermVariables(template, values);
      expect(result).toBe("Clínica: Clínica Vida - Terapeuta: Dr. Roberto.");
    });

    it("preserves variables not present in dictionary and leaves HTML tags alone", () => {
      const template = `<p>Olá <nome_paciente>, pendente: <outro_campo>.</p>`;
      const values = {
        nome_paciente: "Carlos",
      };

      const result = interpolateTermVariables(template, values);
      expect(result).toBe("<p>Olá Carlos, pendente: <outro_campo>.</p>");
    });

    it("interpolates all new patient, guardian, owner, clinic, and session variables", () => {
      const template = [
        "Owner: <nome_owner> (<crm_owner>)",
        "Paciente: <rg_paciente>, <estado_civil_paciente>, <profissao_paciente>, <endereco_paciente>",
        "Responsável: <cpf_responsavel> - <telefone_responsavel>",
        "Clínica: <endereco_clinica>, <cidade_clinica>, <telefone_clinica>, <email_clinica>",
        "Sessão: <valor_sessao> (<duracao_sessao>)",
      ].join("\n");

      const result = interpolateTermVariables(template, {
        nome_owner: "Dra. Juliana",
        crm_owner: "CRM/SP 998877",
        rg_paciente: "12.345.678-9",
        estado_civil_paciente: "Casado(a)",
        profissao_paciente: "Arquiteto(a)",
        endereco_paciente: "Rua A, 10",
        cpf_responsavel: "222.333.444-55",
        telefone_responsavel: "(11) 99999-0000",
        endereco_clinica: "Av. Central, 500",
        cidade_clinica: "São Paulo - SP",
        telefone_clinica: "(11) 3000-1000",
        email_clinica: "contato@pluri.com.br",
        valor_sessao: "R$ 200,00",
        duracao_sessao: "50 min",
      });

      expect(result).toContain("Owner: Dra. Juliana (CRM/SP 998877)");
      expect(result).toContain("Paciente: 12.345.678-9, Casado(a), Arquiteto(a), Rua A, 10");
      expect(result).toContain("Responsável: 222.333.444-55 - (11) 99999-0000");
      expect(result).toContain("Clínica: Av. Central, 500, São Paulo - SP, (11) 3000-1000, contato@pluri.com.br");
      expect(result).toContain("Sessão: R$ 200,00 (50 min)");
    });

    it("formats <horario_atual> (hh:mm) and <data_extenso> automatically when omitted from values", () => {
      const fixedDate = new Date(2026, 10, 16, 9, 5); // 16/11/2026 09:05
      expect(formatCurrentTimeHHMM(fixedDate)).toBe("09:05");
      expect(formatDateExtenso(fixedDate)).toBe("16 de novembro de 2026");

      const result = interpolateTermVariables(
        "Emitido em <data_extenso> às <horario_atual>.",
        {},
        { now: fixedDate }
      );
      expect(result).toBe("Emitido em 16 de novembro de 2026 às 09:05.");
    });

    it("renders Gov.br-style electronic signature stamp for collaborator with .webp image and council", () => {
      const fixedDate = new Date(2026, 10, 16, 14, 30);
      const template = "Assinatura:\n\n<assinatura_colaborador>";
      const result = interpolateTermVariables(
        template,
        {
          cidade_clinica: "Curitiba - PR",
        },
        {
          now: fixedDate,
          signatures: {
            colaborador: {
              fullName: "Dr. Carlos Eduardo",
              cpf: "123.456.789-00",
              councilRegistration: "CREFITO-8/12345-F",
              globalUserId: "usr_abc123",
              signatureWebpUrl: "data:image/webp;base64,UklGRh4AAABXRUJQVlA4",
            },
          },
        }
      );

      expect(result).toContain("Documento assinado virtualmente");
      expect(result).toContain("![Assinatura de Dr. Carlos Eduardo](data:image/webp;base64,UklGRh4AAABXRUJQVlA4)");
      expect(result).toContain("**Nome completo:** Dr. Carlos Eduardo");
      expect(result).toContain("**CPF:** 123.456.789-00");
      expect(result).toContain("**Conselho Regional:** CREFITO-8/12345-F");
      expect(result).toContain("**Data:** 16/11/2026");
      expect(result).toContain("**Horário:** 14:30");
      expect(result).toContain("**Local:** Curitiba - PR");
      expect(result).toContain("`usr_abc123`");
    });

    it("omits Conselho Regional in stamp when signer has none (e.g. patient or guardian)", () => {
      const result = interpolateTermVariables(
        "<assinatura_paciente>\n\n<assinatura_responsavel>",
        {},
        {
          signatures: {
            paciente: {
              fullName: "Maria da Silva",
              cpf: "999.888.777-66",
              date: "16/11/2026",
              time: "15:10",
              location: "São Paulo - SP",
              globalUserId: "usr_pat99",
            },
            responsavel: {
              fullName: "João da Silva",
              cpf: "111.222.333-44",
              date: "16/11/2026",
              time: "15:12",
              location: "São Paulo - SP",
              globalUserId: "usr_resp11",
            },
          },
        }
      );

      expect(result).toContain("**Nome completo:** Maria da Silva");
      expect(result).toContain("**Nome completo:** João da Silva");
      expect(result).toContain("`usr_pat99`");
      expect(result).toContain("`usr_resp11`");
      expect(result).not.toContain("Conselho Regional");
    });

    it("renders owner stamp when .webp signature URL is passed via values dictionary", () => {
      const fixedDate = new Date(2026, 10, 16, 16, 45);
      const result = interpolateTermVariables(
        "<assinatura_owner>",
        {
          nome_owner: "Dra. Juliana Mendes",
          crm_owner: "CRM/SP 123456",
          cpf_owner: "333.444.555-66",
          cidade_clinica: "Campinas - SP",
          id_global_owner: "usr_owner01",
          assinatura_owner: "data:image/webp;base64,AAAA",
        },
        { now: fixedDate }
      );

      expect(result).toContain("Documento assinado virtualmente");
      expect(result).toContain("Dra. Juliana Mendes");
      expect(result).toContain("CRM/SP 123456");
      expect(result).toContain("16:45");
      expect(result).toContain("Campinas - SP");
      expect(result).toContain("usr_owner01");
      expect(result).toContain("data:image/webp;base64,AAAA");
    });

    it("renders HTML stamp format when requested and leaves signature tag untouched when no data is available", () => {
      const untouched = interpolateTermVariables("Espaço: <assinatura_colaborador>", {});
      expect(untouched).toBe("Espaço: <assinatura_colaborador>");

      const htmlStamp = renderElectronicSignatureStamp(
        {
          fullName: "Dr. Teste",
          cpf: "000.111.222-33",
          councilRegistration: "CRP 06/5555",
          date: "16/11/2026",
          time: "10:00",
          location: "Belo Horizonte - MG",
          globalUserId: "usr_html1",
          signatureWebpUrl: "https://cdn.example.com/sig.webp",
        },
        "html"
      );

      expect(htmlStamp).toContain('data-signature-stamp="govbr"');
      expect(htmlStamp).toContain("Documento assinado virtualmente");
      expect(htmlStamp).toContain("Dr. Teste");
      expect(htmlStamp).toContain("CRP 06/5555");
      expect(htmlStamp).toContain("usr_html1");
      expect(htmlStamp).toContain("https://cdn.example.com/sig.webp");
    });
  });
});
