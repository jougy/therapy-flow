# Plano de Execução - Agente 1: Roteamento, Limpeza de Débitos e Correções Críticas

> **Identificador do Agente**: `AGENT-1-ROUTING-CLEANUP`  
> **Objetivo**: Corrigir links quebrados, descontinuar o monólito legado de 6.232 linhas (`Configuracoes.tsx`), corrigir anotações `@ts-expect-error` e garantir 100% de integridade no roteamento e build TypeScript.

---

## 1. Contexto e Diagnóstico

Durante a auditoria da plataforma, foram identificados 3 débitos técnicos imediatos:
1. **Link quebrado em [`ClinicFormsSection.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/configuracoes/sections/ClinicFormsSection.tsx#L37)**: O botão "Abrir editor" aponta para `/clinica/${clinicKey}/formularios`, que não existe no roteador e cai em tela 404 (`NotFound`). A rota real registrada no [`App.tsx`](file:///Users/jougy/Documents/therapy-flow/src/App.tsx#L229) é `configuracoes/formularios/:templateId`.
2. **Monólito Legado de 6.232 linhas [`Configuracoes.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/Configuracoes.tsx)**: A rota raiz `/configuracoes` ainda carrega esse arquivo massivo em vez de usar a arquitetura modularizada já existente em [`src/pages/configuracoes/`](file:///Users/jougy/Documents/therapy-flow/src/pages/configuracoes/).
3. **Tipagem e `@ts-expect-error` em [`OnboardingClinica.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/OnboardingClinica.tsx)**: Há supressões de tipos TypeScript no hook `useAuth` e validações imperativas.

---

## 2. Etapas de Execução Passo a Passo

### Etapa 1.1: Correção do Link no `ClinicFormsSection.tsx`
- **Arquivo**: `src/pages/configuracoes/sections/ClinicFormsSection.tsx`
- **Ação**:
  - Ajustar o destino do botão `<Button asChild>` para redirecionar para a rota correta de criação ou lista de modelos de formulário: `/clinica/${clinicKey}/configuracoes/formularios/novo` ou ajustar a rota de listagem de formulários no `App.tsx` para coincidir com o fluxo da clínica.
  - Certificar-se de que o botão leva ao `FormularioEditor` com o parâmetro `:templateId` adequado (`"novo"` para nova ficha ou `:id` para edição).

### Etapa 1.2: Descontinuação do Monólito `Configuracoes.tsx` e Padronização de Rota
- **Arquivos**: `src/App.tsx`, `src/pages/Configuracoes.tsx`, `src/pages/configuracoes/index.tsx`
- **Ação**:
  - No `App.tsx`, alterar a rota `/configuracoes` para usar `<SettingsLayout />` com `<ConfiguracoesLegacyRedirect />` em vez do arquivo `Configuracoes.tsx` legado.
  - Limpar ou arquivar o arquivo `src/pages/Configuracoes.tsx` de 6.232 linhas, eliminando o overhead de bundle e a duplicação de código.
  - Garantir que todos os links internos que utilizam query params antigos (ex: `?secao=team`, `?secao=security`) sejam interceptados pelo `ConfiguracoesLegacyRedirect` e direcionados às sub-rotas modernas (`/equipe`, `/seguranca`, etc.).

### Etapa 1.3: Correção de Tipagens em `OnboardingClinica.tsx`
- **Arquivo**: `src/pages/OnboardingClinica.tsx`
- **Ação**:
  - Inspecionar os tipos retornados por `useAuth` (`src/hooks/useAuth.tsx`).
  - Corrigir a interface para que `OnboardingClinica.tsx` acesse `user`, `clinic`, `session` e métodos de autenticação de forma 100% tipada, sem necessidade de `@ts-expect-error` ou `@ts-ignore`.

### Etapa 1.4: Validação de Build e Roteamento
- **Comandos**:
  ```bash
  npm run build
  ```
- **Verificação**:
  - Garantir que o build do Vite compile com 0 erros de TypeScript e que os chunks de configurações fiquem leves e distribuídos por lazy loading.

---

## 3. Critérios de Conclusão (Definition of Done)
- [ ] Nenhum link no menu de configurações leva a erro 404.
- [ ] O arquivo `Configuracoes.tsx` legado foi removido/descontinuado do bundle.
- [ ] Zero `@ts-expect-error` em `OnboardingClinica.tsx`.
- [ ] `npm run build` executado com sucesso e zero erros de compilação.
