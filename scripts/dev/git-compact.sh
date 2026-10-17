#!/usr/bin/env bash
# Git Helpers Compactos - Status e Diff ultracompactos com suporte a resumo por IA Local
set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "📌 [GIT STATUS -S]"
STATUS_OUT=$(git status -s)
if [ -z "$STATUS_OUT" ]; then
  echo "✨ Diretório de trabalho limpo."
else
  echo "$STATUS_OUT"
fi

echo ""
echo "📊 [GIT DIFF --STAT]"
DIFF_STAT=$(git diff HEAD --stat 2>/dev/null || git diff --stat)
if [ -z "$DIFF_STAT" ]; then
  echo "✨ Nenhuma alteração em arquivos rastreados."
else
  echo "$DIFF_STAT"
fi

# Verifica se foi solicitada explicação (--diff ou --explain)
EXPLAIN=false
for arg in "$@"; do
  if [ "$arg" = "--diff" ] || [ "$arg" = "--explain" ]; then
    EXPLAIN=true
    break
  fi
done

if [ "$EXPLAIN" = true ]; then
  echo ""
  echo "🤖 [AI DIFF SÍNTESE]"
  (git diff HEAD 2>/dev/null || git diff) | node scripts/dev/ai-local-engine.mjs diff
fi
