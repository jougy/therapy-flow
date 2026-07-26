# Therapy-Flow (Pluri-Health) - Regras de Memória e Operação

## 1. Memória Externa e Contexto Inicial (A Vault)
Este projeto utiliza uma Vault do Obsidian local como extensão exclusiva de memória viva para evitar sobrecarga de contexto e garantir alinhamento arquitetural contínuo. 

**Ao iniciar uma nova conversa ou quando estiver sem contexto claro sobre a arquitetura do projeto:**
- **NÃO** tente adivinhar estruturas do zero.
- Use a ferramenta `view_file` para ler os seguintes hubs iniciais localizados em `/home/jougy/Documents/programacao/Prontuario/therapy-flow/core/Pluri-Health`:
  1. `00 - Navegacao/Codex Brain.md` (Ponto de partida central de regras)
  2. `90 - Meta/Guia operacional da vault Pluri-Health.md` (Regras operacionais)
  3. `00 - Navegacao/Mapa da vault.md` (Mapeamento dos demais tópicos)
- Use a ferramenta `grep_search` ou navegue pela Vault (`list_dir`) de forma inteligente (notas pequenas) em vez de lotar a memória com arquivos grandes de uma só vez.

## 2. Documentação Viva
- Quando houver uma nova decisão técnica, mudança de fluxos, ou nova tabela de banco de dados, **você deve atualizar as anotações na Vault** usando `write_to_file` ou `multi_replace_file_content`, mantendo a documentação 100% atualizada. Mantenha as notas curtas e referencie-as no hub adequado usando links do Obsidian `[[Nome da Nota]]`.

## 3. Fluxos, UI e UX (Browser Subagent)
- Sempre que houver edição em formulários, modais, UI, dashboard ou fluxos de paciente/clínica, você **deve** instanciar o `browser_subagent` nativo do Antigravity para simular interações e garantir a responsividade e o comportamento correto.
- Substitua a necessidade antiga do "Brave CDP" pelas ferramentas de navegador do Antigravity.
- O Antigravity já grava as sessões do browser nativamente em WebP; referencie as gravações do browser e evite deixar prints de lixo soltos no repositório.

## 4. Banco de Dados, Segurança e Supabase
- **Absolutamente Proibido:** O comando `supabase db reset` não pode ser executado sem autorização explícita do usuário para não destruir dados de desenvolvimento locais.
- Mudanças no banco devem ser feitas através de **migrations incrementais** e scripts não destrutivos.
- Antes de alterar permissões, logins, Row Level Security (RLS) ou sessões, consulte o `Plano de seguranca - hub` na Vault.

## 5. Legenda Visual de Mapeamento
Quando o usuário mandar capturas de tela (screenshots) ou vídeos editados, siga as instruções de cor estritas:
- **Verde**: Algo correto, não deve ser tocado.
- **Amarelo**: Conteúdo, dado ou texto que deve ser alterado.
- **Vermelho**: Remover item, ou margem a ser evitada.
- **Roxo**: Movimentar, alinhar, redimensionar ou problemas de responsividade.
- **Azul**: Conteúdo a ser transformado em popup, modal ou expansível.
- **Rosa**: Lógica interativa, tornar a área clicável ou engatilhar evento Javascript.
