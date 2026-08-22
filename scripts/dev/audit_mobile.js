import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://localhost:8080';
const CDP_URL = 'http://localhost:9222/json/version';
const OUT_DIR = path.resolve(process.cwd(), 'core/Pluri-Health/30 - QA/Auditoria_Screenshots');

// IDs for the routes
const CLINIC_ID = '9a43608a7556f644158ed378';
const PATIENT_ID = '00121b52-a943-4d63-9c0d-0ef142ac37d5';
const SESSION_ID = '3ca2715e-d35f-4d6b-87a6-9aba3826f67d';
const FORM_ID = 'form_123';
const TOKEN = 'mock_token';

const PAGES = [
  { id: '1_Index', url: `/clinica/${CLINIC_ID}` },
  { id: '2_PacienteDetalhe', url: `/clinica/${CLINIC_ID}/pacientes/${PATIENT_ID}` },
  { id: '3_SessaoDetalhe', url: `/clinica/${CLINIC_ID}/pacientes/${PATIENT_ID}/sessao/${SESSION_ID}` },
  { id: '4_NovoPaciente', url: `/clinica/${CLINIC_ID}/pacientes/novo` },
  { id: '5_Auth', url: `/auth` },
  { id: '6_RedefinirSenha', url: `/auth/redefinir-senha` },
  { id: '7_CadastroContaAlfa', url: `/auth/cadastro` },
  { id: '8_SelecionarClinica', url: `/espacopessoal` },
  { id: '9_ConviteClinica', url: `/convite/clinica/${TOKEN}` },
  { id: '10_ContaConfirmada', url: `/auth/confirmado` },
  { id: '11_Configuracoes', url: `/clinica/${CLINIC_ID}/configuracoes` },
  { id: '12_FormularioEditor', url: `/clinica/${CLINIC_ID}/configuracoes/formularios/${FORM_ID}` },
  { id: '13_ClinicDashboard', url: `/clinica/${CLINIC_ID}/dashboard` },
  { id: '14_CadastroCompleto', url: `/clinica/${CLINIC_ID}/pacientes/${PATIENT_ID}/cadastro` },
  { id: '15_PacienteResumo', url: `/clinica/${CLINIC_ID}/pacientes/${PATIENT_ID}/resumo` },
  { id: '16_PacienteAnamnesis', url: `/clinica/${CLINIC_ID}/pacientes/${PATIENT_ID}/dashboard` },
  { id: '17_PlatformAdmin', url: `/platform` }
];

const DEVICES = [
  { name: 'iPhone_SE', width: 375, height: 667, dpr: 2, mobile: true },
  { name: 'Galaxy_S24', width: 360, height: 780, dpr: 3, mobile: true },
  { name: 'Redmi_Note_13', width: 393, height: 873, dpr: 2.75, mobile: true },
  { name: 'iPad_10th', width: 820, height: 1180, dpr: 2, mobile: true },
  { name: 'Desktop_FHD', width: 1920, height: 1080, dpr: 1, mobile: false, skipLandscape: true },
  { name: 'Desktop_UW', width: 3440, height: 1440, dpr: 1, mobile: false, skipLandscape: true }
];

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Fetching WebSocket URL from Brave...');
  const res = await fetch(CDP_URL);
  const data = await res.json();
  const wsUrl = data.webSocketDebuggerUrl;
  
  if (!wsUrl) throw new Error("Could not find webSocketDebuggerUrl. Is Chrome running with --remote-debugging-port=9222?");

  console.log('Connecting Puppeteer...');
  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  
  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('localhost:8080'));
  if (!page) {
    page = await browser.newPage();
  }

  console.log('Authenticating...');
  await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle2' }).catch(() => {});
  
  // Try to login if we are on the auth page
  try {
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      console.log('Login screen detected. Filling credentials...');
      await page.type('input[type="email"]', 'teste@email.com');
      await page.type('input[type="password"]', '123456');
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
      console.log('Login successful.');
      // Wait for any clinic selection redirect
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log('Already logged in.');
    }
  } catch (e) {
    console.log('Login error or skipped:', e.message);
  }

  for (const p of PAGES) {
    const targetUrl = APP_URL + p.url;
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('Timeout navigation, continuing...'));
    
    // Give it a second to stabilize animations
    await new Promise(r => setTimeout(r, 1000));

    for (const d of DEVICES) {
      // Portrait
      console.log(`  Emulating ${d.name} (Portrait)...`);
      await page.setViewport({ width: d.width, height: d.height, deviceScaleFactor: d.dpr, isMobile: d.mobile, hasTouch: d.mobile });
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: path.join(OUT_DIR, `${p.id}_${d.name}_portrait.png`) });

      // Landscape
      if (!d.skipLandscape) {
        console.log(`  Emulating ${d.name} (Landscape)...`);
        await page.setViewport({ width: d.height, height: d.width, deviceScaleFactor: d.dpr, isMobile: d.mobile, hasTouch: d.mobile });
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(OUT_DIR, `${p.id}_${d.name}_landscape.png`) });
      }
    }
  }

  await page.close();
  await browser.disconnect();
  console.log('Audit screenshots completed.');
}

run().catch(console.error);
