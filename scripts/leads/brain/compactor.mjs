#!/usr/bin/env node
/**
 * Super-Conversor Brain — Compactador Inteligente em 3 Camadas (Zstd Nativo Node 24)
 *
 * Tier 0 (Hot  <= 7d):   Episódio ativo/recente no SQLite
 * Tier 1 (Warm <= 180d): Lições estruturadas + transcrição comprimida Zstd nível 9 (`transcript_blobs`)
 * Tier 2 (Cold > 180d ou > MAX_BRAIN_MB): Rollup preservado em priors/stats + arquivo mensal `.jsonl.zst` + vacuum
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DEFAULT_BRAIN_DB_PATH, getBrainConfig } from './schema.mjs';

export function compressTranscriptBlob(transcriptObj) {
  const jsonStr = typeof transcriptObj === 'string' ? transcriptObj : JSON.stringify(transcriptObj);
  const rawBuf = Buffer.from(jsonStr, 'utf8');

  if (typeof zlib.zstdCompressSync === 'function') {
    const levelConst = zlib.constants?.ZSTD_c_compressionLevel;
    const opts = levelConst ? { params: { [levelConst]: 9 } } : undefined;
    const payload = zlib.zstdCompressSync(rawBuf, opts);
    return {
      encoding: 'zstd',
      rawBytes: rawBuf.length,
      compressedBytes: payload.length,
      payload,
    };
  }

  const payload = zlib.brotliCompressSync(rawBuf);
  return {
    encoding: 'brotli',
    rawBytes: rawBuf.length,
    compressedBytes: payload.length,
    payload,
  };
}

export function decompressTranscriptBlob(payloadBuf, encoding = 'zstd') {
  const buf = Buffer.isBuffer(payloadBuf) ? payloadBuf : Buffer.from(payloadBuf);
  const rawBuf =
    encoding === 'brotli' ? zlib.brotliDecompressSync(buf) : zlib.zstdDecompressSync(buf);
  const text = rawBuf.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function storeTranscriptForEpisode(db, episodeId, transcriptObj, { markTier = 0 } = {}) {
  const compressed = compressTranscriptBlob(transcriptObj);
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO transcript_blobs (episode_id, encoding, raw_bytes, compressed_bytes, payload, archived_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(episode_id) DO UPDATE SET
      encoding = excluded.encoding,
      raw_bytes = excluded.raw_bytes,
      compressed_bytes = excluded.compressed_bytes,
      payload = excluded.payload,
      archived_at = excluded.archived_at
  `).run(
    String(episodeId),
    compressed.encoding,
    compressed.rawBytes,
    compressed.compressedBytes,
    compressed.payload,
    nowIso
  );

  if (markTier > 0) {
    db.prepare('UPDATE conversation_episodes SET compaction_tier = ? WHERE id = ?').run(
      markTier,
      String(episodeId)
    );
  }

  return compressed;
}

function appendMonthlyJsonlZstArchive(archivesDir, monthKey, records) {
  if (!records || records.length === 0) return null;
  if (!fs.existsSync(archivesDir)) fs.mkdirSync(archivesDir, { recursive: true });
  const archivePath = path.join(archivesDir, `${monthKey}.jsonl.zst`);

  let existingLines = '';
  if (fs.existsSync(archivePath)) {
    try {
      const compressed = fs.readFileSync(archivePath);
      const plain =
        typeof zlib.zstdDecompressSync === 'function'
          ? zlib.zstdDecompressSync(compressed)
          : zlib.brotliDecompressSync(compressed);
      existingLines = plain.toString('utf8');
      if (existingLines && !existingLines.endsWith('\n')) existingLines += '\n';
    } catch {
      existingLines = '';
    }
  }

  const newLines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const combined = Buffer.from(existingLines + newLines, 'utf8');
  const levelConst = zlib.constants?.ZSTD_c_compressionLevel;
  const outBuf =
    typeof zlib.zstdCompressSync === 'function'
      ? zlib.zstdCompressSync(combined, levelConst ? { params: { [levelConst]: 9 } } : undefined)
      : zlib.brotliCompressSync(combined);
  fs.writeFileSync(archivePath, outBuf);
  return archivePath;
}

export function getBrainStorageStats(db, dbPath = DEFAULT_BRAIN_DB_PATH) {
  const blobStats = db
    .prepare(
      'SELECT COUNT(*) AS blobs, COALESCE(SUM(raw_bytes), 0) AS raw_b, COALESCE(SUM(compressed_bytes), 0) AS comp_b FROM transcript_blobs'
    )
    .get();
  const tierRows = db
    .prepare('SELECT compaction_tier, COUNT(*) AS cnt FROM conversation_episodes GROUP BY compaction_tier')
    .all();

  const tierMap = { 0: 0, 1: 0, 2: 0 };
  for (const r of tierRows) tierMap[Number(r.compaction_tier || 0)] = Number(r.cnt || 0);

  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(dbPath)) dbSizeBytes = fs.statSync(dbPath).size;
  } catch {
    dbSizeBytes = 0;
  }

  const rawBytes = Number(blobStats?.raw_b || 0);
  const compressedBytes = Number(blobStats?.comp_b || 0);
  const ratio = rawBytes > 0 ? Number((((rawBytes - compressedBytes) / rawBytes) * 100).toFixed(1)) : 0;

  return {
    dbPath,
    dbSizeBytes,
    blobCount: Number(blobStats?.blobs || 0),
    rawTranscriptBytes: rawBytes,
    compressedTranscriptBytes: compressedBytes,
    compressionRatioPct: ratio,
    tier0Count: tierMap[0] || 0,
    tier1Count: tierMap[1] || 0,
    tier2Count: tierMap[2] || 0,
  };
}

export function runSmartCompaction(
  db,
  {
    dbPath = DEFAULT_BRAIN_DB_PATH,
    hotDays = 7,
    warmDays = 180,
    maxBrainMb,
    archivesDir,
    forceNowMs = Date.now(),
  } = {}
) {
  const configuredCapMb = Number(maxBrainMb ?? getBrainConfig(db, 'max_brain_mb', '250'));
  const capBytes = Math.max(1024 * 1024, (Number.isFinite(configuredCapMb) ? configuredCapMb : 250) * 1024 * 1024);
  const hotCutoffIso = new Date(forceNowMs - hotDays * 86_400_000).toISOString();
  const warmCutoffIso = new Date(forceNowMs - warmDays * 86_400_000).toISOString();
  const resolvedArchivesDir =
    archivesDir || path.join(path.dirname(dbPath || DEFAULT_BRAIN_DB_PATH), 'archives');

  // Tier 0 -> Tier 1 (conversas fechadas ou com > hotDays)
  const tier0Candidates = db
    .prepare(
      `SELECT id FROM conversation_episodes
        WHERE compaction_tier = 0
          AND (evaluated_at < ? OR outcome IN ('won', 'converted_trial', 'opt_out', 'discarded'))`
    )
    .all(hotCutoffIso);

  let tier1Promoted = 0;
  if (tier0Candidates.length > 0) {
    const updTier1 = db.prepare('UPDATE conversation_episodes SET compaction_tier = 1 WHERE id = ?');
    for (const row of tier0Candidates) {
      updTier1.run(String(row.id));
      tier1Promoted++;
    }
  }

  // Tier 1 -> Tier 2 (idade > warmDays ou DB acima de capBytes)
  const overBudget = fs.existsSync(dbPath) && fs.statSync(dbPath).size > capBytes;
  const tier1Candidates = overBudget
    ? db
        .prepare(
          `SELECT e.*, b.encoding, b.payload
             FROM conversation_episodes e
             LEFT JOIN transcript_blobs b ON b.episode_id = e.id
            WHERE e.compaction_tier = 1
            ORDER BY e.evaluated_at ASC
            LIMIT 250`
        )
        .all()
    : db
        .prepare(
          `SELECT e.*, b.encoding, b.payload
             FROM conversation_episodes e
             LEFT JOIN transcript_blobs b ON b.episode_id = e.id
            WHERE e.compaction_tier = 1 AND e.evaluated_at < ?
            ORDER BY e.evaluated_at ASC`
        )
        .all(warmCutoffIso);

  let tier2ArchivedCount = 0;
  const byMonth = new Map();
  const archivedIds = [];

  for (const row of tier1Candidates) {
    const monthKey = String(row.evaluated_at || new Date(forceNowMs).toISOString()).slice(0, 7);
    let transcript = null;
    if (row.payload) {
      try {
        transcript = decompressTranscriptBlob(row.payload, String(row.encoding || 'zstd'));
      } catch {
        transcript = null;
      }
    }
    const record = {
      id: row.id,
      conversation_id: row.conversation_id,
      icp_tier: row.icp_tier,
      pain_category: row.pain_category,
      strategy_id: row.strategy_id,
      outcome: row.outcome,
      funnel_reward: row.funnel_reward,
      llm_score: row.llm_score,
      strong_points: JSON.parse(String(row.strong_points_json || '[]')),
      weak_points: JSON.parse(String(row.weak_points_json || '[]')),
      objections: JSON.parse(String(row.objections_json || '[]')),
      lesson: row.lesson,
      evaluated_at: row.evaluated_at,
      transcript,
    };
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(record);
    archivedIds.push(String(row.id));
  }

  for (const [monthKey, records] of byMonth.entries()) {
    appendMonthlyJsonlZstArchive(resolvedArchivesDir, monthKey, records);
  }

  if (archivedIds.length > 0) {
    const delBlob = db.prepare('DELETE FROM transcript_blobs WHERE episode_id = ?');
    const markTier2 = db.prepare('UPDATE conversation_episodes SET compaction_tier = 2 WHERE id = ?');
    for (const id of archivedIds) {
      delBlob.run(id);
      markTier2.run(id);
      tier2ArchivedCount++;
    }
  }

  db.exec('PRAGMA incremental_vacuum; PRAGMA optimize;');
  const stats = getBrainStorageStats(db, dbPath);

  return {
    ...stats,
    tier1Promoted,
    tier2ArchivedCount,
    archivesDir: resolvedArchivesDir,
  };
}
