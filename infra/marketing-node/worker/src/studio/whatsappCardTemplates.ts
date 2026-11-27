import { escapeXml, renderSvgToPng, wrapSvgText } from './satoriRenderer.js';

export type WhatsappCardType =
  | 'card_todos_planos_recursos'
  | 'card_todos_planos_precos'
  | 'card_plano_recomendado'
  | 'card_garantia_etica';

export interface WhatsappCardOptions {
  recommendedPlanId?: string;
  leadName?: string;
  launchCouponCode?: string;
}

const FONT = 'Noto Sans, DejaVu Sans, Liberation Sans, sans-serif';

interface PlanCardMeta {
  id: string;
  name: string;
  badge?: string;
  monthly: string;
  quarterly: string;
  annual: string;
  discount: string;
  bullets: string[];
}

const PLAN_ITEMS: PlanCardMeta[] = [
  {
    id: 'prof_basico',
    name: 'Profissional Básico',
    monthly: 'R$ 57',
    quarterly: 'R$ 47/mês',
    annual: 'R$ 37/mês',
    discount: '-35%',
    bullets: ['1 acesso (1 titular)', '1 form universal + 1 comp.', 'Financeiro básico · Zap 1 toque', 'Posse perpétua do profissional'],
  },
  {
    id: 'prof_medio',
    name: 'Profissional Médio',
    badge: 'MAIS POPULAR',
    monthly: 'R$ 87',
    quarterly: 'R$ 67/mês',
    annual: 'R$ 57/mês',
    discount: '-34%',
    bullets: ['1 acesso (1 titular)', 'Formulários ilimitados', 'Financeiro completo e pacotes', 'WhatsApp atalho 1 toque'],
  },
  {
    id: 'prof_top',
    name: 'Profissional Top',
    badge: 'VOCÊ + APOIO',
    monthly: 'R$ 127',
    quarterly: 'R$ 107/mês',
    annual: 'R$ 87/mês',
    discount: '-31%',
    bullets: ['2 acessos (Titular + Secretária)', 'Formulários + recibos', 'Lembretes automáticos WhatsApp', 'Suporte prioritário'],
  },
  {
    id: 'clinica_basico',
    name: 'Clínica Básico',
    monthly: 'R$ 147',
    quarterly: 'R$ 127/mês',
    annual: 'R$ 97/mês',
    discount: '-34%',
    bullets: ['2 acessos (colab. ilimitados)', 'Agendas por salas e macas', 'Migração assistida de papel', 'Prontuários na clínica'],
  },
  {
    id: 'clinica_medio',
    name: 'Clínica Médio',
    badge: 'RECOMENDADO',
    monthly: 'R$ 267',
    quarterly: 'R$ 227/mês',
    annual: 'R$ 177/mês',
    discount: '-33%',
    bullets: ['4 acessos (colab. ilimitados)', 'Permissões editáveis por cargo', 'Controle automático de repasses', 'Financeiro completo'],
  },
  {
    id: 'clinica_top',
    name: 'Clínica Top',
    monthly: 'R$ 447',
    quarterly: 'R$ 387/mês',
    annual: 'R$ 297/mês',
    discount: '-33%',
    bullets: ['8 acessos (colab. ilimitados)', 'Controle total & auditoria', 'Repasses automáticos', 'Lembretes automáticos WhatsApp'],
  },
];

function svgHeader(title: string, subtitle: string): string {
  return `
  <rect width="1080" height="1080" fill="#f0f9ff" />
  <rect x="0" y="0" width="1080" height="148" fill="#0f172a" />
  <rect x="44" y="26" width="176" height="30" rx="15" fill="#0284c7" />
  <text x="132" y="46" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="#ffffff">PLURI FISIO</text>
  <text x="236" y="47" font-family="${FONT}" font-size="16" font-weight="600" fill="#38bdf8">Prontuário, Agenda &amp; Financeiro para Fisioterapia</text>
  <text x="44" y="94" font-family="${FONT}" font-size="34" font-weight="800" fill="#ffffff">${escapeXml(title)}</text>
  <text x="44" y="128" font-family="${FONT}" font-size="19" font-weight="500" fill="#cbd5e1">${escapeXml(subtitle)}</text>`;
}

function buildResourcesCardSvg(): string {
  const solo = PLAN_ITEMS.slice(0, 3);
  const clinic = PLAN_ITEMS.slice(3, 6);

  const renderCol = (items: PlanCardMeta[], x: number, colLabel: string, colColor: string) => {
    const header = `<text x="${x + 4}" y="182" font-family="${FONT}" font-size="17" font-weight="800" fill="${colColor}">${escapeXml(colLabel)}</text>`;
    const cards = items
      .map((p, idx) => {
        const y = 198 + idx * 238;
        const highlight = Boolean(p.badge);
        const stroke = highlight ? '#0284c7' : '#bae6fd';
        const linesSvg = p.bullets
          .map((b, bi) => `<text x="${x + 22}" y="${y + 84 + bi * 32}" font-family="${FONT}" font-size="18" font-weight="500" fill="#334155">• ${escapeXml(b)}</text>`)
          .join('');
        const badgeSvg = p.badge
          ? `<rect x="${x + 286}" y="${y + 18}" width="176" height="28" rx="14" fill="${p.id === 'clinica_medio' ? '#10b981' : '#0284c7'}" />
             <text x="${x + 374}" y="${y + 37}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="#ffffff">${escapeXml(p.badge)}</text>`
          : '';
        return `
        <rect x="${x}" y="${y}" width="484" height="222" rx="18" fill="#ffffff" stroke="${stroke}" stroke-width="${highlight ? '2.5' : '1.5'}" />
        <text x="${x + 22}" y="${y + 42}" font-family="${FONT}" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(p.name)}</text>
        ${badgeSvg}
        ${linesSvg}`;
      })
      .join('');
    return `${header}${cards}`;
  };

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    ${svgHeader('Todos os Planos e Recursos', 'Pacientes e atendimentos ilimitados · Evolução em 30s · LGPD / CFM 1.821')}
    ${renderCol(solo, 44, 'AUTÔNOMOS · 1 TITULAR (POSSE PERPÉTUA)', '#0369a1')}
    ${renderCol(clinic, 552, 'CLÍNICAS & ESTÚDIOS · COLABORADORES ILIMITADOS', '#0f172a')}
    <rect x="44" y="922" width="992" height="122" rx="18" fill="#0f172a" />
    <text x="72" y="962" font-family="${FONT}" font-size="20" font-weight="700" fill="#38bdf8">Todos os planos incluem:</text>
    <text x="72" y="994" font-family="${FONT}" font-size="18" font-weight="500" fill="#f8fafc">• Backups diários, criptografia e guarda legal de 20 anos (Modo Leitura Vitalício)</text>
    <text x="72" y="1024" font-family="${FONT}" font-size="18" font-weight="500" fill="#cbd5e1">• Redes e Hospitais (10+ acessos): Plano Enterprise · Teste Gratuito 7 dias · plurifisio.com.br</text>
  </svg>`;
}

function buildPricesCardSvg(opts: WhatsappCardOptions): string {
  const couponText = String(opts.launchCouponCode || '').trim()
    ? `Use o cupom ${String(opts.launchCouponCode).trim().toUpperCase()} na contratação anual`
    : 'Fale conosco aqui no WhatsApp e liberamos seu cupom na hora';

  const rowsSvg = PLAN_ITEMS.map((p, idx) => {
    const y = 248 + idx * 78;
    const isHighlight = p.id === 'prof_medio' || p.id === 'clinica_medio';
    const rowBg = isHighlight ? '#f0f9ff' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const rowBadge = p.id === 'prof_medio'
      ? `<rect x="296" y="${y + 23}" width="116" height="24" rx="12" fill="#0284c7" /><text x="354" y="${y + 40}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="800" fill="#ffffff">MAIS POPULAR</text>`
      : p.id === 'clinica_medio'
        ? `<rect x="272" y="${y + 23}" width="116" height="24" rx="12" fill="#10b981" /><text x="330" y="${y + 40}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="800" fill="#ffffff">RECOMENDADO</text>`
        : '';
    return `
      <rect x="44" y="${y}" width="992" height="74" fill="${rowBg}" stroke="#e2e8f0" stroke-width="1" />
      <text x="68" y="${y + 44}" font-family="${FONT}" font-size="22" font-weight="800" fill="#0f172a">${escapeXml(p.name)}</text>
      ${rowBadge}
      <text x="505" y="${y + 44}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="600" fill="#475569">${p.monthly}</text>
      <text x="690" y="${y + 44}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="600" fill="#334155">${p.quarterly}</text>
      <text x="896" y="${y + 40}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#0284c7">${p.annual}</text>
      <text x="896" y="${y + 62}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="#059669">(${p.discount} no anual)</text>`;
  }).join('');

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    ${svgHeader('Preços Oficiais & Oferta de Lançamento', 'Escolha entre Mensal, Trimestral ou Anual · +5% OFF extra à vista no PIX')}
    <rect x="44" y="180" width="992" height="66" rx="14" fill="#0284c7" />
    <text x="68" y="220" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff">PLANO</text>
    <text x="505" y="220" text-anchor="middle" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff">MENSAL</text>
    <text x="690" y="220" text-anchor="middle" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff">TRIMESTRAL</text>
    <text x="896" y="220" text-anchor="middle" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff">ANUAL (MELHOR)</text>
    ${rowsSvg}
    <rect x="44" y="736" width="992" height="142" rx="18" fill="#065f46" />
    <rect x="44" y="736" width="992" height="142" rx="18" fill="none" stroke="#10b981" stroke-width="3" />
    <text x="72" y="778" font-family="${FONT}" font-size="21" font-weight="800" fill="#6ee7b7">OFERTA ESPECIAL DE LANÇAMENTO</text>
    <text x="72" y="818" font-family="${FONT}" font-size="28" font-weight="800" fill="#ffffff">Cupom de 1º MÊS GRÁTIS nos Planos Anuais</text>
    <text x="72" y="854" font-family="${FONT}" font-size="19" font-weight="500" fill="#d1fae5">${escapeXml(couponText)} · +5% OFF adicional no PIX</text>
    <rect x="44" y="898" width="992" height="144" rx="18" fill="#0284c7" />
    <text x="72" y="946" font-family="${FONT}" font-size="26" font-weight="800" fill="#ffffff">Teste Gratuito de 7 dias (sem cartão) + Consultoria gratuita</text>
    <text x="72" y="984" font-family="${FONT}" font-size="20" font-weight="500" fill="#e0f2fe">Personalizamos fichas e agenda com você para já sair usando no primeiro dia.</text>
    <text x="72" y="1018" font-family="${FONT}" font-size="18" font-weight="700" fill="#ffffff">pluri.health/auth/cadastro?trial=true · plurifisio.com.br</text>
  </svg>`;
}

function buildRecommendedCardSvg(opts: WhatsappCardOptions): string {
  const plan = PLAN_ITEMS.find((p) => p.id === opts.recommendedPlanId) || PLAN_ITEMS[0];
  const leadLabel = opts.leadName ? `Para ${opts.leadName}` : 'Recomendação Personalizada Pluri Fisio';
  const bullets = plan.bullets
    .map((b, i) => `<text x="78" y="${442 + i * 50}" font-family="${FONT}" font-size="25" font-weight="600" fill="#1e293b">✓ ${escapeXml(b)}</text>`)
    .join('');
  const wrappedSub = wrapSvgText(`${leadLabel} · Melhor relação custo-benefício para a sua fase atual.`, 50, 2);
  const subTspans = wrappedSub.map((l, i) => `<tspan x="78" dy="${i === 0 ? 0 : 32}">${escapeXml(l)}</tspan>`).join('');

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    ${svgHeader(`Plano Ideal: ${plan.name}`, 'Recomendação sob medida Pluri Fisio')}
    <rect x="44" y="182" width="992" height="530" rx="22" fill="#ffffff" stroke="#0284c7" stroke-width="3" />
    <text x="78" y="238" font-family="${FONT}" font-size="21" font-weight="700" fill="#0284c7">${subTspans}</text>
    <text x="78" y="330" font-family="${FONT}" font-size="42" font-weight="800" fill="#0f172a">${escapeXml(plan.name)}</text>
    <text x="78" y="382" font-family="${FONT}" font-size="32" font-weight="800" fill="#0284c7">${plan.annual} <tspan font-size="24" fill="#059669">(${plan.discount} no anual)</tspan></text>
    ${bullets}
    <text x="78" y="672" font-family="${FONT}" font-size="21" font-weight="600" fill="#475569">Mensal: ${plan.monthly} · Trimestral: ${plan.quarterly} · +5% OFF no PIX</text>
    <rect x="44" y="742" width="992" height="296" rx="22" fill="#0f172a" />
    <text x="78" y="802" font-family="${FONT}" font-size="28" font-weight="800" fill="#38bdf8">Próximos passos simples para começar:</text>
    <text x="78" y="858" font-family="${FONT}" font-size="24" font-weight="600" fill="#ffffff">1. Teste Gratuito de 7 dias sem cartão (pluri.health)</text>
    <text x="78" y="906" font-family="${FONT}" font-size="24" font-weight="600" fill="#ffffff">2. Consultoria gratuita para configurar tudo com você</text>
    <text x="78" y="954" font-family="${FONT}" font-size="24" font-weight="800" fill="#6ee7b7">3. Lançamento: cupom de 1º mês grátis nos planos anuais</text>
    <text x="78" y="1008" font-family="${FONT}" font-size="18" fill="#94a3b8">plurifisio.com.br · Conformidade LGPD &amp; CFM 1.821</text>
  </svg>`;
}

function buildEthicsCardSvg(): string {
  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    ${svgHeader('Segurança Clínica & Garantia Ética', 'Conformidade LGPD, Resolução CFM 1.821/2007 e COFFITO 414')}
    <rect x="44" y="196" width="992" height="820" rx="22" fill="#ffffff" stroke="#bae6fd" stroke-width="2" />
    <text x="80" y="274" font-family="${FONT}" font-size="30" font-weight="800" fill="#0f172a">Seus prontuários protegidos e sempre sob seu controle</text>
    <text x="80" y="346" font-family="${FONT}" font-size="24" font-weight="600" fill="#334155">✓ Guarda legal de 20 anos com acesso vitalício em Modo Leitura</text>
    <text x="80" y="408" font-family="${FONT}" font-size="24" font-weight="600" fill="#334155">✓ Criptografia ponta a ponta e backups diários automatizados</text>
    <text x="80" y="470" font-family="${FONT}" font-size="24" font-weight="600" fill="#334155">✓ Evolução rápida em 30s compatível com fiscalização CREFITO</text>
    <text x="80" y="532" font-family="${FONT}" font-size="24" font-weight="600" fill="#334155">✓ Nos planos solo, o histórico pertence perpétuamente ao profissional</text>
    <rect x="80" y="620" width="920" height="140" rx="18" fill="#ecfdf5" stroke="#10b981" stroke-width="2" />
    <text x="112" y="676" font-family="${FONT}" font-size="26" font-weight="800" fill="#065f46">Teste Gratuito de 7 dias sem cartão no cadastro</text>
    <text x="112" y="722" font-family="${FONT}" font-size="22" font-weight="600" fill="#047857">Conheça o sistema sem risco · Oferta de lançamento: 1º mês grátis no anual</text>
    <text x="80" y="960" font-family="${FONT}" font-size="22" font-weight="700" fill="#0284c7">plurifisio.com.br · pluri.health</text>
  </svg>`;
}

export async function renderWhatsappCard(
  cardType: WhatsappCardType,
  opts: WhatsappCardOptions = {},
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/svg+xml'; sha256: string; svg: string }> {
  const svg =
    cardType === 'card_todos_planos_recursos'
      ? buildResourcesCardSvg()
      : cardType === 'card_todos_planos_precos'
        ? buildPricesCardSvg(opts)
        : cardType === 'card_plano_recomendado'
          ? buildRecommendedCardSvg(opts)
          : buildEthicsCardSvg();

  const rendered = await renderSvgToPng(svg);
  return { ...rendered, svg };
}
