import { describe, it, expect } from 'vitest';
import {
  mapAffiliateStatusToStage,
  formatAffiliatePlan,
  formatAffiliateCycle,
  mapAffiliateConversionToContact,
  type AffiliateConversionRecord,
} from './adapters/useB2bAffiliateCrm';
import {
  calculatePatientStage,
  formatPatientDateDisplay,
  isSessionCompleted,
  mapPatientToContact,
  type PatientRecord,
  type PatientSessionRecord,
} from './adapters/useB2cPatientCrm';

describe('Marketing CRM Adapters', () => {
  describe('B2B Affiliate CRM Adapter (useB2bAffiliateCrm)', () => {
    describe('mapAffiliateStatusToStage', () => {
      it('correctly maps all 4 contract stages', () => {
        expect(mapAffiliateStatusToStage('trial')).toBe('new');
        expect(mapAffiliateStatusToStage('active')).toBe('active');
        expect(mapAffiliateStatusToStage('past_due')).toBe('grace_period');
        expect(mapAffiliateStatusToStage('canceled')).toBe('churn');
      });

      it('falls back to "new" on unrecognized or missing status', () => {
        expect(mapAffiliateStatusToStage(null)).toBe('new');
        expect(mapAffiliateStatusToStage(undefined)).toBe('new');
        expect(mapAffiliateStatusToStage('unknown_status')).toBe('new');
      });
    });

    describe('formatAffiliatePlan & formatAffiliateCycle', () => {
      it('formats standard plan types to Portuguese labels', () => {
        expect(formatAffiliatePlan('solo')).toBe('Plano Solo');
        expect(formatAffiliatePlan('clinic')).toBe('Plano Clínica');
        expect(formatAffiliatePlan('team')).toBe('Plano Equipe');
        expect(formatAffiliatePlan('enterprise')).toBe('Plano Enterprise');
        expect(formatAffiliatePlan('Plano Pro')).toBe('Plano Pro');
        expect(formatAffiliatePlan(null)).toBe('Plano Padrão');
      });

      it('formats billing cycles to Portuguese labels', () => {
        expect(formatAffiliateCycle('monthly')).toBe('Mensal');
        expect(formatAffiliateCycle('yearly')).toBe('Anual');
        expect(formatAffiliateCycle('quarterly')).toBe('Trimestral');
        expect(formatAffiliateCycle('semiannual')).toBe('Semestral');
        expect(formatAffiliateCycle(null)).toBe('Mensal');
      });
    });

    describe('mapAffiliateConversionToContact', () => {
      const baseConversion: AffiliateConversionRecord = {
        id: 'conv-12345678-abcd',
        affiliate_id: 'aff-001',
        clinic_id: 'clinic-001',
        customer_user_id: 'user-001',
        plan_type: 'clinic',
        billing_cycle: 'monthly',
        status: 'active',
        total_cycles_paid: 3,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-11-01T15:30:00Z',
        customer: {
          full_name: 'Dr. Roberto Souza',
          phone: '11987654321',
          email: 'roberto@clinica.com.br',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        affiliate: {
          coupon_code: 'FISIOVIP30',
        },
      };

      it('normalizes to CrmContact with targetType "affiliate_lead"', () => {
        const contact = mapAffiliateConversionToContact(baseConversion);

        expect(contact.id).toBe('conv-12345678-abcd');
        expect(contact.targetType).toBe('affiliate_lead');
        expect(contact.fullName).toBe('Dr. Roberto Souza');
        expect(contact.phone).toBe('11987654321');
        expect(contact.email).toBe('roberto@clinica.com.br');
        expect(contact.avatarUrl).toBe('https://example.com/avatar.jpg');
        expect(contact.stage).toBe('active');
        expect(contact.badgeLabel).toBe('Plano Clínica');
      });

      it('normalizes primary and secondary business metrics', () => {
        const contact = mapAffiliateConversionToContact(baseConversion);

        expect(contact.clinicalOrBusinessMetric.primaryLabel).toBe('Plano / Ciclo');
        expect(contact.clinicalOrBusinessMetric.primaryValue).toBe('Plano Clínica (Mensal)');
        expect(contact.clinicalOrBusinessMetric.secondaryLabel).toBe('Mensalidades Pagas');
        expect(contact.clinicalOrBusinessMetric.secondaryValue).toBe('3 ciclos');
      });

      it('formats single cycle grammatically correctly', () => {
        const singleCycle = { ...baseConversion, total_cycles_paid: 1 };
        const contact = mapAffiliateConversionToContact(singleCycle);
        expect(contact.clinicalOrBusinessMetric.secondaryValue).toBe('1 ciclo');
      });

      it('populates template variables: primeiro_nome, plano, status, cupom', () => {
        const contact = mapAffiliateConversionToContact(baseConversion);

        expect(contact.templateVariables.primeiro_nome).toBe('Dr.');
        expect(contact.templateVariables.plano).toBe('Plano Clínica');
        expect(contact.templateVariables.status).toBe('active');
        expect(contact.templateVariables.cupom).toBe('FISIOVIP30');
      });

      it('maps stages: trial -> new, past_due -> grace_period, canceled -> churn', () => {
        const trialContact = mapAffiliateConversionToContact({ ...baseConversion, status: 'trial' });
        expect(trialContact.stage).toBe('new');

        const pastDueContact = mapAffiliateConversionToContact({ ...baseConversion, status: 'past_due' });
        expect(pastDueContact.stage).toBe('grace_period');

        const canceledContact = mapAffiliateConversionToContact({ ...baseConversion, status: 'canceled' });
        expect(canceledContact.stage).toBe('churn');
      });
    });
  });

  describe('B2C Patient CRM Adapter (useB2cPatientCrm)', () => {
    const fixedNow = new Date('2026-11-10T12:00:00Z');

    const basePatient: PatientRecord = {
      id: 'patient-001',
      name: 'Mariana Silva de Oliveira',
      phone: '11999998888',
      email: 'mariana.silva@gmail.com',
      status: 'ativo',
      origin_insurance_plan: 'Bradesco Saúde Top',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-10-15T10:00:00Z',
    };

    describe('isSessionCompleted', () => {
      it('identifies completed sessions regardless of casing or accents', () => {
        expect(isSessionCompleted({ status: 'concluído' })).toBe(true);
        expect(isSessionCompleted({ status: 'concluido' })).toBe(true);
        expect(isSessionCompleted({ status: 'realizada' })).toBe(true);
        expect(isSessionCompleted({ status: 'agendada' })).toBe(false);
        expect(isSessionCompleted({ status: 'cancelada' })).toBe(false);
        expect(isSessionCompleted({ status: 'rascunho' })).toBe(false);
      });
    });

    describe('calculatePatientStage', () => {
      it('returns "new" when patient has no completed sessions', () => {
        const stage = calculatePatientStage(basePatient, [], fixedNow);
        expect(stage).toBe('new');

        const uncompletedSessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-11-08', status: 'agendada' },
          { id: 's2', patient_id: 'patient-001', session_date: '2026-11-05', status: 'cancelada' },
        ];
        expect(calculatePatientStage(basePatient, uncompletedSessions, fixedNow)).toBe('new');
      });

      it('returns "active" when patient had completed session in the last 30 days', () => {
        // Sessão há 10 dias (31 de outubro de 2026)
        const activeSessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-10-31', status: 'concluído' },
        ];
        expect(calculatePatientStage(basePatient, activeSessions, fixedNow)).toBe('active');
      });

      it('returns "stalled" when patient has no sessions in the last 30 days (> 30 days ago)', () => {
        // Sessão há 45 dias (26 de setembro de 2026)
        const stalledSessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-09-26', status: 'concluído' },
        ];
        expect(calculatePatientStage(basePatient, stalledSessions, fixedNow)).toBe('stalled');
      });

      it('returns "churn" when patient status is "alta", "inativo" or "arquivado"', () => {
        const recentSessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-11-08', status: 'concluído' },
        ];

        expect(calculatePatientStage({ ...basePatient, status: 'alta' }, recentSessions, fixedNow)).toBe('churn');
        expect(calculatePatientStage({ ...basePatient, status: 'inativo' }, recentSessions, fixedNow)).toBe('churn');
        expect(calculatePatientStage({ ...basePatient, status: 'arquivado' }, recentSessions, fixedNow)).toBe('churn');
      });
    });

    describe('mapPatientToContact', () => {
      it('normalizes to CrmContact with targetType "patient"', () => {
        const sessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-10-14', status: 'concluído' },
        ];
        const contact = mapPatientToContact(basePatient, sessions, 'Clínica FisioLife', fixedNow);

        expect(contact.id).toBe('patient-001');
        expect(contact.targetType).toBe('patient');
        expect(contact.fullName).toBe('Mariana Silva de Oliveira');
        expect(contact.phone).toBe('11999998888');
        expect(contact.email).toBe('mariana.silva@gmail.com');
        expect(contact.badgeLabel).toBe('Bradesco Saúde Top');
        expect(contact.stage).toBe('active');
      });

      it('normalizes clinical metrics: primaryLabel "Última Sessão" and secondaryLabel "Total de Atendimentos"', () => {
        const sessions: PatientSessionRecord[] = [
          { id: 's1', patient_id: 'patient-001', session_date: '2026-10-14', status: 'concluído' },
          { id: 's2', patient_id: 'patient-001', session_date: '2026-09-10', status: 'concluído' },
          { id: 's3', patient_id: 'patient-001', session_date: '2026-11-01', status: 'cancelada' }, // não conta
        ];
        const contact = mapPatientToContact(basePatient, sessions, 'Clínica FisioLife', fixedNow);

        expect(contact.clinicalOrBusinessMetric.primaryLabel).toBe('Última Sessão');
        expect(contact.clinicalOrBusinessMetric.primaryValue).toBe(formatPatientDateDisplay('2026-10-14'));
        expect(contact.clinicalOrBusinessMetric.secondaryLabel).toBe('Total de Atendimentos');
        expect(contact.clinicalOrBusinessMetric.secondaryValue).toBe('2 atendimentos');
      });

      it('handles 0 completed sessions gracefully', () => {
        const contact = mapPatientToContact(basePatient, [], 'Clínica FisioLife', fixedNow);

        expect(contact.clinicalOrBusinessMetric.primaryValue).toBe('Sem registro');
        expect(contact.clinicalOrBusinessMetric.secondaryValue).toBe('0 atendimentos');
        expect(contact.stage).toBe('new');
      });

      it('populates template variables: primeiro_nome, telefone, clinica', () => {
        const contact = mapPatientToContact(basePatient, [], 'Clínica FisioLife', fixedNow);

        expect(contact.templateVariables.primeiro_nome).toBe('Mariana');
        expect(contact.templateVariables.first_name).toBe('Mariana');
        expect(contact.templateVariables.telefone).toBe('11999998888');
        expect(contact.templateVariables.clinica).toBe('Clínica FisioLife');
      });
    });
  });
});
