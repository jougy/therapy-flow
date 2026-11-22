import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SendAudioPttParams {
  evolutionBaseUrl: string;
  evolutionApiKey: string;
  instanceKey: string;
  phoneE164: string;
  audioUrl?: string;
  audioBase64?: string;
  simulateRecording?: boolean;
  skipPresenceWait?: boolean;
}

export interface SendAudioPttResult {
  ok: boolean;
  durationSec: number;
  presenceSec: number;
  statusCode: number;
  providerMessageId?: string;
  error?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseDurationFromFfmpegLog(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function decodeBase64Audio(raw: string): Buffer {
  const cleaned = raw.replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
  return Buffer.from(cleaned, 'base64');
}

async function resolveInputBuffer(params: SendAudioPttParams): Promise<Buffer> {
  if (params.audioBase64 && params.audioBase64.trim()) {
    return decodeBase64Audio(params.audioBase64);
  }
  if (params.audioUrl && params.audioUrl.trim()) {
    const res = await fetch(params.audioUrl.trim(), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch audio source: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new Error('Either audioUrl or audioBase64 must be provided for PTT');
}

async function measureOggDurationSec(oggPath: string, fallbackBytes: number): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', oggPath],
      { timeout: 10_000 },
    );
    const parsed = Number(stdout.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    // fallback to bitrate-based duration estimate below
  }
  return Math.max(1, (fallbackBytes * 8) / 32_000);
}

/**
 * Converte um áudio de entrada para OGG Opus VoIP (32kbps, mono, 16kHz) via `execFile('ffmpeg')`,
 * simula presença `recording` (2-8s) na Evolution API e dispara como PTT nativo.
 */
export async function sendAudioPtt(params: SendAudioPttParams): Promise<SendAudioPttResult> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `pluri-ptt-in-${id}.bin`);
  const outputPath = join(tmpdir(), `pluri-ptt-out-${id}.ogg`);
  const baseUrl = params.evolutionBaseUrl.replace(/\/+$/, '');

  try {
    const inputBuffer = await resolveInputBuffer(params);
    await fs.writeFile(inputPath, inputBuffer);

    const { stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-application',
        'voip',
        outputPath,
      ],
      { timeout: 30_000 },
    );

    const oggBuffer = await fs.readFile(outputPath);
    const parsedDuration =
      parseDurationFromFfmpegLog(stderr) ?? (await measureOggDurationSec(outputPath, oggBuffer.byteLength));
    const durationSec = Math.max(1, Math.round(parsedDuration));
    const presenceSec = clamp(durationSec, 2, 8);
    const presenceMs = presenceSec * 1000;

    if (params.simulateRecording !== false) {
      await fetch(`${baseUrl}/chat/sendPresence/${encodeURIComponent(params.instanceKey)}`, {
        method: 'POST',
        headers: {
          apikey: params.evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: params.phoneE164,
          presence: 'recording',
          delay: presenceMs,
        }),
        signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined);

      if (!params.skipPresenceWait) {
        await new Promise((resolve) => setTimeout(resolve, presenceMs));
      }
    }

    const res = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(params.instanceKey)}`, {
      method: 'POST',
      headers: {
        apikey: params.evolutionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: params.phoneE164,
        audio: oggBuffer.toString('base64'),
        delay: presenceMs,
        encoding: true,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    let providerMessageId: string | undefined;
    let error: string | undefined;
    try {
      const payload = (await res.json()) as { key?: { id?: string }; message?: string };
      providerMessageId = payload.key?.id;
      if (!res.ok) error = payload.message || `Evolution HTTP ${res.status}`;
    } catch {
      if (!res.ok) error = `Evolution HTTP ${res.status}`;
    }

    return {
      ok: res.ok,
      durationSec,
      presenceSec,
      statusCode: res.status,
      providerMessageId,
      error,
    };
  } finally {
    await Promise.all([
      fs.rm(inputPath, { force: true }).catch(() => undefined),
      fs.rm(outputPath, { force: true }).catch(() => undefined),
    ]);
  }
}

/**
 * Gera um áudio OGG Opus curto sintético via ffmpeg (útil para testes e aquecimento PTT sem mídia externa).
 */
export async function generateWarmupAudioBase64(durationSec = 2): Promise<string> {
  const id = randomUUID();
  const outputPath = join(tmpdir(), `pluri-warmup-ptt-${id}.ogg`);
  const clamped = clamp(Math.round(durationSec), 1, 6);

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=16000:cl=mono',
        '-t',
        String(clamped),
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-application',
        'voip',
        outputPath,
      ],
      { timeout: 15_000 },
    );
    const buffer = await fs.readFile(outputPath);
    return buffer.toString('base64');
  } finally {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
  }
}
