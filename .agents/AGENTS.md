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

## 5. Legenda Visual de Mapeamento
Quando o usuário mandar capturas de tela (screenshots) ou vídeos editados, siga as instruções de cor estritas:
- **Verde**: Algo correto, não deve ser tocado.
- **Amarelo**: Conteúdo, dado ou texto que deve ser alterado.
- **Vermelho**: Remover item, ou margem a ser evitada.
- **Roxo**: Movimentar, alinhar, redimensionar ou problemas de responsividade.
- **Azul**: Conteúdo a ser transformado em popup, modal ou expansível.
- **Rosa**: Lógica interativa, tornar a área clicável ou engatilhar evento Javascript.

## 6. Verificação Obrigatória de Scroll Mobile
Sempre que criar ou modificar qualquer componente visual, tela, formulário, modal ou layout:
- **Revisão de CSS/Layout:** Certifique-se de que contêineres filhos usam `overflow-y-auto` corretamente e que contêineres pai não bloqueiam a rolagem com `overflow: hidden` indevido ou alturas fixas (`h-screen` vs `min-h-screen` / `dvh`). Modais e drawers de navegação em mobile **devem** ter rolagem vertical funcional quando o conteúdo ultrapassar a tela.
- **Validação com `browser_subagent`:** Testar obrigatoriamente a interface simulando tela mobile (larguras pequenas como 375px–390px) e realizando o scroll até o final do fluxo antes de declarar a tarefa concluída.

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

## 8. Arquitetura de Conversação e Execução em Subagentes (Orquestrador & 4 Subagentes)

### 8.1. Papel do Agente Principal no Chat: Planejador Estratégico e Arquiteto
- **Postura:** O agente principal conversando diretamente com o usuário atua estritamente como **Planejador Estratégico, Arquiteto e Tech Lead**.
- **Não codificar de imediato:** Não saia alterando código apressadamente. Discuta as ideias, aprofunde o problema, analise os impactos arquiteturais e **faça todas as perguntas necessárias ao usuário** para esclarecer decisões, ambiguidades, regras de negócio e preferências de design antes de qualquer execução.
- **Desenho do Plano:** Elabore o plano detalhado de implementação, registre a tarefa no Kanban e obtenha a validação/alinhamento com o usuário.

### 8.2. Execução da Tarefa — Fase 1: Construção Concorrente (2 Subagentes)
Na etapa de execução do plano, o orquestrador deve instanciar simultaneamente **2 threads de subagentes especializados**:
1. **Subagente de Frontend & UI/UX:**
   - Responsável pela estrutura lógica de tela, componentes visuais, interações, formulários, rotas, formulários dinâmicos e gerenciamento de estado do client.
   - Aplica rigorosamente mobile-first, prevenção de quebras visuais e validações com `browser_subagent`.
2. **Subagente de Backend & Banco de Dados:**
   - Responsável pela modelagem do Supabase/Postgres, migrations incrementais seguras (sem reset destrutivo), regras de Row Level Security (RLS), RPCs, Edge Functions e integridade referencial.

### 8.3. Execução da Tarefa — Fase 2: Sanitização, Refatoração e Hardening (2 Subagentes)
Obrigatória e disparada **imediatamente após a conclusão bem-sucedida dos dois subagentes da Fase 1**. O orquestrador aciona mais **2 subagentes especializados**:
3. **Subagente de Arquitetura, Modularização & Clean Code:**
   - Quebra de monolitos gigantes em submódulos e componentes menores, reutilizáveis e coesos.
   - Elimina qualquer trecho mal feito, precário, improvisado, gambiarras temporárias ou que aparente estar inacabado.
   - Garante conformidade com convenções do projeto, tipagem TypeScript estrita e legibilidade.
4. **Subagente de Eficiência, Big-O & Segurança:**
   - Análise de performance algorítmica: otimização de complexidade de tempo/espaço (Big-O), redução de loops aninhados desnecessários, re-renderizações excessivas e gargalos de memória.
   - Otimização de queries SQL e chamadas assíncronas.
   - Blindagem de segurança: sanitização rigorosa de inputs, proteção contra vazamentos de dados de pacientes/clínicas (LGPD), validação de permissões e mitigação de vulnerabilidades.



