#!/usr/bin/env python3
"""
Dynamic Signal Hunter (Python 3 stdlib — Zero External Dependencies)

Varre sinais públicos em ordem de prioridade configurável pelos agentes:
  1. linkedin -> 2. facebook -> 3. x -> 4. instagram -> 5. tiktok -> 6. google_maps

Uso pelos agentes (parâmetros dinâmicos):
  python3 scripts/leads/python/dynamic_signal_hunter.py \
    --platforms=linkedin,facebook,x,instagram,tiktok,google_maps \
    --queries="fisioterapeuta prontuário planilha,sistema fisioterapia indicação" \
    --limit=15 \
    --out=.local-data/conversion-brain/python-signals.json
"""

import argparse
import html
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone

PRIORITY_PLATFORMS = ["linkedin", "facebook", "x", "instagram", "tiktok", "google_maps"]

PLATFORM_SITE_FILTERS = {
    "linkedin": "(site:linkedin.com/posts OR site:linkedin.com/in)",
    "facebook": "(site:facebook.com/groups OR site:facebook.com)",
    "x": "(site:x.com OR site:twitter.com)",
    "instagram": "site:instagram.com",
    "tiktok": "site:tiktok.com",
    "google_maps": "(site:google.com/maps OR \"fisioterapia\" \"whatsapp\")",
}

DEFAULT_QUERIES = [
    '"fisioterapeuta" ("prontuário" OR "planilha" OR "papel") ("sistema" OR "indicação")',
    '"clínica de fisioterapia" ("abrindo" OR "inaugurando" OR "faltas" OR "agenda")',
    '"fisioterapia domiciliar" ("CREFITO" OR "atendimento" OR "whatsapp")',
]

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def extract_phone(text: str):
    m = re.search(r"(?:\+?55[\s-]*)?(?:\(?\d{2}\)?[\s-]*)(?:9\d{4}|\d{4})[-\s.]?\d{4}\b", text or "")
    if not m:
        return None
    digits = re.sub(r"\D", "", m.group(0))
    if len(digits) in (10, 11):
        return f"55{digits}"
    return digits if len(digits) >= 12 else None


def extract_instagram(text: str, url: str = ""):
    if "instagram.com/" in (url or ""):
        m = re.search(r"instagram\.com/([a-zA-Z0-9._]{3,30})", url)
        if m and m.group(1) not in ("p", "reel", "explore", "stories"):
            return f"@{m.group(1)}"
    m2 = re.search(r"(?:^|[\s,(])@([a-zA-Z0-9._]{3,30})", text or "")
    return f"@{m2.group(1).rstrip('.')}" if m2 else None


def fetch_ddg_html(query: str, timeout: int = 12):
    encoded = urllib.parse.urlencode({"q": query, "kl": "br-pt"})
    req = urllib.request.Request(
        f"https://html.duckduckgo.com/html/?{encoded}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    results = []
    blocks = re.findall(
        r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>[\s\S]*?'
        r'<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)</a>',
        raw,
    )
    for href, title_html, snip_html in blocks:
        clean_url = urllib.parse.unquote(href)
        if "uddg=" in clean_url:
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(clean_url).query)
            clean_url = qs.get("uddg", [clean_url])[0]
        title = re.sub(r"<[^>]+>", "", html.unescape(title_html)).strip()
        snippet = re.sub(r"<[^>]+>", "", html.unescape(snip_html)).strip()
        if clean_url.startswith("http") and (title or snippet):
            results.append({"title": title, "url": clean_url, "snippet": snippet})
    return results


def infer_name_from_title(title: str, platform: str):
    cleaned = re.split(r"\s*[|\-–•:]\s*", title or "")[0].strip()
    cleaned = re.sub(r"\s*\(@[^)]+\)\s*", "", cleaned).strip()
    if len(cleaned) >= 3:
        return cleaned[:80]
    return f"Profissional ({platform})"


def map_source_platform(platform: str):
    if platform == "google_maps":
        return "google_maps"
    if platform == "instagram":
        return "instagram"
    return "web_signal"


def resolve_apify_token():
    token = os.environ.get("APIFY_API_TOKEN", "").strip()
    if token:
        return token
    env_path = os.path.join(os.getcwd(), "infra", "marketing-node", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                s = line.strip()
                if s.startswith("APIFY_API_TOKEN="):
                    val = s.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val
    try:
        proc = subprocess.run(
            ["pulumi", "env", "open", "joao-tdoval-gmail-com-org/plurihealth/pluri-prod", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=8,
        )
        if proc.returncode == 0 and proc.stdout:
            data = json.loads(proc.stdout)
            ev = data.get("environmentVariables") or data
            return str(ev.get("APIFY_API_TOKEN") or "").strip()
    except Exception:
        pass
    return ""


def fetch_apify_google_search(query: str, max_results: int = 10):
    token = resolve_apify_token()
    if not token:
        return []
    payload = json.dumps({
        "queries": query,
        "resultsPerPage": min(20, max(5, max_results)),
        "maxPagesPerQuery": 1,
        "countryCode": "br",
        "languageCode": "pt",
    }).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.apify.com/v2/acts/apify~google-search-scraper/runs?waitForFinish=45&token={urllib.parse.quote(token)}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=55) as resp:
            run_data = json.loads(resp.read().decode("utf-8", errors="ignore"))
        ds_id = (run_data.get("data") or {}).get("defaultDatasetId")
        if not ds_id:
            return []
        ds_req = urllib.request.Request(
            f"https://api.apify.com/v2/datasets/{ds_id}/items?token={urllib.parse.quote(token)}&limit=10"
        )
        with urllib.request.urlopen(ds_req, timeout=20) as ds_resp:
            pages = json.loads(ds_resp.read().decode("utf-8", errors="ignore"))
        results = []
        for page in pages if isinstance(pages, list) else []:
            for org in page.get("organicResults") or []:
                url = org.get("url") or ""
                if url.startswith("http"):
                    results.append({
                        "title": org.get("title") or "",
                        "url": url,
                        "snippet": org.get("description") or "",
                    })
        return results
    except Exception:
        return []


def run_hunter(platforms, queries, limit):
    collected = []
    seen_urls = set()
    now_iso = datetime.now(timezone.utc).isoformat()

    for platform in platforms:
        if len(collected) >= limit:
            break
        site_filter = PLATFORM_SITE_FILTERS.get(platform, "")
        for base_q in queries:
            if len(collected) >= limit:
                break
            full_q = f"{site_filter} {base_q}".strip()
            hits = fetch_ddg_html(full_q)
            if not hits:
                hits = fetch_apify_google_search(full_q, max_results=limit - len(collected))
            for h in hits:
                if len(collected) >= limit:
                    break
                url = h["url"]
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                combined = f"{h['title']} — {h['snippet']}"
                collected.append(
                    {
                        "full_name": infer_name_from_title(h["title"], platform),
                        "source_url": url,
                        "published_at": now_iso,
                        "source_platform": map_source_platform(platform),
                        "pain_excerpt": combined[:500],
                        "phone": extract_phone(combined),
                        "instagram_handle": extract_instagram(combined, url),
                        "discovery_channel": platform,
                    }
                )
    return collected


def main():
    parser = argparse.ArgumentParser(description="Dynamic Python Signal Hunter for Pluri Fisio")
    parser.add_argument(
        "--platforms",
        default=",".join(PRIORITY_PLATFORMS),
        help="Ordem de plataformas (ex: linkedin,facebook,x,instagram,tiktok,google_maps)",
    )
    parser.add_argument(
        "--queries",
        default="",
        help="Queries separadas por vírgula ou ponto-e-vírgula",
    )
    parser.add_argument("--limit", type=int, default=15, help="Máximo de sinais coletados")
    parser.add_argument(
        "--out",
        default=".local-data/conversion-brain/python-signals.json",
        help="Arquivo JSON de saída",
    )
    args = parser.parse_args()

    platforms = [p.strip().lower() for p in args.platforms.split(",") if p.strip()]
    queries = (
        [q.strip() for q in re.split(r"[;|]", args.queries) if q.strip()]
        if args.queries.strip()
        else DEFAULT_QUERIES
    )

    items = run_hunter(platforms, queries, max(1, args.limit))
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    by_plat = {}
    for it in items:
        ch = it.get("discovery_channel", "other")
        by_plat[ch] = by_plat.get(ch, 0) + 1

    print(f"🐍 [PYTHON_HUNTER] Coletados {len(items)} sinais em {args.out} | Por canal: {json.dumps(by_plat)}")


if __name__ == "__main__":
    main()
