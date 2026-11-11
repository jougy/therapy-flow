import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  CrmVoiceNoteRecorder,
  formatCountdown,
  simulateWhisperTranscription,
} from './CrmVoiceNoteRecorder';
import { CrmContactXRayPanel } from './CrmContactXRayPanel';
import type { CrmContact } from '@/modules/marketing/types';
import * as toastHooks from '@/components/ui/use-toast';

class MockMediaRecorder {
  static isTypeSupported = vi.fn((_type: string) => true);
  state = 'inactive';
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;

  start = vi.fn((_timeslice?: number) => {
    this.state = 'recording';
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }),
      });
    }
    if (this.onstop) {
      this.onstop();
    }
  });
}

const mockTrack = {
  stop: vi.fn(),
};

const mockStream = {
  getTracks: vi.fn(() => [mockTrack]),
};

describe('CrmVoiceNoteRecorder - Unit & UX Specs', () => {
  let toastSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    toastSpy = vi.spyOn(toastHooks, 'toast');

    // Setup MediaDevices mock
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    // Setup MediaRecorder mock on window/global
    (global as any).MediaRecorder = MockMediaRecorder;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('formatCountdown helper', () => {
    it('formats remaining seconds properly as MM:SS', () => {
      expect(formatCountdown(60)).toBe('01:00');
      expect(formatCountdown(59)).toBe('00:59');
      expect(formatCountdown(5)).toBe('00:05');
      expect(formatCountdown(0)).toBe('00:00');
      expect(formatCountdown(-5)).toBe('00:00');
    });
  });

  describe('simulateWhisperTranscription', () => {
    it('returns realistic high-fidelity clinical and CRM transcriptions with tags', async () => {
      const result = await simulateWhisperTranscription(
        new Blob(['audio'], { type: 'audio/webm' }),
        'Dra. Claudia'
      );
      expect(result.text).toBeTruthy();
      expect(typeof result.tag).toBe('string');
      expect(result.summary).toBeTruthy();
    });
  });

  it('renders initial idle state with touch target >= 44x44px and microphone icon', () => {
    const handleSuccess = vi.fn();
    render(<CrmVoiceNoteRecorder onTranscribeSuccess={handleSuccess} />);

    const button = screen.getByTestId('crm-voice-record-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Gravar nota de voz');
    expect(button.className).toContain('min-h-[44px]');
    expect(button.className).toContain('min-w-[44px]');
  });

  it('shows toast when navigator.mediaDevices is missing or getUserMedia is not supported', async () => {
    const handleSuccess = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    render(<CrmVoiceNoteRecorder onTranscribeSuccess={handleSuccess} />);
    const recordBtn = screen.getByTestId('crm-voice-record-button');

    fireEvent.click(recordBtn);

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Microfone Indisponível',
        variant: 'destructive',
      })
    );
    expect(handleSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('crm-voice-record-button')).toBeInTheDocument();
  });

  it('handles permission denied (NotAllowedError) defensively with user-friendly toast', async () => {
    const handleSuccess = vi.fn();
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';

    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(deniedErr);

    render(<CrmVoiceNoteRecorder onTranscribeSuccess={handleSuccess} />);
    const recordBtn = screen.getByTestId('crm-voice-record-button');

    await act(async () => {
      fireEvent.click(recordBtn);
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Permissão de Microfone Negada',
        description: expect.stringContaining('Libere a permissão nas configurações do navegador'),
        variant: 'destructive',
      })
    );
    expect(screen.getByTestId('crm-voice-record-button')).toBeInTheDocument();
  });

  it('transitions to recording state with pulsing red indicator and timer countdown', async () => {
    const handleSuccess = vi.fn();

    render(<CrmVoiceNoteRecorder onTranscribeSuccess={handleSuccess} maxDurationSeconds={60} />);
    const recordBtn = screen.getByTestId('crm-voice-record-button');

    await act(async () => {
      fireEvent.click(recordBtn);
    });

    expect(screen.getByTestId('crm-voice-recording-active')).toBeInTheDocument();
    const timer = screen.getByTestId('recording-timer');
    expect(timer).toHaveTextContent('01:00');

    // Both action buttons must be available with min 44x44px touch targets
    const cancelBtn = screen.getByTestId('crm-voice-cancel-button');
    const completeBtn = screen.getByTestId('crm-voice-complete-button');
    expect(cancelBtn.className).toContain('min-h-[44px]');
    expect(cancelBtn.className).toContain('min-w-[44px]');
    expect(completeBtn.className).toContain('min-h-[44px]');
  });

  it('cancels and discards recording when cancel button is clicked', async () => {
    const handleSuccess = vi.fn();

    render(<CrmVoiceNoteRecorder onTranscribeSuccess={handleSuccess} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-record-button'));
    });

    expect(screen.getByTestId('crm-voice-recording-active')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('crm-voice-cancel-button');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Gravação cancelada',
      })
    );
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(handleSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('crm-voice-record-button')).toBeInTheDocument();
  });

  it('completes recording, transcribes audio and invokes onTranscribeSuccess callback', async () => {
    const handleSuccess = vi.fn();
    const customTranscribe = vi.fn().mockResolvedValue({
      text: 'Contato solicitou orçamento para plano clínica 5 licenças.',
      tag: 'Alta Probabilidade de Fechamento',
      summary: 'Solicitação de orçamento 5 licenças.',
    });

    render(
      <CrmVoiceNoteRecorder
        onTranscribeSuccess={handleSuccess}
        transcribeFn={customTranscribe}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-record-button'));
    });

    const completeBtn = screen.getByTestId('crm-voice-complete-button');
    await act(async () => {
      fireEvent.click(completeBtn);
    });

    expect(customTranscribe).toHaveBeenCalled();
    expect(handleSuccess).toHaveBeenCalledWith({
      text: 'Contato solicitou orçamento para plano clínica 5 licenças.',
      tag: 'Alta Probabilidade de Fechamento',
      summary: 'Solicitação de orçamento 5 licenças.',
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Áudio Transcrito com IA',
      })
    );
    // Returns to idle state
    expect(screen.getByTestId('crm-voice-record-button')).toBeInTheDocument();
  });

  it('stops and completes automatically when reaching 60s maxDuration limit', async () => {
    vi.useFakeTimers();
    const handleSuccess = vi.fn();
    const customTranscribe = vi.fn().mockResolvedValue({
      text: 'Transcrição automática por estouro do limite.',
      tag: 'Dúvida Técnica',
    });

    render(
      <CrmVoiceNoteRecorder
        onTranscribeSuccess={handleSuccess}
        maxDurationSeconds={60}
        transcribeFn={customTranscribe}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-record-button'));
    });

    expect(screen.getByTestId('crm-voice-recording-active')).toBeInTheDocument();

    // Fast-forward 60 seconds
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });

    expect(customTranscribe).toHaveBeenCalled();
    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Transcrição automática por estouro do limite.',
      })
    );
  });

  it('handles transcription failure gracefully without crashing', async () => {
    const handleSuccess = vi.fn();
    const failingTranscribe = vi.fn().mockRejectedValue(new Error('Whisper server error'));

    render(
      <CrmVoiceNoteRecorder
        onTranscribeSuccess={handleSuccess}
        transcribeFn={failingTranscribe}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-record-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-complete-button'));
    });

    expect(failingTranscribe).toHaveBeenCalled();
    expect(handleSuccess).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falha na Transcrição',
        variant: 'destructive',
      })
    );
    expect(screen.getByTestId('crm-voice-record-button')).toBeInTheDocument();
  });
});

describe('CrmContactXRayPanel & Voice Recorder Integration', () => {
  const sampleContact: CrmContact = {
    id: 'lead-test-1234',
    targetType: 'affiliate_lead',
    fullName: 'Dr. Roberto Silveira',
    phone: '11977778888',
    badgeLabel: 'Plano Pro',
    stage: 'active',
    clinicalOrBusinessMetric: {
      primaryLabel: 'Status',
      primaryValue: 'Mensal Ativo',
      secondaryLabel: 'Permanência',
      secondaryValue: '12 meses',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });
    (global as any).MediaRecorder = MockMediaRecorder;
  });

  it('integrates voice recorder button side-by-side with Salvar Nota and fills textarea upon transcription', async () => {
    const handleAddNote = vi.fn().mockResolvedValue(undefined);

    render(
      <CrmContactXRayPanel contact={sampleContact} onAddNote={handleAddNote} />
    );

    // Salvar Nota and Voice Record buttons exist side-by-side
    const saveButton = screen.getByTestId('crm-save-note-button');
    const recordButton = screen.getByTestId('crm-voice-record-button');
    const textarea = screen.getByTestId('crm-contact-note-textarea') as HTMLTextAreaElement;

    expect(saveButton).toBeInTheDocument();
    expect(recordButton).toBeInTheDocument();
    expect(textarea.value).toBe('');
    expect(saveButton).toBeDisabled();

    // Start voice recording
    await act(async () => {
      fireEvent.click(recordButton);
    });

    // Complete recording
    await act(async () => {
      fireEvent.click(screen.getByTestId('crm-voice-complete-button'));
    });

    // Textarea should now be automatically populated
    await waitFor(() => {
      expect(textarea.value.length).toBeGreaterThan(10);
    });

    // Suggested tag badge is displayed
    expect(screen.getByTestId('crm-transcribed-tag-badge')).toBeInTheDocument();

    // Save button should now be enabled
    expect(saveButton).not.toBeDisabled();

    // Clicking Salvar Nota submits note with 1 click
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(handleAddNote).toHaveBeenCalledWith(
      textarea.value || expect.any(String),
      expect.any(String)
    );

    // Textarea is reset after saving
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });
});
