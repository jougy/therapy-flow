#!/usr/bin/env node
/**
 * Coletores Públicos & Resolução Apify/HTML/Avatares para o Motor Cross-Network.
 * Nunca contorna CAPTCHA ou login-wall: apenas metadados públicos e buscas indexadas.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadLocalMarketingEnv } from './media-engine.mjs';
import { cleanHandle } from './identity-matcher.mjs';

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function resolveApifyTokenSilent() {
  const localEnv = loadLocalMarketingEnv();
  const direct = String(process.env.APIFY_API_TOKEN || localEnv.APIFY_API_TOKEN || '').trim();
  if (direct) return direct;
  try {
    const out = execFileSync(
      'pulumi',
      ['env', 'open', 'joao-tdoval-gmail-com-org/plurihealth/pluri-prod', '--format', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000 },
    );
    const parsed = JSON.parse(out || '{}');
    const ev = parsed.environmentVariables || parsed || {};
    return String(ev.APIFY_API_TOKEN || '').trim();
  } catch {
    return '';
  }
}

export function slugifyPerson(text = '') {
  return String(text || 'pessoa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pessoa';
}

export function detectPlatformFromUrl(url = '') {
  const u = String(url || '').toLowerCase();
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('x.com/') || u.includes('twitter.com/')) return 'x';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('google.com/maps') || u.includes('maps.app.goo.gl')) return 'google_maps';
  return 'web_public';
}

export function extractHandleFromUrl(url = '', platform = 'web_public') {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    if (platform === 'linkedin') return cleanHandle(segs[0] === 'in' || segs[0] === 'company' ? segs[1] || '' : segs[0] || '');
    if (platform === 'facebook') return cleanHandle(segs[0] === 'people' ? segs[1] || '' : segs[0] || '');
    if (platform === 'instagram' || platform === 'x' || platform === 'tiktok') {
      if (['p', 'reel', 'explore', 'stories', 'status', 'search', 'share'].includes(segs[0])) return '';
      return cleanHandle(segs[0] || '');
    }
  } catch {
    // ignore
  }
  return '';
}

function extractMetaField(html, propName) {
  const esc = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m1 = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i'));
  if (m1?.[1]) return m1[1].trim();
  const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'));
  return m2?.[1]?.trim() || '';
}

export function extractMentionsAndLinks(text = '', html = '') {
  const mentions = new Set();
  for (const m of String(text).matchAll(/(?:^|[\s,(])@([a-zA-Z0-9._]{3,32})/g)) {
    mentions.add(cleanHandle(m[1].replace(/\.+$/, '')));
  }
  const links = new Set();
  for (const m of `${text} ${html}`.matchAll(/https?:\/\/[^\s"'<>)]+/gi)) {
    const clean = m[0].replace(/[.,;)]+$/, '');
    if (!/w3\.org|schema\.org|ogp\.me|static\.cdn|fbcdn\.net|licdn\.com|twimg\.com/i.test(clean)) {
      links.add(clean);
    }
  }
  return { mentions: [...mentions], links: [...links] };
}

export async function fetchPublicHtmlMetadata(targetUrl) {
  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { ok: false, status: res.status, blocked: res.status === 401 || res.status === 403 || res.status === 429 };
    const html = await res.text();
    const isLoginWall = /authwall|login|entrar no facebook|log in to instagram|captcha/i.test(html.slice(0, 6000)) && !extractMetaField(html, 'og:description');
    const title = extractMetaField(html, 'og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
    const description = extractMetaField(html, 'og:description') || extractMetaField(html, 'description');
    const image = extractMetaField(html, 'og:image');
    const sameAs = [];
    for (const m of html.matchAll(/"sameAs"\s*:\s*(\[[^\]]+\]|"[^"]+")/g)) {
      for (const u of m[1].matchAll(/https?:\/\/[^"'\]]+/g)) sameAs.push(u[0]);
    }
    const { mentions, links } = extractMentionsAndLinks(`${title} ${description}`, html.slice(0, 20000));
    return { ok: true, status: res.status, blocked: isLoginWall, title, description, image, links: [...new Set([...sameAs, ...links])], mentions };
  } catch (err) {
    return { ok: false, status: 0, blocked: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runBingRssSearchBatch(queries = []) {
  const out = [];
  const seen = new Set();
  for (const query of queries.slice(0, 4)) {
    try {
      const res = await fetch(
        `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`,
        { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const item = m[1];
        const title = (item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const url = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
        const snippet = (item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({ query, title, url, snippet });
      }
    } catch {
      // ignore individual query failure
    }
  }
  return out;
}

export async function runApifyGoogleSearchBatch(queries = [], apifyToken = '') {
  if (queries.length === 0) return [];
  if (apifyToken) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?waitForFinish=60&token=${encodeURIComponent(apifyToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: queries.join('\n'),
            resultsPerPage: 8,
            maxPagesPerQuery: 1,
            countryCode: 'br',
            languageCode: 'pt',
          }),
          signal: AbortSignal.timeout(70_000),
        },
      );
      if (res.ok) {
        const runData = await res.json();
        const dsId = runData?.data?.defaultDatasetId;
        if (dsId) {
          const dsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${encodeURIComponent(apifyToken)}&limit=100`, {
            signal: AbortSignal.timeout(20_000),
          });
          if (dsRes.ok) {
            const pages = await dsRes.json();
            const out = [];
            for (const page of Array.isArray(pages) ? pages : []) {
              for (const org of page?.organicResults || []) {
                if (!org?.url) continue;
                out.push({
                  query: page?.searchQuery?.term || '',
                  title: String(org.title || '').trim(),
                  url: String(org.url || '').trim(),
                  snippet: String(org.description || '').trim(),
                });
              }
            }
            if (out.length > 0) return out;
          }
        }
      }
    } catch {
      // fallback to Bing RSS below
    }
  }
  return runBingRssSearchBatch(queries);
}

export async function runApifyInstagramProfile(handle = '', apifyToken = '') {
  if (!apifyToken || !handle) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=45&token=${encodeURIComponent(apifyToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanHandle(handle)] }),
        signal: AbortSignal.timeout(55_000),
      },
    );
    if (!res.ok) return null;
    const runData = await res.json();
    const dsId = runData?.data?.defaultDatasetId;
    if (!dsId) return null;
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${encodeURIComponent(apifyToken)}&limit=5`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!dsRes.ok) return null;
    const items = await dsRes.json();
    return Array.isArray(items) && items[0] ? items[0] : null;
  } catch {
    return null;
  }
}

export async function downloadAvatar(imageUrl, destDir, fileSlug) {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null;
  try {
    const res = await fetch(imageUrl, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('image') && !ct.includes('octet-stream')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null;
    fs.mkdirSync(destDir, { recursive: true });
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const filePath = path.join(destDir, `${fileSlug}.${ext}`);
    fs.writeFileSync(filePath, buf);
    return filePath;
  } catch {
    return null;
  }
}

export function inferCityStateFromText(text = '') {
  const m = String(text).match(/\b(São Paulo|Sao Paulo|Campinas|Rio de Janeiro|Belo Horizonte|Curitiba|Porto Alegre|Bras[ií]lia|Goi[aâ]nia|Salvador|Fortaleza|Recife|Florian[oó]polis|Ribeir[aã]o Preto|Sorocaba|Santo Andr[eé]|S[aã]o Bernardo|Guarulhos|Osasco|Santos|Londrina|Maring[aá]|Joinville|Uberl[aâ]ndia|Vit[oó]ria|Niter[oó]i)\b(?:\s*[-/,]\s*(SP|RJ|MG|PR|RS|SC|DF|GO|BA|CE|PE|ES))?/i);
  return { city: m?.[1] || '', state: m?.[2]?.toUpperCase() || '' };
}
