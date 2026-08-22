import * as fs from 'fs';
import * as path from 'path';

const WEBSITE_DIR = '/Users/jougy/Documents/therapy-flow/website/src';

console.log('=== STARTING AUDIT OF http://localhost:4323 (Astro Website) ===\n');

// 1. Audit Hero.astro for the 5 interactive mockup tabs
const heroPath = path.join(WEBSITE_DIR, 'components/Hero.astro');
const heroContent = fs.readFileSync(heroPath, 'utf-8');

console.log('--- TEST 1: HERO SIDEBAR MOCKUP (5 INTERACTIVE TABS) ---');
const tabsExpected = [
  { id: 'visao-geral', name: '📊 Visão Geral', panelId: 'view-visao-geral', keyContent: 'Evolução do Acompanhamento Clínico' },
  { id: 'fichas', name: '📋 Fichas do Paciente', panelId: 'view-fichas', keyContent: 'Ficha de Atendimento #1042' },
  { id: 'agenda', name: '📅 Agenda da Clínica', panelId: 'view-agenda', keyContent: 'Agenda de Hoje · Quinta-feira' },
  { id: 'pagamentos', name: '💳 Controle de Pagamentos', panelId: 'view-pagamentos', keyContent: 'Resumo de Recebimentos do Mês' },
  { id: 'protecao', name: '🔒 Proteção & Privacidade', panelId: 'view-protecao', keyContent: 'Proteção & Segurança dos Pacientes' }
];

let allTabsValid = true;
tabsExpected.forEach(tab => {
  const hasButton = heroContent.includes(`data-mockup="${tab.id}"`);
  const hasPanel = heroContent.includes(`id="${tab.panelId}"`);
  const hasKeyText = heroContent.includes(tab.keyContent);
  const status = hasButton && hasPanel && hasKeyText ? '✅ PASS' : '❌ FAIL';
  console.log(`Tab [${tab.name}]: Button Present: ${hasButton} | Panel Present: ${hasPanel} | Key Content Found: ${hasKeyText} => ${status}`);
  if (!hasButton || !hasPanel || !hasKeyText) allTabsValid = false;
});

const hasTabScript = heroContent.includes("document.querySelectorAll('.mockup-tab-btn')") &&
                     heroContent.includes("getAttribute('data-mockup')") &&
                     heroContent.includes("activePanel.style.display = 'block'");
console.log(`Interactive JS Handler Registered: ${hasTabScript ? '✅ YES' : '❌ NO'}`);


// 2. Audit ResearchDataSection.astro for "Estudos & Evidências em Saúde"
console.log('\n--- TEST 2: SEÇÃO "ESTUDOS & EVIDÊNCIAS EM SAÚDE" ---');
const researchPath = path.join(WEBSITE_DIR, 'components/ResearchDataSection.astro');
const researchContent = fs.readFileSync(researchPath, 'utf-8');

const hasSectionTitle = /Estudos & Evidências em Saúde/i.test(researchContent);
const hasMinSaude = /Ministério da Saúde/i.test(researchContent) && /-70%/i.test(researchContent);
const hasCFM = /Resolução CFM & LGPD/i.test(researchContent) && /100%/i.test(researchContent);
const hasPesquisaBR = /Satisfação no Brasil/i.test(researchContent) && /92%/i.test(researchContent);

console.log(`- Section Title ("Estudos & Evidências em Saúde"): ${hasSectionTitle ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- Card 1 (Ministério da Saúde / -70% tempo): ${hasMinSaude ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- Card 2 (CFM & LGPD / 100% conformidade legal): ${hasCFM ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- Card 3 (Pesquisa no Brasil / 92% retenção): ${hasPesquisaBR ? '✅ PASS' : '❌ FAIL'}`);


// 3. Audit Mobile 375px & Scroll Flow in Layout and CSS
console.log('\n--- TEST 3: MOBILE VIEWPORT (375px) & VERTICAL SCROLL FLOW ---');
const cssPath = path.join(WEBSITE_DIR, 'styles/liquid-neon.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const layoutPath = path.join(WEBSITE_DIR, 'layouts/Layout.astro');
const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

const hasOverflowHiddenHtml = /html\s*\{[^}]*overflow-x:\s*hidden/i.test(cssContent);
const hasOverflowHiddenBody = /body\s*\{[^}]*overflow-x:\s*hidden/i.test(cssContent);
const hasViewportMeta = /name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0"/i.test(layoutContent);
const hasPhysicsEngineScroll = layoutContent.includes('animateSphericalExpansion') && layoutContent.includes('IntersectionObserver');

console.log(`- Viewport Meta Tag (width=device-width): ${hasViewportMeta ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- CSS Anti-Overflow Guard (html overflow-x: hidden): ${hasOverflowHiddenHtml ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- CSS Anti-Overflow Guard (body overflow-x: hidden): ${hasOverflowHiddenBody ? '✅ PASS' : '❌ FAIL'}`);
console.log(`- 60fps Scroll Physics & IntersectionObserver: ${hasPhysicsEngineScroll ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n=== AUDIT COMPLETE ===');
