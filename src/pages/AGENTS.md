# Regras Frontend (`src/pages/`)
- **Mobile-First + Widescreen:** nasce em `375px`/`390px` e expande até `1440px+` (`max-w-* mx-auto`). Zero overflow horizontal (`w-full max-w-full min-w-0 overflow-x-hidden`), tabelas com `overflow-x-auto touch-pan-x`, alturas dinâmicas `100dvh`/`max-h-[88dvh]`, touch targets ≥ 44x44px.
- **RBAC:** proibido hardcode de papéis (`operationalRole === 'admin'`); use exclusivamente `can(capability)` e `effectiveRoleKey = membership.role_key || membership.operational_role`.
- **Anti-Monolito:** arquivos > 500 linhas devem ser modularizados em subpastas com barrel leve.
