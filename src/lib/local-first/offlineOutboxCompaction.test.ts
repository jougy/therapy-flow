import { describe, expect, it } from 'vitest';
import { compactOfflineOutbox, type OfflineOutboxItem } from './offlineMutationQueue';

describe('compactOfflineOutbox (Camada 0 Coalescing)', () => {
  it('merges create_patient + multiple update_patient into 1 single insert', () => {
    const items: OfflineOutboxItem[] = [
      {
        id: '001',
        type: 'create_patient',
        createdAt: 1,
        attempts: 0,
        payload: {
          tempId: 'temp-pat-1',
          record: { name: 'Ana', clinic_id: 'c1', phone: '111' } as never,
        },
      },
      {
        id: '002',
        type: 'update_patient',
        createdAt: 2,
        attempts: 0,
        payload: { patientId: 'temp-pat-1', patch: { phone: '222' } },
      },
      {
        id: '003',
        type: 'update_patient',
        createdAt: 3,
        attempts: 0,
        payload: { patientId: 'temp-pat-1', patch: { email: 'ana@test.com' } },
      },
    ];

    const { compacted, droppedIds } = compactOfflineOutbox(items);
    expect(compacted).toHaveLength(1);
    expect(droppedIds).toEqual(['002', '003']);
    expect((compacted[0].payload as { record: Record<string, unknown> }).record).toMatchObject({
      name: 'Ana',
      phone: '222',
      email: 'ana@test.com',
    });
  });

  it('annuls local upsert_agenda_event + delete_agenda_event with 0 server calls', () => {
    const items: OfflineOutboxItem[] = [
      {
        id: '001',
        type: 'upsert_agenda_event',
        createdAt: 1,
        attempts: 0,
        payload: { tempId: 'temp-ev-1', record: { title: 'Sessão' } as never },
      },
      {
        id: '002',
        type: 'delete_agenda_event',
        createdAt: 2,
        attempts: 0,
        payload: { eventId: 'temp-ev-1' },
      },
    ];

    const { compacted, droppedIds } = compactOfflineOutbox(items);
    expect(compacted).toHaveLength(0);
    expect(droppedIds).toEqual(['001', '002']);
  });

  it('keeps only the latest upsert_session for the same session id', () => {
    const items: OfflineOutboxItem[] = [
      {
        id: '001',
        type: 'upsert_session',
        createdAt: 1,
        attempts: 0,
        payload: { tempId: 'temp-ses-1', record: { notes: 'v1' } as never },
      },
      {
        id: '002',
        type: 'upsert_session',
        createdAt: 2,
        attempts: 0,
        payload: { tempId: 'temp-ses-1', record: { notes: 'v2' } as never },
      },
    ];

    const { compacted, droppedIds } = compactOfflineOutbox(items);
    expect(compacted).toHaveLength(1);
    expect(droppedIds).toEqual(['001']);
    expect((compacted[0].payload as { record: { notes: string } }).record.notes).toBe('v2');
  });
});
