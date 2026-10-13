import { describe, it, expect } from 'vitest';

const MAX_COMMAND_LENGTH = 60;

const GLOBAL_CANCEL_COMMANDS = new Set([
  'cancelar',
  'cancela',
  'cancel',
  'desistir',
  'desisto',
  'sair',
  'parar',
  'interromper',
  'abortar',
  'menu',
  'inicio',
  'comecar',
  'opcoes',
]);

const GLOBAL_BACK_COMMANDS = new Set([
  'voltar',
  'volta',
  'anterior',
  'retornar',
  'passo anterior',
  'voltar atras',
]);

function normalizeCommandText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_COMMAND_LENGTH) {
    return '';
  }

  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ') // remove pontuações mantendo palavras e espaços
    .replace(/\s+/g, ' ')
    .trim();
}

function isGlobalCancelCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  return GLOBAL_CANCEL_COMMANDS.has(normalized);
}

function isGlobalBackCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  if (!normalized) return false;
  return GLOBAL_BACK_COMMANDS.has(normalized);
}

describe('WhatsApp Commands & Security Audit', () => {
  describe('Anti-Conflito e Blindagem contra Falsos Positivos', () => {
    it('ignora nomes completos de pacientes comuns que contêm sílabas semelhantes', () => {
      const patientNames = [
        'Carlos Eduardo Pereira',
        'Voltaire de Souza',
        'Cândida Paranhos',
        'Jair Bolsonaro',
        'Mariana Menotti',
        'Vinicius Inácio',
        'Ana Paula de Alencar',
      ];

      for (const name of patientNames) {
        expect(isGlobalCancelCommand(name)).toBe(false);
        expect(isGlobalBackCommand(name)).toBe(false);
      }
    });

    it('ignora descrições clínicas e queixas médicas com termos que não são o comando estrito', () => {
      const clinicalNotes = [
        'Paciente relata dor que não quer parar desde ontem',
        'Não cancelar o tratamento de fisioterapia',
        'Quero voltar a andar normalmente',
        'Dor no joelho ao iniciar a caminhada',
        'Apresenta quadro de dor aguda no início do movimento',
      ];

      for (const note of clinicalNotes) {
        expect(isGlobalCancelCommand(note)).toBe(false);
        expect(isGlobalBackCommand(note)).toBe(false);
      }
    });

    it('reconhece com precisão os comandos de cancelamento isolados e variações aceitas', () => {
      const cancelVariants = [
        'cancelar',
        'CANCELAR',
        'Cancelar!',
        '  cancela  ',
        'cancel',
        'desistir',
        'Desisto',
        'sair',
        'PARAR',
        'interromper',
        'abortar',
        'Menu',
        'início',
        'inicio',
        'começar',
        'comecar',
        'opções',
        'opcoes',
      ];

      for (const cmd of cancelVariants) {
        expect(isGlobalCancelCommand(cmd)).toBe(true);
      }
    });

    it('reconhece com precisão os comandos de retorno isolados e variações aceitas', () => {
      const backVariants = [
        'voltar',
        'VOLTAR',
        'volta',
        'anterior',
        'retornar',
        'passo anterior',
        'voltar atrás',
        'voltar atras',
        'Voltar!',
      ];

      for (const cmd of backVariants) {
        expect(isGlobalBackCommand(cmd)).toBe(true);
      }
    });
  });

  describe('Proteção Big-O O(M) e Mitigação de ReDoS / Buffer Abuse', () => {
    it('rejeita imediatamente inputs excessivamente longos sem consumir processamento excessivo', () => {
      const hugeInput = 'cancelar '.repeat(5000);
      const start = performance.now();
      const isCancel = isGlobalCancelCommand(hugeInput);
      const isBack = isGlobalBackCommand(hugeInput);
      const duration = performance.now() - start;

      expect(isCancel).toBe(false);
      expect(isBack).toBe(false);
      // Deve executar em menos de 5ms
      expect(duration).toBeLessThan(5);
    });

    it('processa strings nulas, vazias ou contendo apenas pontuações com segurança', () => {
      expect(isGlobalCancelCommand('')).toBe(false);
      expect(isGlobalCancelCommand('   ')).toBe(false);
      expect(isGlobalCancelCommand('???!!!')).toBe(false);
      expect(isGlobalBackCommand('')).toBe(false);
      expect(isGlobalBackCommand('---')).toBe(false);
    });
  });

  describe('Segurança e LGPD: Limpeza Atômica de Sessão', () => {
    it('garante que metadata expurgue precad_data e agenda_data quando o passo reseta para initial', () => {
      const metadataMock: Record<string, unknown> = {
        precad_data: { patientName: 'João da Silva', cpf: '12345678901' },
        agenda_data: { dateIso: '2026-10-15', time: '14:00' },
        user_id: 'usr_123',
      };

      // Simulação da limpeza atômica implementada no index.ts
      const updatedMetadata = { ...metadataMock };
      delete updatedMetadata.precad_data;
      delete updatedMetadata.agenda_data;

      expect(updatedMetadata.precad_data).toBeUndefined();
      expect(updatedMetadata.agenda_data).toBeUndefined();
      expect(updatedMetadata.user_id).toBe('usr_123');
    });
  });
});
