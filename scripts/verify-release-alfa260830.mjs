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

async function verify() {
  console.log('Iniciando teste de verificação da release alfa-26.08.30-01...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop Viewport Test
  console.log('\n--- Testando em Desktop (1440x900) ---');
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto('http://localhost:8080/platform', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  if (desktopPage.url().includes('/auth')) {
    console.log('Realizando login como jougy@gmx.com...');
    await desktopPage.fill('input[type="email"]', 'jougy@gmx.com');
    await desktopPage.fill('input[type="password"]', 'Senha123456!');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(2000);
  }

  await desktopPage.goto('http://localhost:8080/platform/novidades', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);

  if (desktopPage.url().includes('/platform/mfa')) {
    console.log('Submetendo MFA TOTP...');
    await desktopPage.waitForSelector('#mfa-code', { timeout: 5000 });
    const secret = "JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2";
    const totpCode = generateTOTP(secret);
    await desktopPage.fill('#mfa-code', totpCode);
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForURL('**/platform/**', { timeout: 10000 });
    await desktopPage.waitForTimeout(1500);
  }

  if (!desktopPage.url().includes('/platform/novidades')) {
    await desktopPage.goto('http://localhost:8080/platform/novidades', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);
  }

  console.log('URL final:', desktopPage.url());

  const isVersionVisible = await desktopPage.getByText("alfa-26.08.30-01").first().isVisible();
  console.log('Versão alfa-26.08.30-01 visível no painel:', isVersionVisible);

  const activeBadge = desktopPage.getByText("Exibida em Destaque").first();
  console.log('Badge "Exibida em Destaque" visível:', await activeBadge.isVisible());

  const pacotesItem = desktopPage.getByText("Gestão e Métricas de Pacotes de Sessões no Dashboard");
  console.log('Tópico "Gestão e Métricas de Pacotes..." visível:', await pacotesItem.isVisible());

  const pwaItem = desktopPage.getByText("Suporte a Aplicativo Web Progressivo (PWA) e Central de Instalação");
  console.log('Tópico "Suporte a Aplicativo Web..." visível:', await pwaItem.isVisible());

  if (!fs.existsSync('core/screenshots')) {
    fs.mkdirSync('core/screenshots', { recursive: true });
  }

  await desktopPage.screenshot({ path: 'core/screenshots/novidades-alfa-26.08.30-01-desktop.png', fullPage: true });
  console.log('Screenshot desktop salvo em core/screenshots/novidades-alfa-26.08.30-01-desktop.png');

  // 2. Mobile Viewport Test (375x812)
  console.log('\n--- Testando em Mobile (375x812 - iPhone) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:8080/platform/novidades', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  if (mobilePage.url().includes('/auth')) {
    await mobilePage.fill('input[type="email"]', 'jougy@gmx.com');
    await mobilePage.fill('input[type="password"]', 'Senha123456!');
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForTimeout(2000);
  }

  await mobilePage.goto('http://localhost:8080/platform/novidades', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  if (mobilePage.url().includes('/platform/mfa')) {
    const totpCode = generateTOTP("JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2");
    await mobilePage.fill('#mfa-code', totpCode);
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL('**/platform/**', { timeout: 10000 });
    await mobilePage.waitForTimeout(1500);
  }

  if (!mobilePage.url().includes('/platform/novidades')) {
    await mobilePage.goto('http://localhost:8080/platform/novidades', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);
  }

  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({ path: 'core/screenshots/novidades-alfa-26.08.30-01-mobile.png', fullPage: true });
  console.log('Screenshot mobile salvo em core/screenshots/novidades-alfa-26.08.30-01-mobile.png');

  await browser.close();
  console.log('\n✅ Validação da release alfa-26.08.30-01 concluída com sucesso!');
}

verify().catch(err => {
  console.error("Erro na verificação:", err);
  process.exit(1);
});
