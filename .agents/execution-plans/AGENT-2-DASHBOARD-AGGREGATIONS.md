# Plano de Execução - Agente 2: Agregações de Dashboard, Backend e Economia de Banco de Dados

> **Identificador do Agente**: `AGENT-2-DASHBOARD-AGGREGATIONS`  
> **Objetivo**: Eliminar o gargalo de memória de carregar dezenas de milhares de sessões brutas no navegador, criando RPCs agregadoras no PostgreSQL / Supabase para o `ClinicDashboard` e otimizando queries analíticas com cache TanStack Query.

---

## 1. Contexto e Diagnóstico

Durante a auditoria da plataforma:
1. Em [`ClinicDashboard.tsx`](file:///Users/jougy/Documents/therapy-flow/src/pages/ClinicDashboard.tsx#L299), a aplicação faz um fetch completo de todas as sessões da clínica (`useClinicSessionsSummaryQuery`) e calcula indicadores no navegador através de loops `reduce()` e `filter()`.
2. Em clínicas com milhares de atendimentos históricos, isso causa:
   - Alto consumo de tráfego de rede (download de megabytes de JSON desnecessário).
   - Engasgos de renderização e Garbage Collection do JavaScript.
   - Custo excessivo de egress no Supabase.

---

## 2. Etapas de Execução Passo a Passo

### Etapa 2.1: Criação de Migration Incremental com RPC Agregadora
- **Diretório**: `supabase/migrations/`
- **Ação**:
  - Criar uma nova migration SQL incremental (NÃO executar comandos destrutivos).
  - Implementar uma função RPC PostgreSQL com `SECURITY DEFINER` e checagem de permissão RBAC (ex: `get_clinic_dashboard_analytics(_clinic_id uuid, _year int)`):
    - Agregação mensal de receita (valores pagos, em aberto, cortesia).
    - Contagem de atendimentos por status (concluído, cancelado, rascunho).
    - Distribuição por dia da semana (Dom a Sáb).
    - Top grupos/linhas de cuidado mais atendidos.
    - Indicadores dos últimos 30 dias.
    - Métricas consolidadas por colaborador.

### Etapa 2.2: Criação de Hook Dedicado com Cache TanStack Query
- **Arquivo**: `src/hooks/queries/useClinicDataQueries.ts`
- **Ação**:
  - Criar a query key `CLINIC_QUERY_KEYS.analytics(clinicId, year)`.
  - Criar a função `useClinicDashboardAnalyticsQuery(clinicId, year)` configurada com `staleTime: 5 * 60 * 1000` (5 minutos) e `gcTime: 24 * 60 * 60 * 1000`.

### Etapa 2.3: Refatoração de `ClinicDashboard.tsx`
- **Arquivo**: `src/pages/ClinicDashboard.tsx`
- **Ação**:
  - Substituir o cálculo pesado do `useMemo` iterativo pelo consumo direto do hook `useClinicDashboardAnalyticsQuery`.
  - Manter 100% dos gráficos Recharts (área de faturamento, barras de distribuição, linhas dos últimos 30 dias, cartões de KPIs e modal de impressão `ClinicStatsPrintModal`).
  - Adicionar estados de loading elegantes com skeleton cards.

### Etapa 2.4: Unificação com `HomeDashboardModal.tsx`
- **Arquivo**: `src/components/home/HomeDashboardModal.tsx`
- **Ação**:
  - Conectar o modal rápido da homepage ao mesmo hook agregador, eliminando qualquer lógica duplicada de cálculo manual.

---

## 3. Critérios de Conclusão (Definition of Done)
- [ ] Migration SQL incremental criada com testes de permissão e RLS.
- [ ] O `ClinicDashboard.tsx` não baixa mais arrays de sessões brutas para somar no cliente.
- [ ] Todos os gráficos e modais de impressão continuam funcionando perfeitamente.
- [ ] O tempo de carregamento da tela de estatísticas se mantém abaixo de 200ms mesmo simulando grandes bases.
