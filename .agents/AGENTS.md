# Therapy-Flow (Pluri-Health) - Regras de Memória e Operação

## 1. Memória Externa e Contexto Inicial (A Vault)
Este projeto utiliza uma Vault do Obsidian local como extensão exclusiva de memória viva para evitar sobrecarga de contexto e garantir alinhamento arquitetural contínuo. 

**Ao iniciar uma nova conversa ou quando estiver sem contexto claro sobre a arquitetura do projeto:**
- **NÃO** tente adivinhar estruturas do zero.
- Use a ferramenta `view_file` para ler os seguintes hubs iniciais localizados em `core/Pluri-Health`:
  1. `00 - Navegacao/Codex Brain.md` (Ponto de partida central de regras)
  2. `90 - Meta/Guia operacional da vault Pluri-Health.md` (Regras operacionais)
  3. `00 - Navegacao/Mapa da vault.md` (Mapeamento dos demais tópicos)
  4. `00 - Navegacao/Kanban de Tarefas.md` (Quadro vivo de demandas e prioridades)
- Use a ferramenta `grep_search` ou navegue pela Vault (`list_dir`) de forma inteligente (notas pequenas) em vez de lotar a memória com arquivos grandes de uma só vez.

## 2. Documentação Viva
- Quando houver uma nova decisão técnica, mudança de fluxos, ou nova tabela de banco de dados, **você deve atualizar as anotações na Vault** usando `write_to_file` ou `multi_replace_file_content`, mantendo a documentação 100% atualizada. Mantenha as notas curtas e referencie-as no hub adequado usando links do Obsidian `[[Nome da Nota]]`.

## 3. Fluxos, UI e UX (Browser Subagent)
- Sempre que houver edição em formulários, modais, UI, dashboard ou fluxos de paciente/clínica, você **deve** instanciar o `browser_subagent` nativo do Antigravity para simular interações e garantir a responsividade e o comportamento correto.
- Substitua a necessidade antiga do "Brave CDP" pelas ferramentas de navegador do Antigravity.
- O Antigravity já grava as sessões do browser nativamente em WebP; referencie as gravações do browser e evite deixar prints de lixo soltos no repositório.

## 4. Banco de Dados, Segurança e Supabase
- **Absolutamente Proibido:** O comando `supabase db reset` não pode ser executado sem autorização explícita do usuário para não destruir dados de desenvolvimento locais.
- Mudanças no banco devem ser feitas através de **migrations incrementais** e scripts não destrutivos seguindo o padrão **Expand and Contract**.
- **Fonte Única de Verdade (SSOT):** Agentes de IA **nunca** devem ler as 180 migrações antigas para inferir colunas ou tabelas. Devem consultar o arquivo consolidado `supabase/schema.sql` ou a nota viva `[[Dicionario de Dados e Catalogo do Supabase]]`.
- **Padrão Monetário Estrito:** Sempre gravar centavos em colunas `bigint` com sufixo `_cents` (ex: `amount_charged_cents`). Proibido `numeric(10,2)` para novos campos financeiros de sessão.
- **Compliance Clínico e Soft Delete:** Prontuários e pacientes usam `deleted_at timestamptz` e `ON DELETE RESTRICT` (retenção legal obrigatória de 20 anos CFM 1.821 / LGPD). Proibido `ON DELETE CASCADE` em `sessions`.
- **Proibido Overload de RPC:** Nunca crie duas funções com mesmo nome e parâmetros diferentes no schema `public` para evitar erro `PGRST203` no PostgREST.
- Antes de alterar permissões, logins, Row Level Security (RLS) ou sessões, consulte o `Plano de seguranca - hub` na Vault.
- **Governança Estrita de Papéis Operacionais e RBAC:**
  - **Proibido Hardcode de Papéis na UI:** É expressamente proibido checar papéis manualmente com strings nas telas (ex: `operationalRole === 'admin' || operationalRole === 'owner'`). Toda e qualquer restrição visual de acesso deve utilizar a função soberana `can(capability)`.
  - **SSOT Obrigatório:** Consulte obrigatoriamente a nota `[[Guia Arquitetural de Papeis Operacionais, Hierarquias e RBAC]]` na Vault antes de alterar ou criar regras de acesso.
  - **Papéis Dinâmicos:** O sistema suporta papéis customizados via `role_key text` em `clinic_memberships` e convites; avaliações de permissão devem sempre utilizar `effectiveRoleKey = membership.role_key || membership.operational_role`.
  - **Sincronismo RLS com Capabilities:** Políticas RLS no Postgres devem testar a capability exata (ex: `patients.delete` para exclusão de paciente, `session.delete_draft` para rascunhos de atendimento). Proibido checar capabilities divergentes.

## 5. Legenda Visual de Mapeamento
Quando o usuário mandar capturas de tela (screenshots) ou vídeos editados, siga as instruções de cor estritas:
- **Verde**: Algo correto, não deve ser tocado.
- **Amarelo**: Conteúdo, dado ou texto que deve ser alterado.
- **Vermelho**: Remover item, ou margem a ser evitada.
- **Roxo**: Movimentar, alinhar, redimensionar ou problemas de responsividade.
- **Azul**: Conteúdo a ser transformado em popup, modal ou expansível.
- **Rosa**: Lógica interativa, tornar a área clicável ou engatilhar evento Javascript.

## 6. Heurísticas Estritas de Mobile-First, Mínimo Scroll e Responsividade Widescreen
A plataforma Pluri-Health é concebida como **Mobile-First nativa**. Profissionais de saúde utilizam smartphones em atendimento clínico dinâmico, mas donos e secretárias utilizam desktops com monitores ultra-wide. O layout **nunca** deve quebrar em nenhum dos dois extremos.

### 6.1. Filosofia de Mínimo Scroll & Densidade de Informação
- **Anti-Scroll Infinito:** Em telas mobile, evite empilhar páginas gigantescas sem segmentação. Prefira o uso inteligente de abas com scroll horizontal suave (`tabs`), etapas/steppers, painéis expansíveis (accordions) ou gavetas inferiores (**Bottom Sheets** com `vaul`) em vez de modais desktop centralizados.
- **Scrolls Internos Independentes:** Quando houver conteúdo extenso em gavetas, modais ou painéis laterais, use `flex-1 overflow-y-auto overscroll-contain` no container filho. **Nunca** permita que o scroll do componente trave ou arraste o fundo da aplicação (body lock).
- **Adequação ao Teclado e Barras do Navegador:** Utilize alturas dinâmicas (`h-[100dvh]` ou `max-h-[88dvh]`) em vez de `h-screen` rígido para evitar que a barra de endereços do Safari/Chrome mobile corte botões de ação e rodapés.
- **Ações Críticas Sempre Acessíveis:** Botões principais de submissão ou salvamento devem permanecer visíveis ou fixados (`sticky bottom-0 pb-safe z-10`) com espaçamento de segurança para home indicators de iOS/Android.

### 6.2. Tolerância Zero a Overflow Horizontal (Anti-Horizontal-Scroll)
- **Causa Raiz de Quebras:** Quase 100% dos bugs visuais em mobile decorrem de elementos com largura fixa (`w-[500px]`), tabelas sem wrapper ou flex containers sem quebra de linha (`flex-nowrap`).
- **Blindagem Obrigatória:**
  - Containers principais devem sempre ter `w-full max-w-full min-w-0 overflow-x-hidden`.
  - Tabelas de dados e telemetria **devem** ser envelopadas em `<div className="w-full overflow-x-auto touch-pan-x">` com indicação visual ou sombra de rolagem.
  - Textos longos, identificadores de sistema (IDs, hashes, URLs) e códigos `<pre>` devem usar `truncate`, `break-all` ou `overflow-x-auto max-w-full`.
  - Áreas de toque (touch targets) de botões e links devem ter no mínimo **44x44px** para ergonomia tátil sem provocar cliques acidentais.

### 6.3. Expansão Progressiva para Widescreen (Desktop 1440px+)
- **Mobile-First não significa Mobile-Only:** O design nasce em mobile (375px/390px) e ganha colunas e densidade progressivamente com `md:` e `lg:`.
- **Prevenção de Esticamento Indesejado:** Formulários e campos de texto não devem esticar infinitamente em monitores ultra-wide. Utilize contenção ergonômica centralizada (`max-w-xl`, `max-w-2xl` ou `max-w-4xl mx-auto`).
- Grids de dashboards devem se desdobrar de 1 coluna em mobile (`grid-cols-1`) para 2 em tablets (`sm:grid-cols-2`) e até 4 em monitores widescreen (`lg:grid-cols-4`).

### 6.4. Testes de Responsividade com Custo Mínimo de Tokens
Para não onerar o contexto nem gastar tokens excessivos com prints e sessões longas de browser:
1. **Auditoria de Overflow via Script/Playwright Headless:** Rode scripts de inspeção no terminal via Node/Playwright que abrem o componente no viewport móvel (`390x844`) e retornam **apenas um JSON/CLI sucinto** reportando `document.body.scrollWidth > window.innerWidth` ou elementos que ultrapassam a tela. Custo: < 50 tokens de texto.
2. **Inspeção de CSS Estático:** Conferir ausência de classes de risco (`w-[...px]` estáticos sem breakpoints, `h-screen`, `nowrap` sem `overflow-x-auto`).
3. **Validação Visual Final Seletiva:** Usar o `browser_subagent` apenas na etapa final de fechamento para checar o fluxo de interação e o scroll mobile pontual, sem abusar de capturas intermediárias.

## 7. Gestão e Atualização Obrigatória do Kanban
Todo agente que receber uma demanda, iniciar uma nova tarefa, propor uma melhoria, corrigir um bug ou finalizar uma funcionalidade **DEVE obrigatoriamente** refletir essa ação no Kanban do projeto:
- **Arquivo Oficial:** `core/Pluri-Health/00 - Navegacao/Kanban de Tarefas.md` (e regras detalhadas em `core/Pluri-Health/90 - Meta/Regras de Uso do Kanban.md`).
- **Ao iniciar qualquer tarefa:** Mover ou criar o card correspondente na coluna `## Executando agora`, preenchendo obrigatoriamente:
  - Data e hora de início (`📅 Criado:` / `🔄 Atualizado:` no formato `AAAA-MM-DD HH:mm`).
  - Tags de origem (`#origem/ideia`, `#origem/pedido-usuario`, `#origem/suporte` ou `#origem/auditoria`).
  - Se for pedido de usuário ou suporte, identificar o solicitante: nome, e-mail e ID global (`usr_xxx`).
  - Links para a nota de especificação ou arquivo da Vault (`[[Nome da Nota]]`).
- **Ao concluir a tarefa e os testes:** Mover o card para `## Finalizados`, marcar o checkbox `- [x]` e registrar a data/hora em `✅ Concluído: AAAA-MM-DD HH:mm`.
- **Se cancelada ou adiada:** Mover para `## Canceladas` e incluir o motivo em `🛑 Motivo:`.
- **Nenhum agente deve considerar uma demanda finalizada sem atualizar o Kanban.**

## 8. Arquitetura Dinâmica de Subagentes por Perfil de Complexidade

### 8.1. Papel do Agente Principal no Chat: Planejador Estratégico e Arquiteto
- **Postura:** O agente principal atua estritamente como **Planejador Estratégico, Arquiteto e Tech Lead**.
- **Não codificar de imediato:** Discuta as ideias, analise o impacto, faça perguntas ao usuário para alinhar regras e layout, e **classifique a demanda em um dos 3 Perfis de Execução** descritos abaixo.
- **Desenho do Plano:** Elabore o plano com escopo cirúrgico, registre a tarefa no Kanban e obtenha a validação antes de instanciar subagentes.

### 8.2. Perfis de Execução e Alocação Seletiva de Subagentes

Para economizar tokens, evitar ruído e dar foco total à qualidade sem desperdiçar recursos, o orquestrador seleciona **apenas** o perfil necessário:

---

#### 📱 Perfil A: UI / Layout / Mobile-First Exclusivo (Frontend Only)
*Aplicável para:* Ajustes de tela, responsividade mobile, modais, formulários de UI, alinhamento CSS, componentes React, refatoração visual e correções de viewport.
- **Subagentes Ativados:**
  1. **Subagente Especialista em Frontend Mobile-First:** Focado 100% em layouts fluidos, ergonomia tátil (mínimo scroll, bottom sheets `vaul`, tabs), prevenção de overflow horizontal e adaptação widescreen (`sm:`, `md:`, `lg:`).
  2. *(Opcional / Sob Demanda)* **Subagente de Validação Visual & QA:** Roda checagem de overflow (scripts CLI de viewport ou validação mobile via browser).
- **Explicitamente Dispensados:** Backend/Supabase e Big-O de banco/algoritmos (zero desperdício de tokens).

---

#### ⚡ Perfil B: Fullstack Padrão (Mudanças Completas)
*Aplicável para:* Novas funcionalidades completas (telas novas com novas tabelas, migrations, RLS, regras de negócio complexas, fluxos ponta a ponta).
- **Fase 1 (Construção Concorrente - 2 Subagentes):**
  1. **Subagente de Frontend & UI/UX:** Telas, formulários, hooks e responsividade mobile-first.
  2. **Subagente de Backend & Banco de Dados:** Migrations incrementais, RLS, RPCs, Edge Functions e integridade referencial.
- **Fase 2 (Refatoração & Hardening - 2 Subagentes):**
  3. **Subagente de Arquitetura, Modularização & Clean Code:** Quebra de componentes gigantes, tipagem TypeScript estrita e eliminação de gambiarras.
  4. **Subagente de Eficiência, Big-O & Segurança:** Otimização de complexidade de queries/loops, mitigação de vulnerabilidades e conformidade LGPD.

---

#### 🛡️ Perfil C: Backend, Segurança & Dados Exclusivo (Backend Only)
*Aplicável para:* Migrations, RPCs, Webhooks, integrações (WhatsApp, Asaas, Backblaze), Edge Functions, RLS, sanitização e segurança.
- **Subagentes Ativados:**
  1. **Subagente de Backend & Modelagem de Dados:** Banco de dados, RPCs e regras no Supabase.
  2. **Subagente de Eficiência, Big-O & Hardening de Segurança:** Queries SQL eficientes, proteção LGPD e integridade de transações.
- **Explicitamente Dispensados:** Subagente de Frontend e ferramentas visuais de browser.

## 9. Diretrizes de Alta Economia e Eficiência de Tokens

Para manter a janela de contexto limpa, rápida e evitar estouro de tokens em threads longas:
1. **Auditoria Headless e Checkers Determinísticos Locais (< 50 tokens):** Em vez de despejar logs gigantescos ou capturas de tela no contexto, use a suíte de verificação rápida:
   - `npm run check:quick`: Roda validação em cadeia de ESLint/tipagem, regras do Supabase e Mobile-First.
   - `npm run check:lint -- <arquivo>`: Filtra apenas erros bloqueantes de código.
   - `npm run check:supabase`: Audita prevenção de `PGRST203`, padrão monetário (`_cents`) e SSOT de migrations.
   - `npm run check:responsive -- <arquivo>`: Inspeciona classes de risco mobile e conformidade com `can(capability)`.
   - Se houver falha, o script aciona automaticamente o sintetizador local (`prompt-synthesizer.mjs` via Ollama `gemma4:cloud` ou OpenCode `mimo`) para devolver **apenas 1 parágrafo Markdown cirúrgico** com o que deve ser corrigido, economizando mais de 90% dos tokens do Gemini.
2. **Subagentes Estritamente Leves no Gemini 3.7 Flash Low:** Subagentes disparados via `invoke_subagent` devem utilizar **obrigatoriamente** `Model: "flash"` ou `Model: "flash_lite"`, garantindo custo mínimo de tokens e respostas ultra-rápidas. O uso de `pro` é expressamente proibido sem consentimento prévio do usuário.
3. **Leitura Cirúrgica com `view_file`:** Nunca leia arquivos grandes (mais de 200 linhas) inteiros de uma vez. Use `grep_search` prévio e restrinja `StartLine` e `EndLine` no `view_file` para blocos de 50 a 100 linhas.
4. **Isolamento e Resumos Curtos em Subagentes:** Os prompts de subagentes devem ser autocontidos (arquivos exatos, 3 a 5 requisitos pontuais e critérios de aceite claros). Ao terminar, o subagente deve responder apenas com um resumo conciso das linhas alteradas e status de testes, sem despejar o arquivo completo de volta no chat.
5. **Silenciamento de Logs e Testes Focados:** Execute testes do Vitest restritos ao arquivo sendo modificado (ex: `npx vitest run src/.../component.test.tsx`), evitando suítes completas de 2000 testes durante o desenvolvimento iterativo.
6. **Arquivamento Periódico de Concluídos:** Respeite a política de manter a coluna `## Finalizados` do Kanban enxuta (últimos 10 cards), garantindo leituras ultra-rápidas e com custo mínimo de tokens.
