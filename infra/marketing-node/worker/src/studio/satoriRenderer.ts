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

function escapeXml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function renderSlideAsset(
  spec: SlideSpec,
  format: '1080x1080' | '1080x1920' = '1080x1080'
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/svg+xml'; sha256: string; svg: string }> {
  const width = 1080;
  const height = format === '1080x1920' ? 1920 : 1080;

  const bg = spec.backgroundColor || '#0f172a';
  const primary = spec.primaryColor || '#3b82f6';
  const secondary = spec.secondaryColor || '#e2e8f0';
  const accent = spec.accentColor || '#10b981';

  const headline = escapeXml(spec.headline || 'Pluri-Health Clinical Care');
  const body = escapeXml(spec.body || '');
  const cta = escapeXml(spec.cta || '');
  const brandName = escapeXml(spec.brandName || 'Pluri-Health');

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  
  <!-- Decorative Header Bar -->
  <rect x="80" y="80" width="120" height="12" rx="6" fill="url(#accentGrad)" />
  <text x="220" y="92" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="${secondary}">${brandName}</text>

  <!-- Content Container -->
  <g transform="translate(80, 240)">
    <text x="0" y="0" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="${secondary}" width="${width - 160}">
      ${headline}
    </text>
    ${
      body
        ? `<text x="0" y="180" font-family="system-ui, sans-serif" font-size="36" font-weight="400" fill="#94a3b8" width="${width - 160}">
      ${body}
    </text>`
        : ''
    }
  </g>

  <!-- CTA Box / Footer -->
  ${
    cta
      ? `<g transform="translate(80, ${height - 240})">
    <rect x="0" y="0" width="${width - 160}" height="100" rx="20" fill="${primary}" opacity="0.15" />
    <rect x="0" y="0" width="${width - 160}" height="100" rx="20" fill="none" stroke="${primary}" stroke-width="2" />
    <text x="60" y="62" font-family="system-ui, sans-serif" font-size="36" font-weight="bold" fill="${accent}">${cta}</text>
  </g>`
      : ''
  }
  
  <text x="80" y="${height - 60}" font-family="system-ui, sans-serif" font-size="20" fill="#64748b">Powered by Pluri-Health Studio</text>
</svg>`;

  const sha256 = createHash('sha256').update(svg).digest('hex');
  let buffer: Buffer = Buffer.from(svg, 'utf-8');
  let contentType: 'image/png' | 'image/svg+xml' = 'image/svg+xml';

  try {
    const resvgPkg = await import('@resvg/resvg-js');
    const Resvg = resvgPkg.Resvg || resvgPkg.default?.Resvg;
    if (Resvg) {
      const opts = {
        fitTo: {
          mode: 'original' as const,
        },
      };
      const resvg = new Resvg(svg, opts);
      const pngData = resvg.render();
      buffer = pngData.asPng();
      contentType = 'image/png';
    }
  } catch (err) {
    // Native binding missing or failed, fallback to svg buffer
  }

  return { buffer, contentType, sha256, svg };
}
