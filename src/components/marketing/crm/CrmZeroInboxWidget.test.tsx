import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CrmZeroInboxWidget,
  evaluateContactRecommendation,
} from './CrmZeroInboxWidget';
import {
  CrmContactXRayPanel,
  formatPhoneNumber,
  deriveLocationFromPhone,
  computeEngagementThermometer,
} from './CrmContactXRayPanel';
import type { CrmContact } from '@/modules/marketing/types';

describe('CrmZeroInboxWidget', () => {
  const mockCriticalLead: CrmContact = {
    id: 'contact-crit-1',
    targetType: 'affiliate_lead',
    fullName: 'Dr. Roberto Santos',
    phone: '11987654321',
    badgeLabel: 'Plano Clínica',
    stage: 'grace_period',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Plano / Ciclo',
      primaryValue: 'Plano Clínica (Anual)',
      secondaryLabel: 'Mensalidades',
      secondaryValue: '12 ciclos',
    },
    templateVariables: {
      first_name: 'Roberto',
      status: 'past_due',
    },
    metadata: {
      daysUntilCommissionLoss: 5,
    },
  };

  const mockHighTrialLead: CrmContact = {
    id: 'contact-high-2',
    targetType: 'affiliate_lead',
    fullName: 'Dra. Camila Lima',
    phone: '21976543210',
    badgeLabel: 'Trial Solo',
    stage: 'new',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Plano / Ciclo',
      primaryValue: 'Plano Solo (Trial)',
      secondaryLabel: 'Dias Restantes',
      secondaryValue: '2 dias',
    },
    templateVariables: {
      first_name: 'Camila',
      status: 'trial',
    },
    metadata: {
      isTrialExpiring: true,
      daysUntilTrialExpires: 2,
    },
  };

  const mockMediumNewLead: CrmContact = {
    id: 'contact-med-3',
    targetType: 'affiliate_lead',
    fullName: 'Lucas Fernandes',
    phone: '31998877665',
    badgeLabel: 'Novo Lead',
    stage: 'new',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Status',
      primaryValue: 'Cadastro Recente',
      secondaryLabel: 'Origem',
      secondaryValue: 'Link de Afiliado',
    },
    templateVariables: {
      first_name: 'Lucas',
    },
    createdAt: new Date().toISOString(),
    metadata: {
      isNewLead24h: true,
      hasInitiatedContact: false,
    },
  };

  const mockClinicalPatient: CrmContact = {
    id: 'patient-clin-4',
    targetType: 'patient',
    fullName: 'Maria Aparecida',
    phone: '41988887777',
    badgeLabel: 'Unimed',
    stage: 'stalled',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Última Sessão',
      primaryValue: '10/01/2026',
      secondaryLabel: 'Total de Atendimentos',
      secondaryValue: '8 atendimentos',
    },
    templateVariables: {
      first_name: 'Maria',
      clinica: 'FisioVida',
    },
    metadata: {
      daysSinceLastSession: 45,
    },
  };

  const mockActiveHealthyContact: CrmContact = {
    id: 'contact-active-5',
    targetType: 'patient',
    fullName: 'Carlos Eduardo',
    phone: '11911223344',
    badgeLabel: 'Particular',
    stage: 'active',
    lastInteractionAt: new Date().toISOString(),
    clinicalOrBusinessMetric: {
      primaryLabel: 'Última Sessão',
      primaryValue: new Date().toLocaleDateString('pt-BR'),
      secondaryLabel: 'Total de Atendimentos',
      secondaryValue: '15 atendimentos',
    },
    templateVariables: {
      first_name: 'Carlos',
    },
  };

  it('correctly evaluates each recommendation urgency level', () => {
    const critRec = evaluateContactRecommendation(mockCriticalLead);
    expect(critRec).not.toBeNull();
    expect(critRec?.urgency).toBe('critical');
    expect(critRec?.weight).toBe(400);
    expect(critRec?.actionTitle).toContain('Resgatar Roberto');

    const highRec = evaluateContactRecommendation(mockHighTrialLead);
    expect(highRec).not.toBeNull();
    expect(highRec?.urgency).toBe('high');
    expect(highRec?.weight).toBe(300);
    expect(highRec?.actionTitle).toContain('Trial de Camila');

    const medRec = evaluateContactRecommendation(mockMediumNewLead);
    expect(medRec).not.toBeNull();
    expect(medRec?.urgency).toBe('medium');
    expect(medRec?.weight).toBe(200);
    expect(medRec?.actionTitle).toContain('Boas-vindas para Lucas');

    const clinRec = evaluateContactRecommendation(mockClinicalPatient);
    expect(clinRec).not.toBeNull();
    expect(clinRec?.urgency).toBe('clinical');
    expect(clinRec?.weight).toBe(100);
    expect(clinRec?.actionTitle).toContain('Follow-up clínico: Maria');

    const nullRec = evaluateContactRecommendation(mockActiveHealthyContact);
    expect(nullRec).toBeNull();
  });

  it('limits recommendations to top 3 actions prioritized by weight', () => {
    // 4 eligible contacts
    const contacts = [
      mockClinicalPatient, // weight 100
      mockMediumNewLead,   // weight 200
      mockCriticalLead,    // weight 400
      mockHighTrialLead,   // weight 300
    ];

    render(<CrmZeroInboxWidget contacts={contacts} />);

    // Should only have 3 cards: critical, high, medium (clinical dropped because max 3)
    expect(screen.getByTestId('rec-card-critical')).toBeInTheDocument();
    expect(screen.getByTestId('rec-card-high')).toBeInTheDocument();
    expect(screen.getByTestId('rec-card-medium')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-card-clinical')).not.toBeInTheDocument();

    expect(screen.getByText(/3 pendentes/i)).toBeInTheDocument();
  });

  it('triggers onContactSelect when clicking on an action card', () => {
    const onSelect = vi.fn();
    render(<CrmZeroInboxWidget contacts={[mockCriticalLead]} onContactSelect={onSelect} />);

    const card = screen.getByText(/Resgatar Roberto/i);
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockCriticalLead);
  });

  it('allows completing tasks and shows celebratory Zero-Inbox state when all 3 are finished', () => {
    const onActionComplete = vi.fn();
    const contacts = [mockCriticalLead, mockHighTrialLead, mockMediumNewLead];

    render(
      <CrmZeroInboxWidget
        contacts={contacts}
        onActionComplete={onActionComplete}
      />
    );

    // Initial state: 3 pending
    expect(screen.getByText(/3 pendentes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('zero-inbox-celebration')).not.toBeInTheDocument();

    // Complete first task via checkbox
    const checkboxes = screen.getAllByLabelText('Concluir tarefa');
    expect(checkboxes.length).toBe(3);
    fireEvent.click(checkboxes[0]);
    expect(onActionComplete).toHaveBeenCalledTimes(1);

    // Complete second task via "Lembrar amanhã" snooze button
    const snoozeBtns = screen.getAllByText('Lembrar amanhã');
    fireEvent.click(snoozeBtns[0]);
    expect(onActionComplete).toHaveBeenCalledTimes(2);

    // Complete third task
    const remainingCheckbox = screen.getAllByLabelText('Concluir tarefa');
    fireEvent.click(remainingCheckbox[0]);
    expect(onActionComplete).toHaveBeenCalledTimes(3);

    // Celebratory Zero-Inbox message must now be displayed!
    expect(screen.getByTestId('zero-inbox-celebration')).toBeInTheDocument();
    expect(
      screen.getByText(/Você está em dia com todas as suas ações prioritárias de hoje! 🎉/i)
    ).toBeInTheDocument();
  });

  it('renders healthy funnel message when no contacts require action', () => {
    render(<CrmZeroInboxWidget contacts={[mockActiveHealthyContact]} />);

    expect(screen.getByText(/Funil Saudável ✨/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum contato necessita de ação crítica imediata no momento./i)
    ).toBeInTheDocument();
  });

  it('renders correct WhatsApp links for actions', () => {
    render(<CrmZeroInboxWidget contacts={[mockCriticalLead]} />);

    const whatsappLinks = screen.getAllByRole('link', { name: /WhatsApp/i });
    expect(whatsappLinks.length).toBeGreaterThanOrEqual(1);
    const href = whatsappLinks[0].getAttribute('href');
    expect(href).toContain('wa.me/5511987654321');
    expect(href).toContain('Roberto');
  });
});

describe('CrmContactXRayPanel', () => {
  const testContact: CrmContact = {
    id: 'lead-987654',
    targetType: 'affiliate_lead',
    fullName: 'Dra. Vanessa Mendonça',
    phone: '21988884444',
    badgeLabel: 'Plano Clínica',
    stage: 'active',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Plano / Ciclo',
      primaryValue: 'Plano Clínica (Anual)',
      secondaryLabel: 'Mensalidades',
      secondaryValue: '6 ciclos pagos',
    },
    templateVariables: {
      first_name: 'Vanessa',
      plano: 'Plano Clínica',
    },
  };

  it('formats telephone numbers properly', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneNumber('5521988884444')).toBe('(21) 98888-4444');
    expect(formatPhoneNumber('')).toBe('Sem telefone cadastrado');
  });

  it('derives location passively based on phone DDD', () => {
    expect(deriveLocationFromPhone('11987654321')).toContain('São Paulo / SP');
    expect(deriveLocationFromPhone('21988884444')).toContain('Rio de Janeiro / RJ');
    expect(deriveLocationFromPhone('41999998888')).toContain('Curitiba / PR');
    expect(deriveLocationFromPhone('')).toContain('Brasil');
  });

  it('computes engagement thermometer metrics according to stage', () => {
    const activeResult = computeEngagementThermometer(testContact);
    expect(activeResult.percent).toBeGreaterThan(80);
    expect(activeResult.label).toContain('Alto Engajamento');

    const churnResult = computeEngagementThermometer({ ...testContact, stage: 'churn' });
    expect(churnResult.percent).toBeLessThan(20);
    expect(churnResult.label).toContain('Churn');
  });

  it('renders passive X-ray panel with identity, structure, engagement and LGPD compliant elements', () => {
    render(<CrmContactXRayPanel contact={testContact} />);

    expect(screen.getByTestId('crm-contact-xray-panel')).toBeInTheDocument();
    expect(screen.getByText('Dra. Vanessa Mendonça')).toBeInTheDocument();
    expect(screen.getByText('(21) 98888-4444')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp canal verificado/i)).toBeInTheDocument();

    // Structure & Plan
    expect(screen.getByText('Plano Clínica')).toBeInTheDocument();
    expect(screen.getByText('6 ciclos pagos')).toBeInTheDocument();

    // Engagement & Location
    expect(screen.getByText(/Rio de Janeiro \/ RJ/i)).toBeInTheDocument();
    expect(screen.getByText(/LGPD/i)).toBeInTheDocument();
  });
});
