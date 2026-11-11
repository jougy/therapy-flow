import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MarketingCrmAdapter, CrmContact, CrmStageKey } from '../types';
import { DEFAULT_CRM_STAGES } from '../types';

export interface PatientRecord {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: string;
  clinical_notes?: string | null;
  origin_insurance_plan?: string | null;
  origin_insurance_provider?: string | null;
  origin_type?: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PatientSessionRecord {
  id: string;
  patient_id: string;
  session_date: string;
  scheduled_start_at?: string | null;
  status: string;
  deleted_at?: string | null;
}

export function isSessionCompleted(session: { status?: string | null }): boolean {
  const st = (session.status || '').toLowerCase().trim();
  return st === 'concluído' || st === 'concluido' || st === 'realizada';
}

export function calculatePatientStage(
  patient: { status?: string | null },
  sessions: Array<{ session_date?: string | null; scheduled_start_at?: string | null; status?: string | null }> = [],
  referenceDate: Date = new Date()
): CrmStageKey {
  const patientStatus = (patient.status || '').toLowerCase().trim();
  if (['alta', 'inativo', 'arquivado', 'churn', 'cancelado'].includes(patientStatus)) {
    return 'churn';
  }

  const completed = sessions.filter(isSessionCompleted);
  if (completed.length === 0) return 'new';

  const timestamps = completed
    .map((s) => {
      const raw = s.session_date || s.scheduled_start_at;
      if (!raw) return null;
      const t = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`).getTime();
      return isNaN(t) ? null : t;
    })
    .filter((t): t is number => t !== null);

  if (timestamps.length === 0) return 'new';

  const latestSessionTime = Math.max(...timestamps);
  const diffDays = (referenceDate.getTime() - latestSessionTime) / (1000 * 60 * 60 * 24);
  return diffDays <= 30 ? 'active' : 'stalled';
}

export function formatPatientDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return 'Sem registro';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function mapPatientToContact(
  patient: PatientRecord,
  sessions: PatientSessionRecord[] = [],
  clinicName = 'Pluri-Health',
  referenceDate: Date = new Date()
): CrmContact {
  const stage = calculatePatientStage(patient, sessions, referenceDate);
  const fullName = patient.name?.trim() || 'Paciente Sem Nome';
  const firstName = fullName.split(' ')[0] || 'Paciente';
  const phone = patient.phone || '';
  const email = patient.email || undefined;

  const completedSessions = sessions.filter(isSessionCompleted);
  const totalCompleted = completedSessions.length;

  let latestSessionDateStr: string | null = null;
  if (completedSessions.length > 0) {
    const sorted = [...completedSessions].sort((a, b) => {
      const ta = new Date(a.session_date || a.scheduled_start_at || 0).getTime();
      const tb = new Date(b.session_date || b.scheduled_start_at || 0).getTime();
      return tb - ta;
    });
    latestSessionDateStr = sorted[0].session_date || sorted[0].scheduled_start_at || null;
  }

  const primaryValue = formatPatientDateDisplay(latestSessionDateStr);
  const secondaryValue = `${totalCompleted} ${totalCompleted === 1 ? 'atendimento' : 'atendimentos'}`;
  const badgeLabel = patient.origin_insurance_plan || patient.origin_insurance_provider || 'Particular';

  return {
    id: patient.id,
    targetType: 'patient',
    fullName,
    phone,
    email,
    badgeLabel,
    stage,
    lastInteractionAt: latestSessionDateStr || patient.updated_at || patient.created_at,
    clinicalOrBusinessMetric: {
      primaryLabel: 'Última Sessão',
      primaryValue,
      secondaryLabel: 'Total de Atendimentos',
      secondaryValue,
    },
    templateVariables: {
      primeiro_nome: firstName,
      first_name: firstName,
      telefone: phone,
      clinica: clinicName,
    },
  };
}

export interface UseB2cPatientCrmOptions {
  clinicId?: string;
  clinicName?: string;
}

export function useB2cPatientCrm(
  options: UseB2cPatientCrmOptions = {}
): MarketingCrmAdapter & { refetch: () => Promise<void> } {
  const { clinicId: authClinicId, clinic } = useAuth();
  const activeClinicId = options.clinicId || authClinicId;
  const activeClinicName = options.clinicName || clinic?.name || 'Pluri-Health';

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [rawPatients, setRawPatients] = useState<PatientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatientData = useCallback(async () => {
    if (!activeClinicId) {
      setContacts([]);
      setRawPatients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [patientsRes, sessionsRes] = await Promise.all([
        supabase
          .from('patients')
          .select('id, name, phone, email, status, clinical_notes, origin_insurance_plan, origin_insurance_provider, origin_type, created_at, updated_at, deleted_at')
          .eq('clinic_id', activeClinicId)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('sessions')
          .select('id, patient_id, session_date, scheduled_start_at, status, deleted_at')
          .eq('clinic_id', activeClinicId)
          .is('deleted_at', null),
      ]);

      if (patientsRes.error) {
        setContacts([]);
        setRawPatients([]);
        return;
      }

      const patients = (patientsRes.data || []) as PatientRecord[];
      const sessions = (sessionsRes.data || []) as PatientSessionRecord[];

      const sessionsByPatient = new Map<string, PatientSessionRecord[]>();
      for (const s of sessions) {
        const list = sessionsByPatient.get(s.patient_id) || [];
        list.push(s);
        sessionsByPatient.set(s.patient_id, list);
      }

      setRawPatients(patients);
      setContacts(
        patients.map((p) => mapPatientToContact(p, sessionsByPatient.get(p.id) || [], activeClinicName))
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeClinicId, activeClinicName]);

  useEffect(() => {
    void fetchPatientData();
  }, [fetchPatientData]);

  const handleAddNote = useCallback(async (contactId: string, note: string) => {
    if (!note.trim()) return;
    const patient = rawPatients.find((p) => p.id === contactId);
    const dateLabel = new Date().toLocaleDateString('pt-BR');
    const updatedNotes = patient?.clinical_notes
      ? `${patient.clinical_notes}\n[CRM ${dateLabel}]: ${note.trim()}`
      : `[CRM ${dateLabel}]: ${note.trim()}`;

    await supabase
      .from('patients')
      .update({ clinical_notes: updatedNotes, updated_at: new Date().toISOString() })
      .eq('id', contactId);

    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, lastInteractionAt: new Date().toISOString() } : c))
    );
  }, [rawPatients]);

  const handleStageChange = useCallback(async (contactId: string, newStage: CrmStageKey) => {
    const stageToStatus: Record<CrmStageKey, string> = {
      new: 'ativo',
      active: 'ativo',
      stalled: 'inativo',
      grace_period: 'inativo',
      churn: 'alta',
    };
    const nextStatus = stageToStatus[newStage] || 'ativo';

    await supabase
      .from('patients')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', contactId);

    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stage: newStage } : c)));
  }, []);

  return {
    targetType: 'patient',
    title: 'CRM Clínico de Pacientes',
    subtitle: 'Engajamento, retenção e régua de acompanhamento de pacientes',
    stages: DEFAULT_CRM_STAGES,
    contacts,
    isLoading,
    onAddNote: handleAddNote,
    onStageChange: handleStageChange,
    refetch: fetchPatientData,
  };
}
