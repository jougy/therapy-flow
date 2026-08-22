import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ENV_PATH = process.env.THERAPY_FLOW_ADMIN_PROD_ENV || path.join(process.env.HOME, '.therapy-flow-admin-prod/supabase.env');

if (!fs.existsSync(ENV_PATH)) {
  console.error(`Arquivo de credenciais de produção não encontrado em: ${ENV_PATH}`);
  process.exit(1);
}

const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados em', ENV_PATH);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ALL_TABLES = [
  'agenda_events',
  'anamnesis_form_templates',
  'app_notifications',
  'asaas_webhook_events',
  'clinic_collaborator_invitations',
  'clinic_group_color_slots',
  'clinic_memberships',
  'clinic_operational_role_capabilities',
  'clinic_operational_roles',
  'clinic_subscriptions',
  'clinic_tag_relations',
  'clinic_tags',
  'clinics',
  'community_form_template_comments',
  'community_form_template_likes',
  'community_form_templates',
  'feature_flags',
  'governance_rules',
  'notification_preferences',
  'patient_clinical_snapshots',
  'patient_file_uploads',
  'patient_group_templates',
  'patient_groups',
  'patient_payment_plans',
  'patient_registration_links',
  'patients',
  'platform_admins',
  'platform_audit_events',
  'platform_clinic_access_sessions',
  'platform_feedbacks',
  'platform_release_note_items',
  'platform_releases',
  'profiles',
  'security_events',
  'session_edit_history',
  'session_shares',
  'sessions',
  'subscription_coupons',
  'subscription_invoices',
  'team_development_profiles',
  'telemetry_events',
  'user_active_clinic_contexts',
  'user_governance_overrides',
  'user_punishments',
  'user_release_note_states',
  'user_roles',
  'user_security_sessions',
  'user_security_settings',
  'user_telemetry_summaries'
];

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSqlInserts(tableName, rows) {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const quotedCols = cols.map(c => `"${c}"`).join(', ');
  
  const chunks = [];
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valueLines = chunk.map(r => {
      const values = cols.map(c => escapeSqlValue(r[c])).join(', ');
      return `  (${values})`;
    }).join(',\n');
    chunks.push(`INSERT INTO public."${tableName}" (${quotedCols})\nVALUES\n${valueLines}\nON CONFLICT DO NOTHING;\n`);
  }
  return chunks.join('\n');
}

async function fetchTableData(tableName) {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to);

    if (error) {
      return { tableName, error: error.message, rows: [] };
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }

  return { tableName, rows: allRows, error: null };
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', 'supabase', `prod-ggytwbnintrftgzvjczs-${timestamp}`);
  const tablesDir = path.join(backupDir, 'tables');

  fs.mkdirSync(tablesDir, { recursive: true });

  console.log('====================================================');
  console.log('🚀 INICIANDO BACKUP COMPLETO DO SUPABASE DE PRODUÇÃO');
  console.log('====================================================');
  console.log(`Destino: ${backupDir}`);
  console.log(`URL do Supabase: ${SUPABASE_URL}\n`);

  let gitBranch = 'unknown';
  let gitCommit = 'unknown';
  try {
    gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (_) {}

  const manifest = [
    `created_at_utc=${new Date().toISOString()}`,
    `target=prod`,
    `project_ref=ggytwbnintrftgzvjczs`,
    `supabase_url=${SUPABASE_URL}`,
    `git_branch=${gitBranch}`,
    `git_commit=${gitCommit}`,
    `mode=full_data`
  ].join('\n');

  fs.writeFileSync(path.join(backupDir, 'manifest.txt'), manifest, 'utf8');

  // Dump auth users
  console.log('📦 Extraindo usuários de autenticação (auth.users)...');
  let authUsers = [];
  try {
    let page = 1;
    while (true) {
      const { data: usersData, error: authError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (authError) {
        console.warn('  ⚠️ Aviso ao listar usuários de autenticação:', authError.message);
        break;
      }
      if (usersData && usersData.users && usersData.users.length > 0) {
        authUsers = authUsers.concat(usersData.users);
        if (usersData.users.length < 1000) break;
        page++;
      } else {
        break;
      }
    }
    fs.writeFileSync(path.join(backupDir, 'auth_users.json'), JSON.stringify(authUsers, null, 2), 'utf8');
    console.log(`  ✅ ${authUsers.length} usuários exportados em auth_users.json`);
  } catch (err) {
    console.warn('  ⚠️ Erro na extração de auth.users:', err.message);
  }

  const allData = {};
  const summary = {
    timestamp: new Date().toISOString(),
    project_ref: 'ggytwbnintrftgzvjczs',
    supabase_url: SUPABASE_URL,
    total_tables: ALL_TABLES.length,
    auth_users_count: authUsers.length,
    tables: {},
    total_records: 0
  };

  let sqlDump = `-- BACKUP DE DADOS SUPABASE PRODUÇÃO\n-- DATA: ${new Date().toISOString()}\n-- PROJETO: ggytwbnintrftgzvjczs\n\n`;

  console.log('\n📦 Extraindo tabelas do schema public...');

  for (const tableName of ALL_TABLES) {
    process.stdout.write(`  - ${tableName.padEnd(38, ' ')}: `);
    const res = await fetchTableData(tableName);

    if (res.error) {
      if (res.error.includes('does not exist') || res.error.includes('not found') || res.error.includes('relation')) {
        console.log(`[TABELA INEXISTENTE EM PROD]`);
        summary.tables[tableName] = { status: 'not_found', count: 0 };
      } else {
        console.log(`[ERRO: ${res.error}]`);
        summary.tables[tableName] = { status: 'error', error: res.error, count: 0 };
      }
      continue;
    }

    const count = res.rows.length;
    summary.tables[tableName] = { status: 'ok', count };
    summary.total_records += count;
    allData[tableName] = res.rows;

    fs.writeFileSync(
      path.join(tablesDir, `${tableName}.json`),
      JSON.stringify(res.rows, null, 2),
      'utf8'
    );

    if (count > 0) {
      sqlDump += `-- Tabela: ${tableName} (${count} registros)\n`;
      sqlDump += generateSqlInserts(tableName, res.rows) + '\n';
    }

    console.log(`✅ ${count} registros`);
  }

  fs.writeFileSync(path.join(backupDir, 'all_data.json'), JSON.stringify(allData, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'data.sql'), sqlDump, 'utf8');
  fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  const summaryText = [
    `BACKUP DE PRODUÇÃO - RELATÓRIO`,
    `Data: ${summary.timestamp}`,
    `Projeto: ${summary.project_ref}`,
    `Total de Registros: ${summary.total_records}`,
    `Usuários Auth: ${summary.auth_users_count}`,
    `Tabelas Processadas: ${ALL_TABLES.length}`,
    `\nDetalhamento por Tabela:`,
    ...Object.entries(summary.tables).map(([tbl, info]) => `  ${tbl.padEnd(38, ' ')}: ${info.status === 'ok' ? info.count + ' linhas' : info.status}`)
  ].join('\n');

  fs.writeFileSync(path.join(backupDir, 'summary.txt'), summaryText, 'utf8');

  console.log('\n====================================================');
  console.log(`🎉 BACKUP CONCLUÍDO COM SUCESSO!`);
  console.log(`Total de registros salvos: ${summary.total_records}`);
  console.log(`Usuários de autenticação: ${summary.auth_users_count}`);
  console.log(`Arquivos gerados em: ${backupDir}`);
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Erro fatal no backup:', err);
  process.exit(1);
});
