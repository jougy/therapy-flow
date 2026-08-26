import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

  const version = "alfa-26.08.26-01";
  const version_order = 2026082601;
  const title = "Evolução Clínica de Pacientes, Otimização de Performance e Deploy Contínuo";
  const summary = "Atualização com suporte à estruturação de grupos e linhagem de evolução clínica para pacientes, otimização profunda de performance no seletor de clínicas e no dashboard, arrastar recursivo no editor de formulários e pipeline automatizado de deploy contínuo.";

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

  // Remover tópicos anteriores da mesma versão
  await supabase
    .from("platform_release_note_items")
    .delete()
    .eq("release_id", releaseData.id);

  // Inserir tópicos filtrados (sem backoffice / dados sensíveis)
  const items = [
    {
      release_id: releaseData.id,
      category: "added",
      title: "Estruturação de Ciclos e Grupos de Evolução Clínica",
      body: "Nova camada de evolução para vincular e agrupar atendimentos ao longo do tratamento do paciente, permitindo histórico contínuo e linhagem entre sessões.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Pipeline Automatizado de Deploy Contínuo (CI/CD)",
      body: "Automação de compilação, testes e publicação no Cloudflare Workers para garantir entregas ágeis e alta disponibilidade do sistema.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Otimização de Performance no Seletor de Clínicas e Sessões",
      body: "Implementação de novos índices compostos e parciais no banco de dados, reduzindo o tempo de resposta e acelerando a alternância entre clínicas.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Agilização de Métricas do Dashboard da Clínica",
      body: "Aprimoramento do motor analítico de consultas para cálculo instantâneo de produtividade, faturamento e fluxo de atendimentos sem lentidão.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Arrastar e Reordenar Recursivo no Editor de Formulários",
      body: "Melhoria no construtor de anamneses para mover blocos de campos filhos e contêineres de maneira íntegra e fluida na árvore do formulário.",
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Exibição e Contagem de Campos na Biblioteca Comunitária",
      body: "Ajuste na contagem de campos exibida nos cards e modal de pré-visualização de modelos da comunidade, evitando inconsistências visuais.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Otimização nas Políticas de Leitura de Perfis",
      body: "Refinamento das consultas de segurança com subqueries escalares para acelerar o carregamento de membros e colaboradores.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Estabilidade na Suíte de Testes e Simulações",
      body: "Ajustes em mocks de tela, fallbacks do cliente de dados e isolamento de ambiente para testes automatizados mais rápidos e consistentes.",
      sort_order: 30,
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
