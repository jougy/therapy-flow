import { chromium } from '@playwright/test';
import { createHmac } from "node:crypto";
import fs from 'fs';

function base32ToBuffer(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let cleaned = base32.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error("Invalid base32 character: " + cleaned[i]);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret) {
  const key = base32ToBuffer(secret);
  const epoch = Math.floor(Date.now() / 1000 / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(epoch, 4);

  const hmac = createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

async function verifyEspacoPessoal() {
  console.log('Iniciando teste de verificação do Espaço Pessoal - Novidades...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto('http://localhost:8080/espacopessoal', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  if (desktopPage.url().includes('/auth')) {
    console.log('Realizando login como jougy@gmx.com...');
    await desktopPage.fill('input[type="email"]', 'jougy@gmx.com');
    await desktopPage.fill('input[type="password"]', 'Senha123456!');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(2000);
  }

  if (desktopPage.url().includes('/platform/mfa')) {
    console.log('Submetendo MFA TOTP...');
    await desktopPage.waitForSelector('#mfa-code', { timeout: 5000 });
    const secret = "JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2";
    const totpCode = generateTOTP(secret);
    await desktopPage.fill('#mfa-code', totpCode);
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(2000);
  }

  await desktopPage.goto('http://localhost:8080/espacopessoal', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);

  // Click on "Novidades" button in desktop nav
  const novidadesButton = desktopPage.locator('button:has-text("Novidades")').first();
  if (await novidadesButton.isVisible()) {
    console.log('Clicando na aba Novidades (Desktop)...');
    await novidadesButton.click();
    await desktopPage.waitForTimeout(1500);
  }

  if (!fs.existsSync('core/screenshots')) {
    fs.mkdirSync('core/screenshots', { recursive: true });
  }

  await desktopPage.screenshot({ path: 'core/screenshots/espacopessoal-novidades-alfa-26.08.30-01-desktop.png', fullPage: true });
  console.log('Screenshot desktop gravado em core/screenshots/espacopessoal-novidades-alfa-26.08.30-01-desktop.png');

  // 2. Mobile
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:8080/espacopessoal', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  if (mobilePage.url().includes('/auth')) {
    await mobilePage.fill('input[type="email"]', 'jougy@gmx.com');
    await mobilePage.fill('input[type="password"]', 'Senha123456!');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(2000);
  }

  if (mobilePage.url().includes('/platform/mfa')) {
    const secret = "JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2";
    const totpCode = generateTOTP(secret);
    await mobilePage.fill('#mfa-code', totpCode);
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(2000);
  }

  await mobilePage.goto('http://localhost:8080/espacopessoal', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  const mobileNewsBtn = mobilePage.locator('button[data-personal-mobile-section="news"]').first();
  if (await mobileNewsBtn.count() > 0) {
    console.log('Clicando na aba Novidades no Dock Mobile...');
    await mobileNewsBtn.click({ force: true });
    await mobilePage.waitForTimeout(1500);
  }

  // Check scroll mobile
  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({ path: 'core/screenshots/espacopessoal-novidades-alfa-26.08.30-01-mobile.png', fullPage: true });
  console.log('Screenshot mobile gravado em core/screenshots/espacopessoal-novidades-alfa-26.08.30-01-mobile.png');

  await browser.close();
}

verifyEspacoPessoal().catch(console.error);
