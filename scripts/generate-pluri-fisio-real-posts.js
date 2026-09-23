const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "../public/branding/social/pluri_fisio");
fs.mkdirSync(outDir, { recursive: true });

const logoBase64 = fs.readFileSync(path.join(__dirname, "../public/branding/logo/pluri_health_logo_gradient.png")).toString("base64");

// ==========================================
// POST 1: "Conheça o Pluri Fisio: pensado para a maca e para sua rotina"
// Mockup do Tablet com Prontuário Real, Escala EVA e SOAP estruturado
// ==========================================
const post1Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#f0f9ff" />
    </linearGradient>
    <filter id="tabletShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="25" stdDeviation="30" flood-color="#0284c7" flood-opacity="0.18" />
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bgGrad)" />

  <!-- Soft ambient background glows -->
  <circle cx="950" cy="180" r="300" fill="#e0f2fe" opacity="0.6" />
  <circle cx="150" cy="900" r="280" fill="#bae6fd" opacity="0.4" />

  <!-- Header: Logo & Brand -->
  <g transform="translate(540, 110)">
    <image href="data:image/png;base64,${logoBase64}" x="-50" y="-75" width="100" height="100" />
    <text x="0" y="55" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="28" fill="#0f172a" letter-spacing="0.5">Pluri Fisio</text>
  </g>

  <!-- Headline -->
  <g transform="translate(540, 240)">
    <text x="0" y="0" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#0f172a" letter-spacing="-0.5">
      Conheça o <tspan fill="#0284c7">Pluri Fisio</tspan>:
    </text>
    <text x="0" y="56" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#0f172a" letter-spacing="-0.5">
      pensado para a maca e para sua rotina.
    </text>
  </g>

  <!-- Real iPad Mockup Container -->
  <g transform="translate(100, 360)" filter="url(#tabletShadow)">
    <!-- Tablet Bezel (Slate 900) -->
    <rect x="0" y="0" width="880" height="600" rx="36" fill="#0f172a" />
    <circle cx="440" cy="14" r="4" fill="#334155" />

    <!-- Screen Area (Light Theme) -->
    <rect x="18" y="28" width="844" height="554" rx="20" fill="#f8fafc" />

    <!-- App Header Bar -->
    <g transform="translate(18, 28)">
      <rect width="844" height="52" rx="20" fill="#ffffff" />
      <line x1="0" y1="52" x2="844" y2="52" stroke="#e2e8f0" stroke-width="1" />

      <text x="24" y="33" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" font-size="16" fill="#0284c7">Pluri Fisio</text>
      <text x="115" y="33" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="13" fill="#64748b">• Clínica Reabilitar</text>

      <rect x="290" y="10" width="260" height="32" rx="16" fill="#f1f5f9" />
      <text x="320" y="31" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="12" fill="#94a3b8">Buscar paciente, prontuário (⌘K)</text>

      <circle cx="795" cy="26" r="14" fill="#e0f2fe" />
      <text x="795" y="31" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="11" fill="#0284c7">TF</text>
      <text x="745" y="31" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="12" fill="#334155">Fisioterapeuta</text>
    </g>

    <!-- App Body Grid -->
    <g transform="translate(36, 96)">
      <!-- Left Column: Patient Profile & Status -->
      <g transform="translate(0, 0)">
        <rect width="250" height="460" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
        
        <g transform="translate(16, 20)">
          <circle cx="30" cy="30" r="28" fill="#dbeafe" />
          <text x="30" y="36" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="16" fill="#1d4ed8">AC</text>

          <text x="72" y="24" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="14" fill="#0f172a">Amanda Costa</text>
          <text x="72" y="42" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="11" fill="#64748b">Prontuário #042</text>

          <rect x="0" y="70" width="60" height="20" rx="6" fill="#dcfce7" />
          <text x="30" y="84" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#15803d">ATIVO</text>

          <g transform="translate(68, 70)">
            <rect width="150" height="20" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.7" />
            <text x="12" y="14" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">D</text>
            <circle cx="34" cy="10" r="7" fill="#0284c7" />
            <text x="34" y="14" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#ffffff">S</text>
            <text x="56" y="14" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">T</text>
            <circle cx="78" cy="10" r="7" fill="#0284c7" />
            <text x="78" y="14" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#ffffff">Q</text>
            <text x="100" y="14" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">Q</text>
            <text x="122" y="14" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">S</text>
            <text x="138" y="14" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">S</text>
          </g>
        </g>

        <!-- Clinical Lines of Care -->
        <g transform="translate(16, 130)">
          <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="11" fill="#94a3b8">LINHAS DE CUIDADO</text>
          <rect x="0" y="10" width="135" height="24" rx="8" fill="#e0f2fe" />
          <text x="10" y="26" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="11" fill="#0369a1">🦴 Pós-Op LCA Joelho</text>

          <rect x="0" y="40" width="115" height="24" rx="8" fill="#fef3c7" />
          <text x="10" y="56" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="11" fill="#b45309">⚡ Lombalgia Aguda</text>
        </g>

        <!-- Real Package Tracker Widget -->
        <g transform="translate(16, 220)">
          <rect width="218" height="135" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="12" y="22" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Pacote de Reabilitação</text>
          <text x="12" y="44" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" font-size="20" fill="#0284c7">7 <tspan font-size="13" font-weight="500" fill="#64748b">/ 10 sessões</tspan></text>
          
          <rect x="12" y="58" width="194" height="8" rx="4" fill="#e2e8f0" />
          <rect x="12" y="58" width="136" height="8" rx="4" fill="#0284c7" />

          <text x="12" y="86" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="11" fill="#64748b">Restam 3 atendimentos</text>
          <rect x="12" y="98" width="194" height="24" rx="6" fill="#10b981" fill-opacity="0.12" />
          <text x="109" y="114" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="11" fill="#059669">✓ Quitado (Em dia)</text>
        </g>

        <g transform="translate(16, 380)">
          <rect width="218" height="34" rx="8" fill="#0284c7" />
          <text x="109" y="22" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#ffffff">+ Novo Atendimento</text>
        </g>
      </g>

      <!-- Center Column: SOAP Clinical Evolution (The Core) -->
      <g transform="translate(265, 0)">
        <rect width="540" height="460" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />

        <g transform="translate(20, 20)">
          <text x="0" y="18" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" font-size="17" fill="#0f172a">Evolução Clínica do Atendimento</text>
          <text x="0" y="38" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="12" fill="#64748b">Sessão #07 • Hoje às 14:00 • Presença Confirmada</text>

          <rect x="420" y="4" width="80" height="26" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1" />
          <text x="460" y="21" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="11" fill="#16a34a">✓ Concluído</text>
        </g>

        <!-- Real EVA Pain Scale Component -->
        <g transform="translate(20, 72)">
          <rect width="500" height="66" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="16" y="24" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Escala Visual Analógica de Dor (EVA)</text>
          <text x="484" y="24" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" font-size="14" fill="#0284c7">3 / 10</text>

          <!-- 10 Colored Scale Bars -->
          <g transform="translate(16, 36)">
            <rect x="0" y="0" width="42" height="18" rx="4" fill="#10b981" />
            <rect x="46" y="0" width="42" height="18" rx="4" fill="#10b981" />
            <rect x="92" y="0" width="42" height="18" rx="4" fill="#10b981" />
            <rect x="138" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="184" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="230" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="276" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="322" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="368" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
            <rect x="414" y="0" width="42" height="18" rx="4" fill="#cbd5e1" opacity="0.6" />
          </g>
        </g>

        <!-- SOAP Structured Sections (Real Pluri SOAP) -->
        <g transform="translate(20, 154)">
          <!-- Subjetivo -->
          <rect x="0" y="0" width="242" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="14" y="22" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0284c7">S • SUBJETIVO (Queixa)</text>
          <text x="14" y="44" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Paciente relata melhora expressiva</text>
          <text x="14" y="60" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">ao descer degraus. Dor residual</text>
          <text x="14" y="76" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">grau 3 após caminhada prolongada.</text>

          <!-- Objetivo -->
          <rect x="258" y="0" width="242" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="272" y="22" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0284c7">O • OBJETIVO (Testes)</text>
          <text x="272" y="44" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">ADM flexão joelho D: 125°.</text>
          <text x="272" y="60" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Lachman negativo pós-reconstrução.</text>
          <text x="272" y="76" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Sem edema articular visível.</text>

          <!-- Avaliação -->
          <rect x="0" y="145" width="242" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="14" y="167" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0284c7">A • AVALIAÇÃO (Evolução)</text>
          <text x="14" y="189" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Ganho de 10° de amplitude</text>
          <text x="14" y="205" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">em relação à semana anterior.</text>
          <text x="14" y="221" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Boa estabilidade postural estática.</text>

          <!-- Plano -->
          <rect x="258" y="145" width="242" height="135" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="272" y="167" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0284c7">P • PLANO (Conduta)</text>
          <text x="272" y="189" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Exercícios de cadeia cinética fechada.</text>
          <text x="272" y="205" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Treino proprioceptivo em bosu.</text>
          <text x="272" y="221" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="11" fill="#334155">Orientado gelo pós-esforço.</text>
        </g>
      </g>
    </g>
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, "post1_pluri_fisio_real.svg"), post1Svg.trim());
console.log("Post 1 SVG created successfully!");

// ==========================================
// POST 2: "Tudo o que você precisa em um só lugar"
// 3 Módulos Reais: Prontuário & SOAP | Gráficos de Anamnese | Controle de Pacotes
// ==========================================
const post2Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#f0f9ff" />
    </linearGradient>
    <filter id="cardShadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#0284c7" flood-opacity="0.12" />
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.04" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bgGrad2)" />

  <!-- Ambient light circles -->
  <circle cx="980" cy="120" r="260" fill="#e0f2fe" opacity="0.5" />
  <circle cx="80" cy="980" r="280" fill="#bae6fd" opacity="0.35" />

  <!-- Header: Logo & Brand -->
  <g transform="translate(540, 95)">
    <image href="data:image/png;base64,${logoBase64}" x="-45" y="-70" width="90" height="90" />
    <text x="0" y="48" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="26" fill="#0f172a" letter-spacing="0.5">Pluri Fisio</text>
  </g>

  <!-- Headline -->
  <g transform="translate(540, 215)">
    <text x="0" y="0" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#0f172a" letter-spacing="-0.5">
      Tudo o que você precisa
    </text>
    <text x="0" y="54" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#0284c7" letter-spacing="-0.5">
      em um só lugar
    </text>
  </g>

  <!-- 3 Real Component Cards Grid -->
  <g transform="translate(60, 340)">
    
    <!-- CARD 1: Prontuário & SOAP -->
    <g transform="translate(0, 0)" filter="url(#cardShadow2)">
      <rect width="300" height="520" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
      
      <!-- Card App Header -->
      <rect x="0" y="0" width="300" height="50" rx="20" fill="#f8fafc" />
      <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" stroke-width="1" />
      <circle cx="24" cy="25" r="5" fill="#ef4444" />
      <circle cx="38" cy="25" r="5" fill="#f59e0b" />
      <circle cx="52" cy="25" r="5" fill="#10b981" />
      <text x="75" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Prontuário &amp; Atendimento</text>

      <!-- Card Content -->
      <g transform="translate(18, 70)">
        <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="14" fill="#0f172a">Amanda Costa Rocha</text>
        <text x="0" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="11" fill="#64748b">Hoje às 14:00 • Sessão #07</text>

        <!-- EVA Score Bar -->
        <rect x="0" y="44" width="264" height="42" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
        <text x="10" y="62" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="11" fill="#475569">Escala EVA: <tspan font-weight="800" fill="#0284c7">3/10</tspan></text>
        <g transform="translate(10, 68)">
          <rect x="0" y="0" width="22" height="10" rx="2" fill="#10b981" />
          <rect x="24" y="0" width="22" height="10" rx="2" fill="#10b981" />
          <rect x="48" y="0" width="22" height="10" rx="2" fill="#10b981" />
          <rect x="72" y="0" width="22" height="10" rx="2" fill="#e2e8f0" />
          <rect x="96" y="0" width="22" height="10" rx="2" fill="#e2e8f0" />
          <rect x="120" y="0" width="22" height="10" rx="2" fill="#e2e8f0" />
          <rect x="144" y="0" width="22" height="10" rx="2" fill="#e2e8f0" />
        </g>

        <!-- SOAP Preview Mini Blocks -->
        <g transform="translate(0, 102)">
          <!-- S -->
          <rect x="0" y="0" width="264" height="52" rx="6" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1" />
          <text x="8" y="16" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#0284c7">S • SUBJETIVO</text>
          <text x="8" y="32" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">Paciente relata melhora na flexão</text>
          <text x="8" y="44" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">e menos dor ao apoiar peso.</text>

          <!-- O -->
          <rect x="0" y="60" width="264" height="52" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="8" y="76" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#0284c7">O • OBJETIVO</text>
          <text x="8" y="92" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">ADM Joelho: 125° de flexão.</text>
          <text x="8" y="104" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">Teste de gaveta anterior negativo.</text>

          <!-- A / P -->
          <rect x="0" y="120" width="264" height="52" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="8" y="136" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#0284c7">A &amp; P • AVALIAÇÃO E CONDUTA</text>
          <text x="8" y="152" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">Evolução motora rápida. Conduta:</text>
          <text x="8" y="164" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#334155">fortalecimento de quadríceps e bosu.</text>
        </g>

        <!-- Save Button -->
        <rect x="0" y="390" width="264" height="34" rx="8" fill="#10b981" />
        <text x="132" y="412" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#ffffff">✓ Salvo em 54 segundos</text>
      </g>
    </g>

    <!-- CARD 2: Gráficos de Anamnese & Analytics -->
    <g transform="translate(330, 0)" filter="url(#cardShadow2)">
      <rect width="300" height="520" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />

      <!-- Card App Header -->
      <rect x="0" y="0" width="300" height="50" rx="20" fill="#f8fafc" />
      <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" stroke-width="1" />
      <circle cx="24" cy="25" r="5" fill="#ef4444" />
      <circle cx="38" cy="25" r="5" fill="#f59e0b" />
      <circle cx="52" cy="25" r="5" fill="#10b981" />
      <text x="75" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Dashboard &amp; Evolução</text>

      <!-- Card Content -->
      <g transform="translate(18, 70)">
        <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="13" fill="#0f172a">Curva de Redução da Dor (EVA)</text>
        <text x="0" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="11" fill="#64748b">Evolução do paciente nas 7 sessões</text>

        <!-- Line Chart Illustration -->
        <g transform="translate(0, 45)">
          <rect width="264" height="130" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          
          <!-- Grid lines -->
          <line x1="20" y1="20" x2="244" y2="20" stroke="#e2e8f0" stroke-dasharray="3,3" />
          <line x1="20" y1="55" x2="244" y2="55" stroke="#e2e8f0" stroke-dasharray="3,3" />
          <line x1="20" y1="90" x2="244" y2="90" stroke="#e2e8f0" stroke-dasharray="3,3" />

          <!-- Pain Trend Line: 9 -> 8 -> 6 -> 5 -> 4 -> 3 -> 2 -->
          <path d="M 30 25 L 65 35 L 100 60 L 135 70 L 170 80 L 205 92 L 235 102" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round" />
          <circle cx="30" cy="25" r="4" fill="#0284c7" />
          <circle cx="65" cy="35" r="4" fill="#0284c7" />
          <circle cx="100" cy="60" r="4" fill="#0284c7" />
          <circle cx="135" cy="70" r="4" fill="#0284c7" />
          <circle cx="170" cy="80" r="4" fill="#0284c7" />
          <circle cx="205" cy="92" r="4" fill="#0284c7" />
          <circle cx="235" cy="102" r="4" fill="#10b981" />

          <text x="30" y="18" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="700" fill="#ef4444">9</text>
          <text x="235" y="94" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="700" fill="#10b981">2</text>

          <text x="30" y="120" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#94a3b8">S1</text>
          <text x="100" y="120" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#94a3b8">S3</text>
          <text x="170" y="120" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#94a3b8">S5</text>
          <text x="235" y="120" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#94a3b8">S7</text>
        </g>

        <!-- Donut Chart: Distribuição de Diagnósticos -->
        <g transform="translate(0, 195)">
          <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="13" fill="#0f172a">Atendimentos por Cuidado</text>
          
          <rect x="0" y="24" width="264" height="150" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          
          <!-- Donut SVG -->
          <g transform="translate(65, 95)">
            <circle cx="0" cy="0" r="42" fill="none" stroke="#0284c7" stroke-width="18" stroke-dasharray="140 264" stroke-dashoffset="0" />
            <circle cx="0" cy="0" r="42" fill="none" stroke="#10b981" stroke-width="18" stroke-dasharray="75 264" stroke-dashoffset="-140" />
            <circle cx="0" cy="0" r="42" fill="none" stroke="#f59e0b" stroke-width="18" stroke-dasharray="49 264" stroke-dashoffset="-215" />
            <text x="0" y="4" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="13" fill="#0f172a">78</text>
            <text x="0" y="16" text-anchor="middle" font-family="sans-serif" font-weight="500" font-size="8" fill="#64748b">Sessões</text>
          </g>

          <!-- Legend -->
          <g transform="translate(145, 50)">
            <circle cx="0" cy="8" r="4" fill="#0284c7" />
            <text x="10" y="11" font-family="sans-serif" font-size="10" font-weight="600" fill="#334155">Joelho (53%)</text>

            <circle cx="0" cy="30" r="4" fill="#10b981" />
            <text x="10" y="33" font-family="sans-serif" font-size="10" font-weight="600" fill="#334155">Lombar (28%)</text>

            <circle cx="0" cy="52" r="4" fill="#f59e0b" />
            <text x="10" y="55" font-family="sans-serif" font-size="10" font-weight="600" fill="#334155">Ombro (19%)</text>
          </g>
        </g>

        <!-- Footer Tag -->
        <g transform="translate(0, 390)">
          <rect width="264" height="34" rx="8" fill="#e0f2fe" />
          <text x="132" y="22" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="11" fill="#0369a1">📊 Gráficos Gerados em Tempo Real</text>
        </g>
      </g>
    </g>

    <!-- CARD 3: Controle de Pacotes & Recorrência -->
    <g transform="translate(660, 0)" filter="url(#cardShadow2)">
      <rect width="300" height="520" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />

      <!-- Card App Header -->
      <rect x="0" y="0" width="300" height="50" rx="20" fill="#f8fafc" />
      <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" stroke-width="1" />
      <circle cx="24" cy="25" r="5" fill="#ef4444" />
      <circle cx="38" cy="25" r="5" fill="#f59e0b" />
      <circle cx="52" cy="25" r="5" fill="#10b981" />
      <text x="75" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Pacotes &amp; Recorrência</text>

      <!-- Card Content -->
      <g transform="translate(18, 70)">
        <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="14" fill="#0f172a">Gestão Ativa de Planos</text>
        <text x="0" y="30" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="11" fill="#64748b">Controle automático de sessões</text>

        <!-- Pacote 1 -->
        <g transform="translate(0, 48)">
          <rect width="264" height="96" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="12" y="20" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Amanda Costa (LCA Joelho)</text>
          <text x="12" y="40" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="15" fill="#0284c7">7 <tspan font-size="11" font-weight="500" fill="#64748b">/ 10 sessões</tspan></text>
          
          <rect x="12" y="50" width="240" height="6" rx="3" fill="#e2e8f0" />
          <rect x="12" y="50" width="168" height="6" rx="3" fill="#0284c7" />

          <text x="12" y="74" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="10" fill="#64748b">Restam 3 sessões • Quitado</text>
          <text x="252" y="74" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#15803d">70%</text>
        </g>

        <!-- Pacote 2 -->
        <g transform="translate(0, 156)">
          <rect width="264" height="96" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="12" y="20" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#0f172a">Bruno Souza (Pilates Clínico)</text>
          <text x="12" y="40" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="15" fill="#0284c7">9 <tspan font-size="11" font-weight="500" fill="#64748b">/ 10 sessões</tspan></text>
          
          <rect x="12" y="50" width="240" height="6" rx="3" fill="#e2e8f0" />
          <rect x="12" y="50" width="216" height="6" rx="3" fill="#f59e0b" />

          <text x="12" y="74" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="10" fill="#d97706">⚠️ Última sessão! Renovar</text>
          <text x="252" y="74" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="10" fill="#d97706">90%</text>
        </g>

        <!-- Recorrência Semanal da Clínica -->
        <g transform="translate(0, 264)">
          <rect width="264" height="110" rx="10" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1" />
          <text x="12" y="22" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="12" fill="#166534">Pílula Semanal Anti-Falta</text>
          <text x="12" y="38" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="400" font-size="10" fill="#15803d">Horários fixos sincronizados</text>

          <g transform="translate(12, 50)">
            <rect width="240" height="24" rx="12" fill="#ffffff" stroke="#86efac" stroke-width="1" />
            <text x="16" y="16" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">D</text>
            <circle cx="48" cy="12" r="8" fill="#16a34a" />
            <text x="48" y="16" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#ffffff">S</text>
            <text x="80" y="16" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">T</text>
            <circle cx="112" cy="12" r="8" fill="#16a34a" />
            <text x="112" y="16" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#ffffff">Q</text>
            <text x="144" y="16" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">Q</text>
            <circle cx="176" cy="12" r="8" fill="#16a34a" />
            <text x="176" y="16" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#ffffff">S</text>
            <text x="208" y="16" font-family="monospace" font-weight="500" font-size="10" fill="#94a3b8">S</text>
          </g>

          <text x="12" y="96" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="10" fill="#166534">Segunda, Quarta e Sexta • 14:00</text>
        </g>

        <!-- Footer Action -->
        <g transform="translate(0, 390)">
          <rect width="264" height="34" rx="8" fill="#0f172a" />
          <text x="132" y="22" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="11" fill="#ffffff">Aviso de Renovação Automático</text>
        </g>
      </g>
    </g>
  </g>

  <!-- Subtitle Footers -->
  <g transform="translate(540, 920)">
    <text x="0" y="0" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" font-size="16" fill="#0f172a">
      Prontuário SOAP em &lt; 1 min • Gráficos EVA • Pacotes &amp; Recorrência Semanal
    </text>
    <text x="0" y="30" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" font-size="14" fill="#0284c7">
      pluri.health ↗
    </text>
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, "post2_tudo_em_um_so_lugar_real.svg"), post2Svg.trim());
console.log("Post 2 SVG created successfully!");
