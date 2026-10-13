#!/usr/bin/env node
/**
 * Zero-Token Layout & Overflow Auditor
 * 
 * Executa inspeção rápida e headless via Playwright nos viewports móvel e desktop,
 * retornando exclusivamente um JSON ultra-enxuto (< 50 tokens) para o terminal.
 * 
 * Uso:
 *   node scripts/dev/audit-layout.mjs --url http://localhost:5173/exemplo
 *   node scripts/dev/audit-layout.mjs --url http://localhost:5173/ --viewports 390x844
 */

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const targetUrl = getArg('--url', 'http://localhost:5173');
const requestedViewports = getArg('--viewports', '390x844,1440x900').split(',');

const VIEWPORT_MAP = {
  '390x844': { width: 390, height: 844, name: 'mobile (iPhone 14/15)' },
  '1440x900': { width: 1440, height: 900, name: 'widescreen' }
};

async function auditViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000); // Aguarda transições e hidratação

  return await page.evaluate(({ vw, vh }) => {
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const winWidth = window.innerWidth;
    const hasHorizontalOverflow = docWidth > winWidth || bodyWidth > winWidth;

    const overflowingElements = [];
    const smallTouchTargets = [];

    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();

      // Detecta elementos que extravasam a largura da tela visível
      if (rect.right > winWidth + 1 && rect.width > 0 && rect.height > 0) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' 
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') 
          : '';
        overflowingElements.push({
          target: `${tag}${id}${cls}`,
          rightOverflowPx: Math.round(rect.right - winWidth)
        });
        if (overflowingElements.length >= 3) break; // Limita para economia estrita de tokens
      }

      // Em viewport mobile, checa touch targets de botões e links (< 44px)
      if (vw <= 430 && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
        if (rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40)) {
          const text = (el.innerText || el.getAttribute('aria-label') || '').slice(0, 20).trim();
          smallTouchTargets.push({
            type: el.tagName.toLowerCase(),
            label: text || 'unlabeled',
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`
          });
          if (smallTouchTargets.length >= 3) break;
        }
      }
    }

    return {
      viewport: `${vw}x${vh}`,
      hasHorizontalOverflow,
      overflowExcessPx: Math.max(0, Math.max(docWidth, bodyWidth) - winWidth),
      topOverflowingElements: overflowingElements,
      smallTouchTargets: smallTouchTargets
    };
  }, { vw: width, vh: height });
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results = [];
    for (const vpKey of requestedViewports) {
      const vp = VIEWPORT_MAP[vpKey.trim()] || { width: 390, height: 844 };
      const report = await auditViewport(page, vp.width, vp.height);
      results.push(report);
    }

    // Saída compacta em JSON puro (baixo custo de tokens)
    console.log(JSON.stringify({ status: 'ok', url: targetUrl, audit: results }));
  } catch (err) {
    console.error(JSON.stringify({ status: 'error', error: err.message }));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
