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

  const version = "alfa-26.08.14-01";
  const version_order = 2026081401;
  const title = "URLs amigáveis para pacientes, atalhos de resumo clínico e navegação otimizada";
  const summary = "Lançamento com links e URLs amigáveis para prontuários de pacientes, atalho rápido de resumo clínico no cabeçalho, exibição da data de cadastro e melhorias na gestão de anexos.";

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
      title: "URLs Amigáveis e Links Diretos para Pacientes",
      body: "Agora a plataforma utiliza códigos e identificadores amigáveis nas URLs dos pacientes, facilitando o compartilhamento e acesso direto aos prontuários na clínica.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Atalho para Resumo Clínico no Cabeçalho do Prontuário",
      body: "Novo botão \"Resumo clínico\" integrado diretamente no cabeçalho da ficha do paciente para acesso imediato ao histórico de evolução e dados clínicos.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Exibição Detalhada da Data de Cadastro",
      body: "Inclusão da data e hora exata em que o paciente foi cadastrado na clínica dentro do painel de informações gerais.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Navegação e Acesso a Anexos por Código de Paciente",
      body: "Atualização no sistema de arquivos e sessões para suporte completo a links amigáveis sem perda de contexto dos documentos anexados.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Redirecionamento Canônico em Links de Pacientes",
      body: "Redirecionamento automático e transparente para a URL oficial da clínica ao abrir prontuários a partir de atalhos antigos ou notificações.",
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
