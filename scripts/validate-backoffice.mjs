import { chromium } from '@playwright/test';
import { createHmac } from "node:crypto";

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

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    governanceTab: false,
    termsCardTitle: false,
    configButton: false,
    publishButton: false,
    featureFlagsTab: false,
    categoryClicked: false,
    flagToggled: false,
    pendingBadgeVisible: false,
    floatingBarVisible: false,
    cancelButtonVisible: false,
    saveButtonVisible: false,
    cancelRestoresState: false,
    floatingBarDisappearsAfterCancel: false,
  };

  try {
    console.log('1. Navigating to http://localhost:8080/platform ...');
    await page.goto('http://localhost:8080/platform', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // If on /auth
    if (page.url().includes('/auth')) {
      console.log('2. Performing login on /auth as jougy@gmx.com ...');
      await page.fill('input[type="email"]', 'jougy@gmx.com');
      await page.fill('input[type="password"]', 'Senha123456!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    // Explicitly navigate to /platform after login
    console.log('3. Navigating to /platform ...');
    await page.goto('http://localhost:8080/platform', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // If redirected to MFA page
    if (page.url().includes('/platform/mfa')) {
      console.log('4. Performing MFA verification on /platform/mfa ...');
      await page.waitForSelector('#mfa-code', { timeout: 5000 });

      const secret = "JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2";
      const totpCode = generateTOTP(secret);
      console.log('   Generated TOTP code:', totpCode);

      await page.fill('#mfa-code', totpCode);
      await page.waitForTimeout(300);

      console.log('   Submitting MFA form...');
      await page.click('button[type="submit"]');

      await page.waitForURL('**/platform', { timeout: 10000 });
      await page.waitForTimeout(1500);
    }

    console.log('5. Current URL:', page.url());

    const clickTab = async (labelCandidates) => {
      for (const label of labelCandidates) {
        const btn = page.locator(`button:visible:has-text("${label}")`).first();
        if (await btn.isVisible()) {
          await btn.click();
          return true;
        }
      }
      return false;
    };

    // -------------------------------------------------------------
    // Item 1: Governança & Segurança tab validation
    // -------------------------------------------------------------
    console.log('\n--- Validating Item 1: Governança & Segurança ---');
    results.governanceTab = await clickTab(['Governança & Segurança', 'Governança']);
    console.log('Governança & Segurança tab clicked:', results.governanceTab);
    await page.waitForTimeout(1000);

    const cardTitle = page.getByText("Termos de Uso, Consentimento & Compliance");
    results.termsCardTitle = await cardTitle.isVisible();
    console.log('1. Card "Termos de Uso, Consentimento & Compliance" visible:', results.termsCardTitle);

    const configBtn = page.getByRole('button', { name: /Configurar Termos/i });
    results.configButton = await configBtn.isVisible();
    console.log('2. Button "Configurar Termos" visible:', results.configButton);

    const publishBtn = page.getByRole('button', { name: /Disparar Atualização/i });
    results.publishButton = await publishBtn.isVisible();
    console.log('3. Button "Disparar Atualização" visible:', results.publishButton);


    // -------------------------------------------------------------
    // Item 2: Feature Flags Globais tab validation
    // -------------------------------------------------------------
    console.log('\n--- Validating Item 2: Feature Flags Globais ---');
    results.featureFlagsTab = await clickTab(['Feature Flags Globais', 'Feature Flags', 'Flags']);
    console.log('Feature Flags tab clicked:', results.featureFlagsTab);
    await page.waitForTimeout(1000);

    // Select category "UI/Experiência" in sidebar
    const uiCategory = page.locator('button:visible:has-text("UI/Experiência")').first();
    if (await uiCategory.isVisible()) {
      console.log('Selecting category "UI/Experiência" in sidebar...');
      await uiCategory.click();
      results.categoryClicked = true;
      await page.waitForTimeout(500);
    } else {
      console.error('Category button "UI/Experiência" not visible!');
    }

    // Locate ancestor container for "Ligar/Desligar Animações UI"
    const heading = page.locator('h3:has-text("Ligar/Desligar Animações UI")');
    const featureContainer = page.locator('div.rounded-xl.border:has(h3:has-text("Ligar/Desligar Animações UI"))').first();
    const switchInCard = featureContainer.locator('button[role="switch"]');

    const isSwitchVisible = await switchInCard.isVisible();
    console.log('Switch for "Ligar/Desligar Animações UI" visible:', isSwitchVisible);

    if (isSwitchVisible) {
      const initialState = await switchInCard.getAttribute('aria-checked');
      console.log('Initial state of "Ligar/Desligar Animações UI" (aria-checked):', initialState);

      // Click switch
      console.log('Clicking switch for "Ligar/Desligar Animações UI"...');
      await switchInCard.click();
      await page.waitForTimeout(800);

      const toggledState = await switchInCard.getAttribute('aria-checked');
      results.flagToggled = toggledState !== initialState;
      console.log('1. Flag switch toggled:', results.flagToggled, 'New state:', toggledState);

      // Check badge "Alterado (Pendente)"
      const pendingBadge = featureContainer.getByText("Alterado (Pendente)");
      results.pendingBadgeVisible = await pendingBadge.isVisible();
      console.log('2. Badge "Alterado (Pendente)" visible:', results.pendingBadgeVisible);

      // Check floating bar "1 alteração(ões) pendente(s)"
      const floatingBarText = page.getByText(/1 alteração\(ões\) pendente\(s\)/i);
      results.floatingBarVisible = await floatingBarText.isVisible();
      console.log('3. Floating bar "1 alteração(ões) pendente(s)" visible:', results.floatingBarVisible);

      // Check floating bar buttons
      const floatingBarContainer = page.locator('div.fixed.bottom-6');
      const cancelBtn = floatingBarContainer.getByRole('button', { name: "Cancelar" });
      const saveBtn = floatingBarContainer.getByRole('button', { name: "Salvar Alterações" });

      results.cancelButtonVisible = await cancelBtn.isVisible();
      results.saveButtonVisible = await saveBtn.isVisible();
      console.log('4. Floating bar button "Cancelar" visible:', results.cancelButtonVisible);
      console.log('5. Floating bar button "Salvar Alterações" visible:', results.saveButtonVisible);

      // Click Cancelar button
      if (results.cancelButtonVisible) {
        console.log('Clicking "Cancelar" button in floating bar...');
        await cancelBtn.click();
        await page.waitForTimeout(800);

        const stateAfterCancel = await switchInCard.getAttribute('aria-checked');
        results.cancelRestoresState = stateAfterCancel === initialState;
        console.log('6. "Cancelar" restored original state:', results.cancelRestoresState, 'State after cancel:', stateAfterCancel);

        const isBarStillVisible = await floatingBarText.isVisible();
        results.floatingBarDisappearsAfterCancel = !isBarStillVisible;
        console.log('7. Floating bar disappeared after cancel:', results.floatingBarDisappearsAfterCancel);
      }
    }

    console.log('\n--- FINAL SUMMARY RESULTS ---');
    console.log(JSON.stringify(results, null, 2));

    if (Object.values(results).every(v => v === true)) {
      console.log('\nSUCCESS: ALL BACKOFFICE REQUIREMENTS 100% VERIFIED!');
    } else {
      console.log('\nValidation complete.');
    }

  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    await browser.close();
  }
}

run();
