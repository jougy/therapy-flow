import { createHash } from 'node:crypto';

export interface SlideSpec {
  headline?: string;
  body?: string;
  cta?: string;
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export function escapeXml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wrapSvgText(text: string, maxCharsPerLine: number, maxLines = 4): string[] {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxCharsPerLine ? `${word.slice(0, Math.max(4, maxCharsPerLine - 1))}…` : word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const consumedWords = lines.join(' ').split(' ').length;
    if (consumedWords < words.length && !lines[maxLines - 1].endsWith('…')) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(4, maxCharsPerLine - 1))}…`;
    }
  }
  return lines;
}

function isLightHex(hex: string): boolean {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export async function renderSvgToPng(
  svg: string,
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/svg+xml'; sha256: string }> {
  const sha256 = createHash('sha256').update(svg).digest('hex');
  let buffer: Buffer = Buffer.from(svg, 'utf-8');
  let contentType: 'image/png' | 'image/svg+xml' = 'image/svg+xml';

  try {
    const resvgPkg = await import('@resvg/resvg-js');
    const Resvg = resvgPkg.Resvg || (resvgPkg as { default?: { Resvg?: typeof resvgPkg.Resvg } }).default?.Resvg;
    if (Resvg) {
      const resvg = new Resvg(svg, {
        fitTo: { mode: 'original' as const },
        font: {
          loadSystemFonts: true,
          defaultFontFamily: 'Noto Sans',
        },
      });
      buffer = resvg.render().asPng();
      contentType = 'image/png';
    }
  } catch {
    // Fallback limpo para SVG quando binding nativo não estiver disponível
  }

  return { buffer, contentType, sha256 };
}

export async function renderSlideAsset(
  spec: SlideSpec,
  format: '1080x1080' | '1080x1920' = '1080x1080',
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/svg+xml'; sha256: string; svg: string }> {
  const width = 1080;
  const height = format === '1080x1920' ? 1920 : 1080;

  const bg = spec.backgroundColor || '#f0f9ff';
  const lightTheme = isLightHex(bg);
  const primary = spec.primaryColor || '#0284c7';
  const secondary = spec.secondaryColor || (lightTheme ? '#0f172a' : '#e2e8f0');
  const bodyColor = lightTheme ? '#334155' : '#94a3b8';
  const accent = spec.accentColor || '#10b981';

  const brandName = escapeXml(spec.brandName || 'Pluri Fisio');
  const headlineLines = wrapSvgText(spec.headline || 'Pluri Fisio · Saúde Clínica', 26, 3);
  const bodyLines = wrapSvgText(spec.body || '', 44, 5);
  const ctaLines = wrapSvgText(spec.cta || '', 42, 2);

  const headlineTspans = headlineLines
    .map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 74}">${escapeXml(line)}</tspan>`)
    .join('');
  const bodyStartY = headlineLines.length * 76 + 48;
  const bodyTspans = bodyLines
    .map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 48}">${escapeXml(line)}</tspan>`)
    .join('');
  const ctaTspans = ctaLines
    .map((line, i) => `<tspan x="44" dy="${i === 0 ? 0 : 42}">${escapeXml(line)}</tspan>`)
    .join('');

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}" />
      <stop offset="100%" stop-color="${lightTheme ? '#e0f2fe' : '#020617'}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <rect x="80" y="80" width="120" height="12" rx="6" fill="url(#accentGrad)" />
  <text x="220" y="96" font-family="Noto Sans, DejaVu Sans, Liberation Sans, sans-serif" font-size="30" font-weight="700" fill="${primary}">${brandName}</text>
  <g transform="translate(80, 220)">
    <text x="0" y="0" font-family="Noto Sans, DejaVu Sans, Liberation Sans, sans-serif" font-size="60" font-weight="800" fill="${secondary}">${headlineTspans}</text>
    ${bodyLines.length ? `<text x="0" y="${bodyStartY}" font-family="Noto Sans, DejaVu Sans, Liberation Sans, sans-serif" font-size="34" font-weight="400" fill="${bodyColor}">${bodyTspans}</text>` : ''}
  </g>
  ${
    ctaLines.length
      ? `<g transform="translate(80, ${height - 250})">
    <rect x="0" y="0" width="${width - 160}" height="120" rx="22" fill="${primary}" opacity="0.12" />
    <rect x="0" y="0" width="${width - 160}" height="120" rx="22" fill="none" stroke="${primary}" stroke-width="2.5" />
    <text x="44" y="54" font-family="Noto Sans, DejaVu Sans, Liberation Sans, sans-serif" font-size="32" font-weight="700" fill="${lightTheme ? '#0369a1' : accent}">${ctaTspans}</text>
  </g>`
      : ''
  }
  <text x="80" y="${height - 56}" font-family="Noto Sans, DejaVu Sans, Liberation Sans, sans-serif" font-size="22" fill="#64748b">plurifisio.com.br · pluri.health</text>
</svg>`;

  const rendered = await renderSvgToPng(svg);
  return { ...rendered, svg };
}
