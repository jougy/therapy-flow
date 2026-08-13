import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fileEnv from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Conectando ao Supabase em:", SUPABASE_URL);
  console.log("Autenticando como Administrador Mestre...");
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "jougy@gmx.com",
    password: "Senha123456!",
  });

  if (authError) {
    console.error("Erro na autenticação:", authError);
    process.exit(1);
  }

  console.log("Autenticado como:", authData.user.email);

  const version = "alfa-26.08.12-01";
  const version_order = 2026081201;
  const title = "Gestão de assinaturas da clínica, exportação segura de estatísticas e melhorias de navegação";
  const summary = "Lançamento com módulo financeiro integrado para gestão de planos e faturas da clínica, proteção anti-print na exportação de relatórios, validação otimizada de subcontas e usabilidade mobile aprimorada.";

  // Desativar versão ativa atual
  const { error: deactivateError } = await supabase
    .from("platform_releases")
    .update({ is_active: false })
    .neq("version", version);

  if (deactivateError) {
    console.warn("Aviso ao desativar versões anteriores:", deactivateError.message);
  }

  // Salvar/Upsert nova versão
  const { data: releaseData, error: releaseError } = await supabase
    .from("platform_releases")
    .upsert({
      version,
      version_order,
      title,
      summary,
      is_active: true,
      published_at: new Date().toISOString(),
    }, { onConflict: "version" })
    .select()
    .single();

  if (releaseError) {
    console.error("Erro ao inserir/atualizar versão:", releaseError);
    process.exit(1);
  }

  console.log("Versão salva com sucesso! ID:", releaseData.id);

  // Remover tópicos anteriores da mesma versão (para garantir idempotência)
  await supabase
    .from("platform_release_note_items")
    .delete()
    .eq("release_id", releaseData.id);

  // Inserir tópicos filtrados (sem backoffice / dados sensíveis)
  const items = [
    {
      release_id: releaseData.id,
      category: "added",
      title: "Módulo Integrado de Assinaturas e Faturas da Clínica",
      body: "Gestão completa de planos de assinatura, histórico de faturas, comprovantes e opções de pagamento via Pix, Cartão de Crédito e Boleto diretamente no painel de configurações.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Proteção Anti-Print e Confirmação de Responsabilidade",
      body: "Ao exportar ou imprimir relatórios e estatísticas da clínica, o sistema solicita confirmação de responsabilidade sobre dados sensíveis e insere proteção com marca d'água.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Controle e Alertas de Limites de Subcontas",
      body: "Validação aprimorada da quantidade de profissionais e colaboradores com alertas de capacidade do plano contratado durante os convites e onboarding.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Menu Mobile e Transição Contínua Entre Clínicas",
      body: "Barra de navegação inferior mobile ajustada para telas touch e manutenção do estado da clínica ativa durante a alternância de navegação.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Filtro de Sessões Ativas e Permissões de Acesso",
      body: "Correção no carregamento e filtragem de sessões compartilhadas do usuário ao alternar entre múltiplos espaços e clínicas.",
      sort_order: 10,
    },
  ];

  const { error: itemsError } = await supabase
    .from("platform_release_note_items")
    .insert(items);

  if (itemsError) {
    console.error("Erro ao inserir tópicos:", itemsError);
    process.exit(1);
  }

  console.log("✅ Novidades da versão", version, "publicadas com sucesso no banco de dados!");
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
