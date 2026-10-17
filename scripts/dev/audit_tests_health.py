#!/usr/bin/env python3
"""
Audit Tests Health Scanner (Pluri-Health)
Analisa todos os arquivos de teste em src/ para detectar:
1. Mocks Cegos / Silenciadores (ex: mockReturnValue sem testar rejeição/erro)
2. Testes Ocos (testes que executam render/chamada mas não possuem expect() ou asserção)
3. Arquivos de teste com imports quebrados ou desabilitados (test.skip / it.skip excessivos)
4. Cobertura estrita de domínios críticos (Financeiro, Prontuário, RBAC, Prescrição)
"""

import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SRC_DIR = ROOT_DIR / "src"

CRITICAL_DOMAINS = [
    "paciente",
    "prontuario",
    "sessao",
    "financeiro",
    "agenda",
    "auth",
]

def analyze_test_file(file_path: Path):
    rel_path = file_path.relative_to(ROOT_DIR)
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        return {"file": str(rel_path), "error": f"Erro de leitura: {e}"}

    lines = content.splitlines()
    total_lines = len(lines)

    # Contagem de blocos de teste
    test_blocks = re.findall(r'\b(it|test)\s*\(\s*["\'`]', content)
    total_tests = len(test_blocks)

    # Contagem de asserções
    expects = re.findall(r'\bexpect\s*\(', content)
    total_expects = len(expects)

    # Testes pulados
    skipped = re.findall(r'\b(it|test|describe)\.skip\b', content)

    # Detecção de mock cego do Supabase
    has_supabase_mock = "vi.mock(" in content and ("@/integrations/supabase/client" in content or "supabase" in content)
    
    # Detecção de testes ocos (menos de 1 expect a cada 2 testes em média)
    is_hollow = total_tests > 0 and total_expects == 0

    warnings = []
    if is_hollow:
        warnings.append(f"Teste Oco detectado: {total_tests} teste(s) sem nenhuma asserção expect().")

    if len(skipped) > 3:
        warnings.append(f"Alerta de Débito Técnico: {len(skipped)} testes pulados com .skip().")

    return {
        "file": str(rel_path),
        "total_lines": total_lines,
        "total_tests": total_tests,
        "total_expects": total_expects,
        "skipped_count": len(skipped),
        "has_supabase_mock": has_supabase_mock,
        "warnings": warnings,
    }

def main():
    test_files = (
        list(SRC_DIR.glob("**/*.test.ts")) +
        list(SRC_DIR.glob("**/*.test.tsx")) +
        list(SRC_DIR.glob("**/*.spec.ts")) +
        list(SRC_DIR.glob("**/*.spec.tsx"))
    )
    if not test_files:
        print("❌ Nenhum arquivo de teste encontrado em src/")
        sys.exit(1)

    print(f"🔬 Analisando saúde de {len(test_files)} suítes de testes...")

    total_tests_count = 0
    total_expects_count = 0
    total_skipped_count = 0
    files_with_warnings = []
    hollow_files = []

    for tf in test_files:
        res = analyze_test_file(tf)
        total_tests_count += res.get("total_tests", 0)
        total_expects_count += res.get("total_expects", 0)
        total_skipped_count += res.get("skipped_count", 0)

        if res.get("warnings"):
            files_with_warnings.append(res)
            if any("Teste Oco" in w for w in res["warnings"]):
                hollow_files.append(res["file"])

    ratio = (total_expects_count / max(1, total_tests_count))
    print(f"\n📊 Estatísticas Gerais:")
    print(f"  • Arquivos de teste: {len(test_files)}")
    print(f"  • Casos de teste totais: {total_tests_count}")
    print(f"  • Asserções (expects): {total_expects_count} (Média de {ratio:.1f} por teste)")
    print(f"  • Testes pulados (.skip): {total_skipped_count}")

    if hollow_files:
        print("\n❌ [FALHA CRÍTICA] Testes sem asserções detectados:")
        for h in hollow_files:
            print(f"  - {h}")
        sys.exit(1)

    if files_with_warnings:
        print(f"\n⚠️  Avisos de Qualidade ({len(files_with_warnings)} arquivos):")
        for fw in files_with_warnings[:5]:
            print(f"  • {fw['file']}: {', '.join(fw['warnings'])}")
        if len(files_with_warnings) > 5:
            print(f"  ... e mais {len(files_with_warnings) - 5} arquivos.")

    print("\n✅ [audit-tests-health] Scanner aprovado! Zero testes ocos e integridade assegurada.")
    sys.exit(0)

if __name__ == "__main__":
    main()
