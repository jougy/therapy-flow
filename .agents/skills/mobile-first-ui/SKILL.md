---
name: mobile-first-ui
description: Heurísticas estritas de Mobile-First (375px/390px), mínimo scroll, tolerância zero a overflow horizontal, expansão widescreen (1440px+), auditoria de responsividade com custo mínimo de tokens e legenda de cores em screenshots anotados. Use sempre que criar ou editar telas, componentes React, modais, formulários, tabelas ou analisar prints do usuário.
---

# Mobile-First, Responsividade Widescreen & Legenda Visual (Pluri-Health)

## 1. Legenda Visual de Mapeamento em Screenshots/Vídeos
Quando o usuário enviar capturas de tela ou vídeos anotados com cores, aplique estritamente:
- **Verde**: Algo correto, não deve ser tocado.
- **Amarelo**: Conteúdo, dado ou texto que deve ser alterado.
- **Vermelho**: Remover item, ou margem/área a ser evitada.
- **Roxo**: Movimentar, alinhar, redimensionar ou corrigir problema de responsividade.
- **Azul**: Conteúdo a ser transformado em popup, modal, drawer ou área expansível.
- **Rosa**: Lógica interativa — tornar a área clicável ou engatilhar evento/ação.

## 2. Filosofia de Mínimo Scroll & Densidade de Informação
- **Anti-Scroll Infinito:** Em telas mobile, evite empilhar páginas gigantescas sem segmentação. Prefira abas com scroll horizontal suave (`tabs`), steppers, accordions ou **Bottom Sheets** (`vaul`) em vez de modais desktop centralizados.
- **Scrolls Internos Independentes:** Em gavetas, modais ou painéis laterais com conteúdo extenso, use `flex-1 overflow-y-auto overscroll-contain` no container filho. **Nunca** permita que o scroll trave ou arraste o fundo da aplicação (body lock).
- **Adequação ao Teclado e Barras Mobile:** Use alturas dinâmicas (`h-[100dvh]` ou `max-h-[88dvh]`) em vez de `h-screen` rígido para não cortar botões na barra do Safari/Chrome mobile.
- **Ações Críticas Sempre Acessíveis:** Botões principais de submissão/salvamento devem permanecer fixados (`sticky bottom-0 pb-safe z-10`).

## 3. Tolerância Zero a Overflow Horizontal
- Containers principais: `w-full max-w-full min-w-0 overflow-x-hidden`.
- Tabelas: envelopadas em `<div className="w-full overflow-x-auto touch-pan-x">`.
- Textos longos, IDs, hashes, URLs e `<pre>`: `truncate`, `break-all` ou `overflow-x-auto max-w-full`.
- Touch targets: mínimo **44x44px** em botões e links interativos.
- Proibido usar larguras fixas (`w-[500px]`) sem breakpoint ou `flex-nowrap` sem `overflow-x-auto`.

## 4. Expansão Progressiva para Widescreen (1440px+)
- Nasce em mobile (`375px`/`390px`) e expande progressivamente com `sm:`, `md:` e `lg:`.
- Contenção ergonômica de formulários: `max-w-xl`, `max-w-2xl` ou `max-w-4xl mx-auto`.
- Grids de dashboards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

## 5. Validação de Responsividade com Custo Mínimo de Tokens
1. **Estático (< 50 tokens):** `npm run check:responsive -- <arquivo>` (verifica classes de risco mobile e uso de `can(capability)`).
2. **Layout Headless:** `npm run audit:layout` (inspeciona `document.body.scrollWidth > window.innerWidth` em viewport `390x844`).
3. **Validação Visual Final:** Instanciar o subagente `browser` (`Model: "flash"`) apenas no fechamento da entrega para validar interação e scroll mobile, referenciando a gravação WebP nativa sem deixar prints soltos no repositório.
