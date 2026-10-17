#!/usr/bin/env bash
set -e

# ==============================================================================
# Pre-Deploy Guard - Portão de Blindagem da Qualidade (Pluri-Health)
# Executa todas as camadas de proteção antes de autorizar o deploy em produção.
# ==============================================================================

echo "🛡️  [Pre-Deploy Guard] Iniciando pipeline de blindagem pré-deploy..."
echo "----------------------------------------------------------------------"

# 1. Auditoria de Qualidade Rápida (ESLint, Tipos, Mobile-First, Supabase Rules, Anti-Monolitos)
echo "▶️  Etapa 1/4: Executando verificações de qualidade com zero tokens..."
npm run check:quick

# 2. Scanner de Saúde dos Testes em Python
echo "▶️  Etapa 2/5: Executando auditoria profunda de saúde dos testes em Python..."
python3 scripts/dev/audit_tests_health.py

# 3. Execução da Suíte Completa de Testes Automatizados (Vitest)
echo "▶️  Etapa 3/5: Executando suíte de testes unitários e de regressão (Vitest)..."
npm run test

# 4. Build de Produção
echo "▶️  Etapa 4/5: Compilando bundle de produção (Vite)..."
npm run build

# 5. Smoke Test Headless do Bundle Compilado
echo "▶️  Etapa 5/5: Executando Smoke Test Headless no bundle compilado..."
node scripts/dev/test_build_smoke.mjs

echo "----------------------------------------------------------------------"
echo "🚀 [Pre-Deploy Guard] Todas as verificações passaram com 100% de sucesso!"
echo "✨ Build validado e pronto para produção."
