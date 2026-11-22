#!/usr/bin/env node
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const RUN_ONCE = process.argv.includes('--once');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }) + '\n');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function logEvent(data) {
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + '\n');
}

async function pollJobs() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_render_jobs?worker_tier=eq.heavy_pull&status=eq.queued&order=priority.desc,created_at.asc&limit=5`,
      { headers }
    );
    if (!res.ok) {
      logEvent({ level: 'error', status: res.status, message: 'Failed to fetch jobs' });
      return [];
    }
    return await res.json();
  } catch (err) {
    logEvent({ level: 'error', error: err.message, message: 'Network error fetching jobs' });
    return [];
  }
}

async function claimJob(jobId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_render_jobs?id=eq.${jobId}&status=eq.queued`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'claimed', updated_at: new Date().toISOString() }),
      }
    );
    if (!res.ok) return null;
    const updated = await res.json();
    return Array.isArray(updated) && updated.length > 0 ? updated[0] : null;
  } catch (err) {
    return null;
  }
}

async function updateJobStatus(jobId, status, result = {}, error = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/marketing_render_jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status,
        result_json: result,
        error_message: error,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logEvent({ level: 'error', jobId, error: err.message, message: 'Failed to update job status' });
  }
}

async function processJob(job) {
  logEvent({ level: 'info', jobId: job.id, message: 'Processing heavy_pull job' });
  const claimed = await claimJob(job.id);
  if (!claimed) {
    logEvent({ level: 'info', jobId: job.id, message: 'Job already claimed by another worker' });
    return;
  }

  try {
    const payload = job.payload_json || {};
    // Simulate heavy rendering task (e.g. video / satori / ollama analysis)
    const result = {
      success: true,
      processedAt: new Date().toISOString(),
      formatType: payload.format_type || 'reel_video',
      artifactUrl: 'https://storage.example.com/rendered-reel.mp4',
    };

    await updateJobStatus(job.id, 'completed', result);
    logEvent({ level: 'info', jobId: job.id, message: 'Job completed successfully' });
  } catch (err) {
    await updateJobStatus(job.id, 'failed', {}, err.message);
    logEvent({ level: 'error', jobId: job.id, error: err.message, message: 'Job failed during execution' });
  }
}

async function mainLoop() {
  logEvent({ level: 'info', message: 'Starting marketing-pull-worker (heavy_pull)' });
  while (true) {
    const jobs = await pollJobs();
    for (const job of jobs) {
      await processJob(job);
    }
    if (RUN_ONCE) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

mainLoop().catch((err) => {
  logEvent({ level: 'fatal', error: err.message });
  process.exit(1);
});
