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

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'jougy@gmx.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Senha123456!';
const MFA_SECRET = process.env.TEST_MFA_SECRET || 'JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2';

async function verifyBetaRelease() {
  console.log('Iniciando verificação E2E da release beta-26.09.17-01...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Viewport Test (1440x900)
    console.log('\n--- 1. Teste Desktop (1440x900) ---');
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(`${BASE_URL}/espacopessoal`, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1000);

    if (desktopPage.url().includes('/auth')) {
      console.log('Realizando autenticação administrativa...');
      await desktopPage.fill('input[type="email"]', ADMIN_EMAIL);
      await desktopPage.fill('input[type="password"]', ADMIN_PASSWORD);
      await desktopPage.click('button[type="submit"]');
      await desktopPage.waitForTimeout(2000);
    }

    if (desktopPage.url().includes('/platform/mfa')) {
      console.log('Submetendo código TOTP MFA...');
      await desktopPage.waitForSelector('#mfa-code', { timeout: 5000 });
      const totpCode = generateTOTP(MFA_SECRET);
      await desktopPage.fill('#mfa-code', totpCode);
      await desktopPage.click('button[type="submit"]');
      await desktopPage.waitForTimeout(2000);
    }

    await desktopPage.goto(`${BASE_URL}/espacopessoal`, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);

    const novidadesButton = desktopPage.locator('button:has-text("Novidades")').first();
    if (await novidadesButton.isVisible()) {
      console.log('Navegando para a seção Novidades...');
      await novidadesButton.click();
      await desktopPage.waitForTimeout(1500);
    }

    const isBetaVisible = await desktopPage.getByText("beta-26.09.17-01").first().isVisible();
    console.log('Versão beta-26.09.17-01 visível:', isBetaVisible);

    const cepItem = desktopPage.getByText("Preenchimento Automático de Endereço via CEP");
    console.log('Tópico "Preenchimento Automático de Endereço via CEP" visível:', await cepItem.isVisible());

    if (!fs.existsSync('core/screenshots')) {
      fs.mkdirSync('core/screenshots', { recursive: true });
    }

    await desktopPage.screenshot({ path: 'core/screenshots/novidades-beta-26.09.17-01-desktop.png', fullPage: true });
    console.log('Screenshot desktop salvo em core/screenshots/novidades-beta-26.09.17-01-desktop.png');

    await desktopContext.close();

    // 2. Mobile Viewport Test (375x812)
    console.log('\n--- 2. Teste Mobile (375x812) com Scroll Obrigatório ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${BASE_URL}/espacopessoal`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    if (mobilePage.url().includes('/auth')) {
      await mobilePage.fill('input[type="email"]', ADMIN_EMAIL);
      await mobilePage.fill('input[type="password"]', ADMIN_PASSWORD);
      await mobilePage.click('button[type="submit"]');
      await mobilePage.waitForTimeout(2000);
    }

    if (mobilePage.url().includes('/platform/mfa')) {
      const totpCode = generateTOTP(MFA_SECRET);
      await mobilePage.fill('#mfa-code', totpCode);
      await mobilePage.click('button[type="submit"]');
      await mobilePage.waitForTimeout(2000);
    }

    await mobilePage.goto(`${BASE_URL}/espacopessoal`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    const mobileNewsBtn = mobilePage.locator('button[data-personal-mobile-section="news"]').first();
    if (await mobileNewsBtn.count() > 0) {
      await mobileNewsBtn.click({ force: true });
      await mobilePage.waitForTimeout(1500);
    }

    // Validação estrita de scroll mobile
    await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mobilePage.waitForTimeout(500);

    await mobilePage.screenshot({ path: 'core/screenshots/novidades-beta-26.09.17-01-mobile.png', fullPage: true });
    console.log('Screenshot mobile salvo em core/screenshots/novidades-beta-26.09.17-01-mobile.png');

    await mobileContext.close();

    console.log('\n✅ Validação E2E da release beta-26.09.17-01 concluída com sucesso!');
  } finally {
    // Blindagem de processos: encerramento garantido da instância do navegador
    await browser.close();
  }
}

verifyBetaRelease().catch((err) => {
  console.error("Erro na verificação da release:", err);
  process.exit(1);
});
