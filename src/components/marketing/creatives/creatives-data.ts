/**
 * Data and helpers for Affiliate Creative Assets & Copy Templates
 * Based on F10 - Central de Criativos e Banners Copia e Cola
 */

export type CreativeCategory = "stories" | "feed" | "banners" | "whatsapp";

export interface AffiliateCreative {
  id: string;
  title: string;
  subtitle: string;
  category: CreativeCategory;
  dimensions: string;
  previewHeadline: string;
  previewSubtext: string;
  copyTemplate: string;
  gradient: string;
}

export const AFFILIATE_CREATIVES: readonly AffiliateCreative[] = [
  {
    id: "story-pain-solution",
    title: "Stories: Chega de Prontuário em Papel",
    subtitle: "Dor vs Solução: Como parar de perder o almoço preenchendo fichas",
    category: "stories",
    dimensions: "1080x1920 (Stories)",
    previewHeadline: "Chega de perder 1h do seu almoço com prontuário em papel",
    previewSubtext: "Com a Pluri Health faço a evolução em 1 minuto no celular.",
    copyTemplate:
      "Chega de perder seu tempo de almoço passando evolução a limpo no papel! 🤯 Descobri o @plurihealth e agora faço todo o prontuário eletrônico em 1 minuto pelo celular. Use meu cupom {{couponCode}} para ter 30% OFF no 1º mês! Acesse: {{affiliateLink}}",
    gradient: "from-emerald-600 to-teal-800",
  },
  {
    id: "story-evolution-1min",
    title: "Stories: Evolução em 1 min no Celular",
    subtitle: "Evolução ágil e assinatura digital na maca",
    category: "stories",
    dimensions: "1080x1920 (Stories)",
    previewHeadline: "Evolução clínica em menos de 1 minuto no celular",
    previewSubtext: "Assinatura digital dos termos pelo paciente direto na tela.",
    copyTemplate:
      "Evolução rápida no celular enquanto o paciente ainda tá na maca! 📱 Com o Pluri Health ganhei 2 horas a mais no meu dia no consultório. Teste grátis com meu cupom exclusivo {{couponCode}} no link: {{affiliateLink}}",
    gradient: "from-blue-600 to-indigo-800",
  },
  {
    id: "feed-legal-errors",
    title: "Carrossel: 3 Erros Jurídicos no Prontuário",
    subtitle: "Conformidade COFFITO e blindagem contra litígios",
    category: "feed",
    dimensions: "1080x1350 (Feed)",
    previewHeadline: "3 erros jurídicos que a maioria dos fisioterapeutas comete",
    previewSubtext: "Rasuras, falta de termos assinados e armazenamento inseguro anulam sua defesa.",
    copyTemplate:
      "Você sabia que rasuras ou prontuários incompletos podem anular sua defesa jurídica no conselho? O Pluri Health garante conformidade total com as resoluções do COFFITO, backup seguro e assinatura digital dos termos. Garanta 30% de desconto no 1º mês com meu cupom {{couponCode}}! Acesse: {{affiliateLink}}",
    gradient: "from-purple-600 to-slate-900",
  },
  {
    id: "feed-patient-discharge",
    title: "Feed: Gráficos de Evolução e Alta",
    subtitle: "Demonstração visual de resultados que encanta o paciente",
    category: "feed",
    dimensions: "1080x1080 (Feed)",
    previewHeadline: "Como encantar seu paciente com relatórios visuais de alta",
    previewSubtext: "Demonstre a melhora funcional em gráficos comparativos elegantes.",
    copyTemplate:
      "Apresentar gráficos visuais de evolução clínica acelera a adesão e valoriza sua consulta de fisioterapia. Toda a gestão clínica simplificada na palma da sua mão. Teste o Pluri Health com meu cupom parceiro {{couponCode}}: {{affiliateLink}}",
    gradient: "from-amber-600 to-orange-800",
  },
  {
    id: "banner-official-partner",
    title: "Banner: Parceiro Oficial Pluri Health",
    subtitle: "Para site profissional, cabeçalho de blog ou LinkedIn",
    category: "banners",
    dimensions: "1200x630 (Banner)",
    previewHeadline: "Parceiro Oficial Pluri Health",
    previewSubtext: "Tecnologia e inteligência clínica para fisioterapeutas",
    copyTemplate:
      "Somos parceiros oficiais da Pluri Health, a plataforma de gestão e prontuário mais inteligente para fisioterapia. Acesse {{affiliateLink}} e use o cupom {{couponCode}} para 30% de desconto imediato!",
    gradient: "from-emerald-700 to-cyan-900",
  },
  {
    id: "banner-discount-badge",
    title: "Badge Quadrado: Cupom 30% OFF",
    subtitle: "Selo oficial de desconto para redes e grupos",
    category: "banners",
    dimensions: "1080x1080 (Badge)",
    previewHeadline: "30% OFF no 1º Mês",
    previewSubtext: "Cupom oficial de boas-vindas para novos membros",
    copyTemplate:
      "Cadastre-se na Pluri Health através do link {{affiliateLink}} e informe o cupom {{couponCode}} para desbloquear 30% de desconto imediato na 1ª mensalidade!",
    gradient: "from-rose-600 to-pink-800",
  },
  {
    id: "whatsapp-direct-peer",
    title: "WhatsApp: Mensagem 1 a 1 para Colega",
    subtitle: "Tom consultivo e amigável sem parecer venda fria",
    category: "whatsapp",
    dimensions: "Texto Pronto",
    previewHeadline: "Indicação Direta para Colega Fisioterapeuta",
    previewSubtext: "Foco na dor do colega: tempo de almoço e papelada",
    copyTemplate:
      "Fala colega! Tudo bem? Vi que você estava procurando uma forma melhor de organizar seus prontuários e agenda da clínica. Eu comecei a usar o Pluri Health e mudou minha rotina (consigo evoluir os pacientes em 1 min pelo celular). Consegui um cupom de 30% de desconto pra você testar: *{{couponCode}}*. O link de cadastro é esse aqui: {{affiliateLink}} 🚀",
    gradient: "from-emerald-500 to-green-700",
  },
  {
    id: "whatsapp-group-post",
    title: "WhatsApp: Recomendação para Grupos",
    subtitle: "Ideal para grupos de pós, residência ou especialização",
    category: "whatsapp",
    dimensions: "Texto Pronto",
    previewHeadline: "Post para Grupos de Fisioterapia e Cursos",
    previewSubtext: "Dica de colega com autoridade e recomendação sincera",
    copyTemplate:
      "Pessoal, dica rápida de ferramenta que me ajudou demais no consultório: o Pluri Health. Dá pra fazer prontuário eletrônico completo, termos com assinatura na tela e controle de presenças. Quem quiser testar com desconto especial, liberei meu cupom de parceiro *{{couponCode}}* (30% OFF na 1ª mensalidade): {{affiliateLink}} Vale muito a pena conferir!",
    gradient: "from-teal-600 to-emerald-800",
  },
];

export function buildAffiliateLink(affiliateSlug?: string, couponCode?: string): string {
  const identifier = affiliateSlug?.trim() || couponCode?.toLowerCase().trim() || "convite";
  return `https://plurihealth.com.br/convite/${identifier}`;
}

export function interpolateCopy(
  template: string,
  couponCode: string,
  affiliateLink: string
): string {
  return template
    .replace(/\{\{couponCode\}\}/g, couponCode)
    .replace(/\{\{affiliateLink\}\}/g, affiliateLink);
}

export function generateCreativeSvg(
  creative: AffiliateCreative,
  couponCode: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
  <g fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">
    <text x="80" y="100" font-size="28" font-weight="bold" fill="#34d399">PLURI HEALTH • PARCEIRO OFICIAL</text>
    <text x="80" y="220" font-size="52" font-weight="bold">${escapeXml(creative.previewHeadline)}</text>
    <text x="80" y="300" font-size="30" fill="#cbd5e1">${escapeXml(creative.previewSubtext)}</text>
    <rect x="80" y="400" width="460" height="90" rx="16" fill="#10b981" />
    <text x="110" y="460" font-size="34" font-weight="bold" fill="#ffffff">CUPOM: ${escapeXml(couponCode)}</text>
    <text x="80" y="560" font-size="22" fill="#94a3b8">plurihealth.com.br • Gestão Clínica de Alta Performance</text>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function triggerDownloadCreative(
  creative: AffiliateCreative,
  couponCode: string
): void {
  const dataUrl = generateCreativeSvg(creative, couponCode);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `pluri-${creative.id}-${couponCode.toLowerCase()}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
