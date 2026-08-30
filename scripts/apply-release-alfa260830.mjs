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

  const version = "alfa-26.08.30-01";
  const version_order = 2026083001;
  const title = "Métricas de Pacotes no Dashboard, Ciclos de Assinatura e Aplicativo PWA";
  const summary = "Lançamento com acompanhamento analítico e gestão de pacotes de sessões no dashboard da clínica, novos ciclos de assinatura flexíveis com checkout transparente, período de teste gratuito (Free Trial), central de instalação como aplicativo (PWA) e aprimoramentos nas avaliações clínicas.";

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

  // Inserir tópicos filtrados (sem backoffice / dados sensíveis de acordo com a regra da vault)
  const items = [
    {
      release_id: releaseData.id,
      category: "added",
      title: "Gestão e Métricas de Pacotes de Sessões no Dashboard",
      body: "Acompanhamento analítico completo de pacotes de sessões contratados pelos pacientes diretamente no dashboard da clínica, incluindo visualização de sessões consumidas versus restantes, taxa de utilização e métricas consolidadas.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Planos de Assinatura com Ciclos Flexíveis e Checkout Transparente",
      body: "Disponibilização de opções de assinatura com ciclos mensal, semestral e anual com descontos progressivos, além de fluxo de contratação com prévia detalhada de faturas e suporte a cupons promocionais.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Período de Teste Gratuito (Free Trial) com Indicadores de Quota",
      body: "Ativação de período de degustação gratuita para novas clínicas explorarem todos os recursos da plataforma, com exibição visual dos dias restantes e do consumo de cotas de profissionais e pacientes em tempo real.",
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: "added",
      title: "Suporte a Aplicativo Web Progressivo (PWA) e Central de Instalação",
      body: "Possibilidade de instalar o Pluri-Health como aplicativo nativo no computador (Chrome, Edge, Brave) e em dispositivos móveis (Android e iOS), com acesso rápido e página dedicada de download.",
      sort_order: 40,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Gráficos de Avaliação Física e Geração de Kits de Impressão em Branco",
      body: "Aprimoramentos visuais nos gráficos de radar das fichas de avaliação clínica e geração otimizada de folhas de anamnese em branco com identidade visual padronizada da clínica para prontuários físicos.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Gerenciamento de Múltiplas Unidades e Filiais por CNPJ",
      body: "Flexibilização no cadastro de clínicas que permite ao mesmo proprietário criar e administrar múltiplas filiais sob o mesmo CNPJ com total isolamento de dados.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "changed",
      title: "Aprimoramento na Navegação de Configurações e Planos",
      body: "Reorganização intuitiva dos painéis de perfil pessoal e configurações da clínica, facilitando a transição entre planos, dados cadastrais e opções de segurança.",
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Resiliência no Motor Analítico e Permissões do Dashboard",
      body: "Correção no cálculo de agregações e permissões para garantir que todos os colaboradores autorizados visualizem métricas de produtividade e faturamento sem inconsistências.",
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Preservação de Histórico para Planos em Modo Somente Leitura",
      body: "Tratamento aprimorado para clínicas com planos expirados, assegurando que o histórico de prontuários e atendimentos permaneça consultável com segurança e integridade.",
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: "fixed",
      title: "Estabilidade na Sincronização de Indicadores de Uso e Alertas",
      body: "Ajuste fino na atualização em tempo real de contadores de colaboradores ativos e cotas de uso do plano para evitar atrasos na interface.",
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
