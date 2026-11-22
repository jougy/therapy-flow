import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execFileAsync = promisify(execFile);

export interface SceneSpec {
  durationSec: number;
  hookText: string;
  narration?: string;
}

export interface ReelAssemblyOptions {
  scenes: SceneSpec[];
  slideImagePath?: string;
  outputFilePath?: string;
}

function generateAssSubtitle(scenes: SceneSpec[]): string {
  let currentTime = 0;
  const events: string[] = [];

  for (const scene of scenes) {
    const startSec = currentTime;
    const endSec = currentTime + (scene.durationSec || 5);
    currentTime = endSec;

    const formatTime = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const cs = Math.floor((sec % 1) * 100);
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    };

    events.push(
      `Dialogue: 0,${formatTime(startSec)},${formatTime(endSec)},Default,,0,0,0,,${scene.hookText}`
    );
  }

  return `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1080
PlayResY: 1920
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

export async function assembleReelVideo(options: ReelAssemblyOptions): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pluri-reel-'));
  const outputPath = options.outputFilePath || path.join(tmpDir, 'output_reel.mp4');

  try {
    const totalDuration = options.scenes.reduce((acc, s) => acc + (s.durationSec || 5), 0);
    const assContent = generateAssSubtitle(options.scenes);
    const assPath = path.join(tmpDir, 'subtitles.ass');
    await fs.writeFile(assPath, assContent, 'utf-8');

    const audioPath = path.join(tmpDir, 'narration.aac');
    let hasAudio = false;

    // Try edge-tts if narration text exists
    const fullNarration = options.scenes.map(s => s.narration || s.hookText).join('. ');
    if (fullNarration.trim()) {
      try {
        await execFileAsync('edge-tts', [
          '--text',
          fullNarration,
          '--voice',
          'pt-BR-AntonioNeural',
          '--write-media',
          audioPath,
        ]);
        const stat = await fs.stat(audioPath);
        if (stat.size > 100) {
          hasAudio = true;
        }
      } catch (err) {
        // edge-tts not available or failed
      }
    }

    if (!hasAudio) {
      // Generate silent audio track matching totalDuration
      await execFileAsync('ffmpeg', [
        '-f',
        'lavfi',
        '-i',
        `anullsrc=r=44100:cl=stereo`,
        '-t',
        String(totalDuration),
        '-q:a',
        '9',
        '-acodec',
        'aac',
        audioPath,
      ]);
    }

    const ffmpegArgs: string[] = [];

    if (options.slideImagePath) {
      ffmpegArgs.push('-loop', '1', '-i', options.slideImagePath);
    } else {
      // Generate colored fallback background
      ffmpegArgs.push('-f', 'lavfi', '-i', 'color=c=0x0f172a:s=1080x1920:r=30');
    }

    ffmpegArgs.push('-i', audioPath);

    // Video filters: scale, subtitle burn-in
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    ffmpegArgs.push(
      '-vf',
      `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,ass=${escapedAss}`,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      String(totalDuration),
      '-y',
      outputPath
    );

    await execFileAsync('ffmpeg', ffmpegArgs);
    return outputPath;
  } finally {
    // Note: Caller is responsible for cleaning up outputPath if needed, or tmpDir when appropriate.
  }
}
