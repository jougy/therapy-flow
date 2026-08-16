import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../website/dist');
const OUTPUT_DIR = path.resolve(__dirname, '../../.gemini/antigravity/brain/2ba31e38-8f73-489d-9eb0-498de0f0dd84');

function startServer(port) {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      let filePath = path.join(DIST_DIR, reqPath === '/' ? 'index.html' : reqPath);
      const extname = String(path.extname(filePath)).toLowerCase();
      const contentType = mimeTypes[extname] || 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          if (error.code === 'ENOENT') {
            fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, fallback) => {
              if (err2) {
                res.writeHead(404);
                res.end('404 Not Found');
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(fallback, 'utf-8');
              }
            });
          } else {
            res.writeHead(500);
            res.end('Server Error: ' + error.code);
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running at http://127.0.0.1:${port}/`);
      resolve(server);
    });
  });
}

async function run() {
  const PORT = 43210;
  const server = await startServer(PORT);
  const targetUrl = `http://127.0.0.1:${PORT}/`;

  console.log('Launching Playwright Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const report = {
    desktop: {},
    mobile: {},
    aidaComponents: {},
    issues: []
  };

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP TEST (1920x1080)
    // -------------------------------------------------------------
    console.log('\n=== TESTING DESKTOP VIEWPORT (1920x1080) ===');
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(targetUrl, { waitUntil: 'networkidle' });

    // Desktop full page screenshot
    const desktopScreenshotPath = path.join(OUTPUT_DIR, 'desktop_1920x1080.png');
    await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log('Saved desktop screenshot:', desktopScreenshotPath);

    // Hero details
    const h1Count = await desktopPage.locator('h1').count();
    const h1Text = h1Count > 0 ? await desktopPage.locator('h1').first().innerText() : '';
    const heroBadges = await desktopPage.locator('header span, section:first-of-type span').allInnerTexts();

    report.desktop.hero = {
      h1Count,
      h1Text: h1Text.replace(/\s+/g, ' ').trim(),
      heroBadges
    };

    // Neon borders & Badges
    const neonElements = await desktopPage.locator('[class*="neon"], [class*="glow"], [class*="cyan"], [class*="blue"], [class*="border"]').count();
    const badgesCount = await desktopPage.locator('[class*="badge"], [class*="rounded-full"]').count();
    report.desktop.visuals = { neonElements, badgesCount };

    // Interactive Tabs
    const tabs = await desktopPage.locator('button[role="tab"], [class*="tab"], nav button').all();
    report.desktop.tabs = { count: tabs.length, labels: [] };
    for (let tab of tabs) {
      const text = await tab.innerText().catch(() => '');
      if (text) report.desktop.tabs.labels.push(text.trim());
    }

    if (tabs.length > 0) {
      await tabs[Math.min(1, tabs.length - 1)].click().catch(() => {});
      await desktopPage.waitForTimeout(300);
      const tabClickedScreenshot = path.join(OUTPUT_DIR, 'desktop_tab_clicked.png');
      await desktopPage.screenshot({ path: tabClickedScreenshot });
    }

    // Pricing / Plan selector
    const planCards = await desktopPage.locator('[class*="card"], [class*="pricing"], [class*="plano"]').count();
    const billingToggle = desktopPage.locator('button[role="switch"], label:has(input[type="checkbox"]), [class*="toggle"]').first();
    const hasToggle = await billingToggle.isVisible().catch(() => false);

    if (hasToggle) {
      await billingToggle.click().catch(() => {});
      await desktopPage.waitForTimeout(300);
    }
    const pricingScreenshot = path.join(OUTPUT_DIR, 'desktop_pricing.png');
    await desktopPage.screenshot({ path: pricingScreenshot });

    report.desktop.pricing = { planCards, hasToggle };

    // FAQ section
    const faqItems = await desktopPage.locator('details, [class*="accordion"], [class*="faq"]').all();
    report.desktop.faq = { count: faqItems.length, itemTitles: [] };
    for (let item of faqItems.slice(0, 5)) {
      const title = await item.innerText().catch(() => '');
      if (title) report.desktop.faq.itemTitles.push(title.split('\n')[0].trim());
    }

    if (faqItems.length > 0) {
      const firstFaqSummary = desktopPage.locator('details summary, [class*="faq"] button, [class*="accordion"] button').first();
      if (await firstFaqSummary.isVisible().catch(() => false)) {
        await firstFaqSummary.click().catch(() => {});
        await desktopPage.waitForTimeout(300);
      }
    }

    await desktopContext.close();

    // -------------------------------------------------------------
    // 2. MOBILE TEST (375px) & SCROLL
    // -------------------------------------------------------------
    console.log('\n=== TESTING MOBILE VIEWPORT (375px) ===');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(targetUrl, { waitUntil: 'networkidle' });

    // Initial Mobile view screenshot
    const mobileHeaderScreenshot = path.join(OUTPUT_DIR, 'mobile_375_header.png');
    await mobilePage.screenshot({ path: mobileHeaderScreenshot });

    // Horizontal Overflow Check
    const overflowMetrics = await mobilePage.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;

      const offscreenElements = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 1) {
          offscreenElements.push({
            tag: el.tagName,
            class: el.className ? el.className.toString().substring(0, 50) : '',
            id: el.id,
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          });
        }
      }

      return {
        docWidth,
        scrollW,
        hasHorizontalOverflow: scrollW > docWidth,
        overflowingElementsCount: offscreenElements.length,
        offscreenElements: offscreenElements.slice(0, 10)
      };
    });
    report.mobile.overflow = overflowMetrics;

    // Test Mobile Menu
    const menuBtn = mobilePage.locator('button[aria-label*="menu" i], button[aria-label*="navega" i], header button:has(svg)').first();
    const menuBtnVisible = await menuBtn.isVisible().catch(() => false);
    report.mobile.menuButtonVisible = menuBtnVisible;

    if (menuBtnVisible) {
      await menuBtn.click().catch(() => {});
      await mobilePage.waitForTimeout(300);
      const mobileMenuScreenshot = path.join(OUTPUT_DIR, 'mobile_menu_open.png');
      await mobilePage.screenshot({ path: mobileMenuScreenshot });
      // Close menu
      await menuBtn.click().catch(() => {});
      await mobilePage.waitForTimeout(300);
    }

    // Comprehensive End-to-End Vertical Scroll (AGENTS.md Rule 6)
    console.log('Scrolling mobile page top-to-bottom...');
    const scrollData = await mobilePage.evaluate(async () => {
      const totalH = document.documentElement.scrollHeight;
      const step = 250;
      let pos = 0;
      const positions = [];

      while (pos < totalH) {
        window.scrollTo(0, pos);
        await new Promise(r => setTimeout(r, 80));
        pos += step;
        positions.push(window.scrollY);
      }

      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 200));

      const finalScrollY = window.scrollY;
      const viewportH = window.innerHeight;
      const scrollH = document.documentElement.scrollHeight;

      return {
        totalH,
        stepsTaken: positions.length,
        finalScrollY,
        viewportH,
        scrollH,
        reachedBottom: (finalScrollY + viewportH) >= (scrollH - 10)
      };
    });
    report.mobile.scroll = scrollData;

    const mobileFullScreenshot = path.join(OUTPUT_DIR, 'mobile_375_fullpage.png');
    await mobilePage.screenshot({ path: mobileFullScreenshot, fullPage: true });

    // -------------------------------------------------------------
    // 3. AIDA MODEL COMPONENT INSPECTION
    // -------------------------------------------------------------
    console.log('\n=== AIDA COMPONENTS AUDIT ===');
    const pageStructure = await mobilePage.evaluate(() => {
      const bodyText = document.body.innerText;
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim());

      return {
        headings,
        hasHero: headings.length > 0,
        sectionsCount: document.querySelectorAll('section').length,
        hasBadges: document.querySelectorAll('[class*="badge"]').length > 0,
        hasTabs: document.querySelectorAll('[role="tab"], button[data-tab], [class*="tab"]').length > 0,
        hasPricing: bodyText.toLowerCase().includes('plano') || bodyText.toLowerCase().includes('preço') || bodyText.toLowerCase().includes('mensal') || bodyText.toLowerCase().includes('anual'),
        hasFAQ: bodyText.toLowerCase().includes('faq') || bodyText.toLowerCase().includes('dúvida') || bodyText.toLowerCase().includes('pergunta'),
        hasCTA: Array.from(document.querySelectorAll('a, button')).some(b => b.innerText.toLowerCase().includes('começ') || b.innerText.toLowerCase().includes('test') || b.innerText.toLowerCase().includes('agendar'))
      };
    });
    report.aidaComponents = pageStructure;

    console.log('\n=== FINAL SUMMARY REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    fs.writeFileSync(path.join(OUTPUT_DIR, 'test_report.json'), JSON.stringify(report, null, 2));

    await mobileContext.close();

  } catch (err) {
    console.error('Execution Error:', err);
    report.issues.push(err.stack || err.message);
  } finally {
    await browser.close();
    server.close();
  }
}

run();
