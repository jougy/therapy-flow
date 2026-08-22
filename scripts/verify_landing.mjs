import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = '/Users/jougy/.gemini/antigravity/brain/b1b2434e-43ca-41a5-bbc6-5e0d864bad2b';

async function runVerification() {
  const browser = await chromium.launch({ headless: true });
  
  // --- TEST 1: DESKTOP VIEWPORT (1920x1080) ---
  console.log('=== TEST 1: DESKTOP VIEWPORT (1920x1080) ===');
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await desktopContext.newPage();

  console.log('Navigating to http://127.0.0.1:4323...');
  await page.goto('http://127.0.0.1:4323', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  const desktopScreenshot = path.join(ARTIFACT_DIR, 'desktop_1920x1080.png');
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  console.log(`[Screenshot] Desktop full page saved: ${desktopScreenshot}`);

  const bodyText = await page.innerText('body');

  // Check 1: Hero & Scientific Stats (Johns Hopkins / OMS)
  console.log('\n1. HERO & STATS:');
  const hasJohnsHopkins = /Johns\s*Hopkins/i.test(bodyText);
  const hasOMS = /\bOMS\b|Organização Mundial da Saúde/i.test(bodyText);
  console.log(`   - Johns Hopkins citation present: ${hasJohnsHopkins}`);
  console.log(`   - OMS citation present: ${hasOMS}`);

  const statsSnippets = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.split('\n').filter(line => /Johns|Hopkins|OMS|estatística|estudo|pesquisa|\d+%/i.test(line));
  });
  console.log('   - Snippets found:', statsSnippets);

  // Check 2: Atenção - Comparative (Sem Pluri vs Com Pluri)
  console.log('\n2. ATENÇÃO (COMPARATIVO):');
  const hasSemPluri = /Sem\s*Pluri/i.test(bodyText);
  const hasComPluri = /Com\s*Pluri/i.test(bodyText);
  console.log(`   - "Sem Pluri" section present: ${hasSemPluri}`);
  console.log(`   - "Com Pluri" section present: ${hasComPluri}`);

  // Check 3: Interesse - Tabs (SOAP 5 seções / RLS Supabase / Asaas)
  console.log('\n3. INTERESSE (TABS & RECURSOS):');
  const hasSOAP = /SOAP|5\s*seções/i.test(bodyText);
  const hasRLS = /RLS|Supabase/i.test(bodyText);
  const hasAsaas = /Asaas/i.test(bodyText);
  console.log(`   - SOAP 5 seções mentioned: ${hasSOAP}`);
  console.log(`   - RLS / Supabase mentioned: ${hasRLS}`);
  console.log(`   - Asaas mentioned: ${hasAsaas}`);

  // Inspect interactable tabs
  const tabsList = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[role="tab"], button, [data-state], [class*="tab"]'));
    return elements.map(el => el.textContent?.trim()).filter(t => t && t.length < 50);
  });
  console.log('   - Interactive tabs/buttons found:', tabsList.filter(t => /SOAP|RLS|Supabase|Asaas|Prontuário|Financeiro|Segurança/i.test(t)));

  // Check 4: Desejo - Seletor Faturamento Mensal / Anual
  console.log('\n4. DESEJO (SELETOR FATURAMENTO):');
  const hasMensal = /Mensal/i.test(bodyText);
  const hasAnual = /Anual/i.test(bodyText);
  console.log(`   - Mensal selector option: ${hasMensal}`);
  console.log(`   - Anual selector option: ${hasAnual}`);

  // Check 5: Ação - Formulário
  console.log('\n5. AÇÃO (FORMULÁRIO):');
  const formCount = await page.locator('form').count();
  const inputsCount = await page.locator('input, textarea, select, button[type="submit"]').count();
  console.log(`   - <form> element count: ${formCount}`);
  console.log(`   - Input/Form elements count: ${inputsCount}`);

  await desktopContext.close();

  // --- TEST 2: MOBILE VIEWPORT (375px) ---
  console.log('\n=== TEST 2: MOBILE VIEWPORT (375px) ===');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:4323', { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(1000);

  // Check horizontal overflow
  const initialOverflow = await mobilePage.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const overflowing = [];
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (r.right > docWidth + 1) {
        overflowing.push({
          tag: el.tagName,
          class: el.className ? el.className.toString().substring(0, 50) : '',
          right: Math.round(r.right),
          docWidth
        });
      }
    }
    return {
      docWidth,
      scrollWidth,
      hasOverflow: scrollWidth > docWidth,
      overflowingCount: overflowing.length,
      sampleElements: overflowing.slice(0, 5)
    };
  });
  console.log('Mobile Initial Overflow:', JSON.stringify(initialOverflow, null, 2));

  // Perform full vertical scroll
  console.log('Scrolling top to bottom...');
  const scrollReport = await mobilePage.evaluate(async () => {
    const step = 250;
    const delay = 100;
    let y = 0;
    let prevY = -1;
    const trajectory = [];
    let isStuck = false;

    while (true) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, delay));
      const currentY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      trajectory.push({ target: y, currentY, maxScroll });

      if (currentY === prevY && currentY < maxScroll - 5) {
        isStuck = true;
        break;
      }

      if (currentY >= maxScroll - 5) {
        break;
      }

      prevY = currentY;
      y += step;
    }

    return {
      totalScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      finalScrollY: window.scrollY,
      reachedEnd: Math.abs((window.scrollY + window.innerHeight) - document.documentElement.scrollHeight) <= 10,
      isStuck,
      trajectoryLength: trajectory.length
    };
  });

  console.log('Mobile Scroll Report:', JSON.stringify(scrollReport, null, 2));

  const mobileScreenshot = path.join(ARTIFACT_DIR, 'mobile_375px.png');
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
  console.log(`[Screenshot] Mobile full page saved: ${mobileScreenshot}`);

  await mobileContext.close();
  await browser.close();
  console.log('\nVERIFICATION FINISHED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('Error executing verification:', err);
  process.exit(1);
});
