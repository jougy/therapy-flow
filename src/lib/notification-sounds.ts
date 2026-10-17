/**
 * Notification Sounds Engine (Web Audio API)
 * Therapy-Flow (Pluri-Health)
 *
 * Precise mathematical synthesis of notification chimes and clinical alarm loops.
 * Zero external audio assets; runs offline and cross-platform via Web Audio API.
 */

export type NotificationSoundKey =
  | "soft"
  | "cute"
  | "chime"
  | "pulse"
  | "urgent_alarm"
  | "siren";

export type NotificationSoundIntensity = "gentle" | "moderate" | "intense";

export interface SoundOption {
  key: NotificationSoundKey;
  label: string;
  name: string;
  intensity: NotificationSoundIntensity;
  categoryLabel: string;
  description: string;
}

export interface SoundGroup {
  intensity: NotificationSoundIntensity;
  groupLabel: string;
  description: string;
  options: SoundOption[];
}

export interface AlarmLoopOptions {
  soundKey?: NotificationSoundKey;
  maxLoops?: number;
  intervalMs?: number;
  onComplete?: () => void;
  onLoop?: (currentLoop: number, maxLoops: number) => void;
}

export interface ActiveAlarmHandle {
  (): void;
  stop: () => void;
}

export interface PlaybackHandle {
  stop: () => void;
  durationMs: number;
}

export const ALARM_BROADCAST_CHANNEL = "pluri_alarm_channel";
export const ALARM_DISMISS_MESSAGE = "DISMISS_ALARM";

export const NOTIFICATION_SOUND_LABELS: Record<NotificationSoundKey, string> = {
  soft: "Campanela Zen",
  cute: "Gota Suave",
  chime: "Marimba Clínica",
  pulse: "Pulso Duplo",
  urgent_alarm: "Alarme Clínico",
  siren: "Sirene de Urgência",
};

export const NOTIFICATION_SOUND_GROUPS: SoundGroup[] = [
  {
    intensity: "gentle",
    groupLabel: "Leves e Fofos",
    description: "Sons sutis e relaxantes para não interromper consultas",
    options: [
      {
        key: "soft",
        label: "Campanela Zen",
        name: "Campanela Zen",
        intensity: "gentle",
        categoryLabel: "Leves e Fofos",
        description: "Toque zen suave com harmônicos Solfeggio (528 Hz)",
      },
      {
        key: "cute",
        label: "Gota Suave",
        name: "Gota Suave",
        intensity: "gentle",
        categoryLabel: "Leves e Fofos",
        description: "Gota d'água delicada e amigável",
      },
    ],
  },
  {
    intensity: "moderate",
    groupLabel: "Moderados",
    description: "Sons balanceados e perceptíveis",
    options: [
      {
        key: "chime",
        label: "Marimba Clínica",
        name: "Marimba Clínica",
        intensity: "moderate",
        categoryLabel: "Moderados",
        description: "Arpeggio acolhedor de marimba clínica",
      },
      {
        key: "pulse",
        label: "Pulso Duplo",
        name: "Pulso Duplo",
        intensity: "moderate",
        categoryLabel: "Moderados",
        description: "Dois pulsos rítmicos equilibrados",
      },
    ],
  },
  {
    intensity: "intense",
    groupLabel: "Intensos e Urgentes",
    description: "Sons de alta prioridade para emergências e alarmes clínicos",
    options: [
      {
        key: "urgent_alarm",
        label: "Alarme Clínico",
        name: "Alarme Clínico",
        intensity: "intense",
        categoryLabel: "Intensos e Urgentes",
        description: "Três bipes assertivos de alta prioridade clínica",
      },
      {
        key: "siren",
        label: "Sirene de Urgência",
        name: "Sirene de Urgência",
        intensity: "intense",
        categoryLabel: "Intensos e Urgentes",
        description: "Sirene alternada para alertas críticos e urgências",
      },
    ],
  },
];

let sharedAudioContext: AudioContext | null = null;
let activeAlarmHandle: ActiveAlarmHandle | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

export function resetAudioContext(): void {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    try {
      void sharedAudioContext.close();
    } catch {
      // Ignorar erros no encerramento de contexto de teste
    }
  }
  sharedAudioContext = null;
}

interface ToneNote {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  startOffset: number;
  duration: number;
  peakGain: number;
}

function synthesizeNotes(
  ctx: AudioContext,
  masterGain: GainNode,
  notes: ToneNote[],
  volume: number,
): { stop: () => void } {
  const t0 = ctx.currentTime;
  const activeNodes: OscillatorNode[] = [];

  for (const note of notes) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = note.type ?? "sine";
      const startT = t0 + note.startOffset;
      const endT = startT + note.duration;
      const targetGain = Math.max(0.0001, note.peakGain * volume);

      osc.frequency.setValueAtTime(note.freq, startT);
      if (note.freqEnd && note.freqEnd !== note.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.freqEnd), endT);
      }

      gain.gain.setValueAtTime(0.0001, startT);
      gain.gain.exponentialRampToValueAtTime(targetGain, startT + Math.min(0.02, note.duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, endT);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startT);
      osc.stop(endT);
      activeNodes.push(osc);
    } catch {
      // Audio node scheduling guard
    }
  }

  return {
    stop: () => {
      for (const node of activeNodes) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Node already stopped
        }
      }
    },
  };
}

export function playNotificationSound(
  soundKey: NotificationSoundKey = "soft",
  options?: { volume?: number },
): PlaybackHandle {
  const ctx = getAudioContext();
  if (!ctx) {
    return { stop: () => {}, durationMs: 0 };
  }

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const volume = Math.max(0, Math.min(1, options?.volume ?? 1));
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1, ctx.currentTime);
  masterGain.connect(ctx.destination);

  let toneNotes: ToneNote[] = [];
  let durationMs = 300;

  switch (soundKey) {
    case "soft":
      // Campanela Zen: fundamental 528Hz com harmônico de oitava 1056Hz
      toneNotes = [
        { freq: 528, type: "sine", startOffset: 0, duration: 0.85, peakGain: 0.14 },
        { freq: 1056, type: "sine", startOffset: 0, duration: 0.55, peakGain: 0.05 },
        { freq: 1584, type: "sine", startOffset: 0, duration: 0.35, peakGain: 0.02 },
      ];
      durationMs = 880;
      break;

    case "cute":
      // Gota Suave: pitch glissando ascendente simulando gota/bloop
      toneNotes = [
        { freq: 850, freqEnd: 1400, type: "sine", startOffset: 0, duration: 0.25, peakGain: 0.18 },
      ];
      durationMs = 280;
      break;

    case "chime":
      // Marimba Clínica: arpeggio acolhedor (C5: 523.25, E5: 659.25, G5: 783.99)
      toneNotes = [
        { freq: 523.25, type: "triangle", startOffset: 0, duration: 0.35, peakGain: 0.12 },
        { freq: 659.25, type: "triangle", startOffset: 0.08, duration: 0.35, peakGain: 0.12 },
        { freq: 783.99, type: "triangle", startOffset: 0.16, duration: 0.45, peakGain: 0.14 },
      ];
      durationMs = 640;
      break;

    case "pulse":
      // Pulso Duplo: dois pulsos sincopados e limpos
      toneNotes = [
        { freq: 520, type: "sine", startOffset: 0, duration: 0.11, peakGain: 0.15 },
        { freq: 587.33, type: "sine", startOffset: 0.15, duration: 0.12, peakGain: 0.15 },
      ];
      durationMs = 320;
      break;

    case "urgent_alarm":
      // Alarme Clínico: 3 pulsos assertivos com harmônico agudo de atenção
      toneNotes = [
        { freq: 880, type: "triangle", startOffset: 0, duration: 0.09, peakGain: 0.18 },
        { freq: 1760, type: "sine", startOffset: 0, duration: 0.09, peakGain: 0.08 },
        { freq: 880, type: "triangle", startOffset: 0.13, duration: 0.09, peakGain: 0.18 },
        { freq: 1760, type: "sine", startOffset: 0.13, duration: 0.09, peakGain: 0.08 },
        { freq: 880, type: "triangle", startOffset: 0.26, duration: 0.14, peakGain: 0.2 },
        { freq: 1760, type: "sine", startOffset: 0.26, duration: 0.14, peakGain: 0.1 },
      ];
      durationMs = 450;
      break;

    case "siren":
      // Sirene de Urgência: tom alternado agudo (960Hz / 720Hz)
      toneNotes = [
        { freq: 960, freqEnd: 920, type: "sine", startOffset: 0, duration: 0.15, peakGain: 0.16 },
        { freq: 720, freqEnd: 740, type: "sine", startOffset: 0.16, duration: 0.15, peakGain: 0.16 },
        { freq: 960, freqEnd: 920, type: "sine", startOffset: 0.32, duration: 0.15, peakGain: 0.16 },
        { freq: 720, freqEnd: 740, type: "sine", startOffset: 0.48, duration: 0.18, peakGain: 0.16 },
      ];
      durationMs = 700;
      break;
  }

  const { stop: stopNotes } = synthesizeNotes(ctx, masterGain, toneNotes, volume);

  const stop = () => {
    try {
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      setTimeout(() => {
        stopNotes();
        try {
          masterGain.disconnect();
        } catch {
          // Disconnected
        }
      }, 35);
    } catch {
      stopNotes();
    }
  };

  return { stop, durationMs };
}

export { playNotificationSound as playNotificationPreview };

export function startAlarmLoop({
  soundKey = "urgent_alarm",
  maxLoops = 4,
  intervalMs,
  onComplete,
  onLoop,
}: AlarmLoopOptions = {}): ActiveAlarmHandle {
  stopAlarmLoop();

  let stopped = false;
  let currentLoop = 0;
  let loopTimer: ReturnType<typeof setTimeout> | null = null;
  let currentPlaybackStop: (() => void) | null = null;

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(ALARM_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (
          event.data === ALARM_DISMISS_MESSAGE ||
          (typeof event.data === "object" && event.data !== null && "type" in event.data && event.data.type === ALARM_DISMISS_MESSAGE)
        ) {
          stop();
        }
      };
    } catch {
      channel = null;
    }
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;

    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }

    if (currentPlaybackStop) {
      currentPlaybackStop();
      currentPlaybackStop = null;
    }

    if (channel) {
      try {
        channel.close();
      } catch {
        // Channel already closed
      }
      channel = null;
    }

    if (activeAlarmHandle === handle) {
      activeAlarmHandle = null;
    }
  };

  const handle = Object.assign(() => stop(), { stop });
  activeAlarmHandle = handle;

  const cadenceInterval = intervalMs ?? (soundKey === "soft" || soundKey === "siren" ? 1400 : 1100);

  const executeLoop = () => {
    if (stopped) return;

    if (currentLoop >= maxLoops) {
      stop();
      onComplete?.();
      return;
    }

    currentLoop++;
    onLoop?.(currentLoop, maxLoops);

    const playback = playNotificationSound(soundKey);
    currentPlaybackStop = playback.stop;

    if (currentLoop < maxLoops) {
      loopTimer = setTimeout(executeLoop, cadenceInterval);
    } else {
      loopTimer = setTimeout(() => {
        if (!stopped) {
          stop();
          onComplete?.();
        }
      }, Math.max(playback.durationMs, 500));
    }
  };

  executeLoop();

  return handle;
}

export function stopAlarmLoop(options?: { broadcast?: boolean }): void {
  if (activeAlarmHandle) {
    const handle = activeAlarmHandle;
    activeAlarmHandle = null;
    handle.stop();
  }

  if (options?.broadcast && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(ALARM_BROADCAST_CHANNEL);
      channel.postMessage(ALARM_DISMISS_MESSAGE);
      channel.close();
    } catch {
      // Ignorar erros de broadcast
    }
  }
}

export function dismissAlarm(): void {
  stopAlarmLoop({ broadcast: true });
}
