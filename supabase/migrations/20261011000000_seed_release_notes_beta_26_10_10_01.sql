-- Migration: Seed Release Notes beta-26.10.10-01
-- Descrição: Registro oficial do lançamento beta-26.10.10-01 no painel de novidades (sem dados internos de backoffice)

with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'beta-26.10.10-01'
    and is_active = true
  returning id
),
release_upsert as (
  insert into public.platform_releases (
    version,
    version_order,
    title,
    summary,
    published_at,
    is_active
  )
  values (
    'beta-26.10.10-01',
    2026101001,
    'Therapy-Flow Beta: Multi-Cartão & Renovação em 1-Clique, TCLE na Ficha do Paciente, Mensageria Inteligente e Descontos Oficiais',
    'Atualização robusta da plataforma trazendo suporte a múltiplos cartões de crédito salvos (padrão Mercado Livre/Shopee) e renovação rápida de planos em 1-clique; acesso direto e impressão física A4 dos Termos de Consentimento (TCLE Adulto e Menor de Idade) diretamente no cabeçalho do paciente; atualização canônica dos descontos nos ciclos trimestral (-15% OFF) e anual (-35% OFF) com destaque de Plano Ilimitado Ativo; inclusão de linha digitável e código de barras nas faturas em Boleto Bancário; campos inclusivos de identidade no perfil e cadastro; padronização de dicas contextuais dispensáveis e persistência ampliada de sessão no PWA.',
    now(),
    true
  )
  on conflict (version)
  do update set
    version_order = excluded.version_order,
    title = excluded.title,
    summary = excluded.summary,
    published_at = excluded.published_at,
    is_active = excluded.is_active,
    updated_at = now()
  returning id
),
target_release as (
  select id from release_upsert
  union
  select id from public.platform_releases where version = 'beta-26.10.10-01'
  limit 1
),
deleted_items as (
  delete from public.platform_release_note_items
  where release_id in (select id from target_release)
)
insert into public.platform_release_note_items (
  release_id,
  category,
  title,
  body,
  sort_order
)
select
  target_release.id,
  items.category::public.platform_release_note_category,
  items.title,
  items.body,
  items.sort_order
from target_release
cross join (
  values
    ('added', 'Carteira de Cartões de Crédito Salvos e Renovação Rápida (Padrão 1-Clique)', 'Possibilidade de salvar múltiplos cartões de crédito de forma segura para renovações e pagamentos recorrentes. No checkout, basta escolher o cartão salvo com identificação da bandeira e banco emissor (ex: BTG, Nubank, Itaú) e digitar apenas o código CVV de segurança.', 10),
    ('added', 'Acesso Direto aos Termos de Consentimento (TCLE) no Prontuário do Paciente', 'Adicionadas as ações "Imprimir Termo de Consentimento (Adulto)" e "Imprimir Termo do Responsável (Menor)" no menu de opções rápidas do paciente, permitindo gerar a versão impressa A4 pronta para assinatura física em 1 clique.', 20),
    ('added', 'Linha Digitável e Código de Barras Completo em Faturas por Boleto Bancário', 'Ao gerar faturas de assinatura via boleto, o sistema agora disponibiliza a linha digitável copiada com um toque e o código de barras numérico oficial, agilizando o pagamento pelo aplicativo de qualquer banco.', 30),
    ('added', 'Campos Inclusivos de Gênero e Pronome de Preferência no Perfil e Cadastro', 'Possibilidade de informar gênero autodeclarado e pronomes de tratamento de forma opcional (com opção livre de digitação) no cadastro e na edição de perfil pessoal, respeitando a identidade de cada profissional.', 40),
    ('added', 'Dicas Contextuais Informativas Dispensáveis (DismissibleInfoTip)', 'Novas caixas de aviso e dicas operacionais sobre LGPD, sigilo profissional, bloco padrão e atalhos de atendimento que podem ser dispensadas após a leitura para liberar espaço na tela.', 50),

    ('changed', 'Descontos Canônicos de Assinatura: Trimestral (-15% OFF) e Anual (-35% OFF)', 'Atualização das condições especiais de contratação na página de planos e no modal de alteração de ciclo, garantindo maior economia aos profissionais e clínicas parceiras.', 10),
    ('changed', 'Destaque Visual de "Plano Ilimitado Ativo" no Painel de Faturamento e Planos', 'Visualização aprimorada da assinatura em vigência com crachá "Plano Ilimitado Ativo", detalhamento de acessos simultâneos contratados e diferenciação nítida entre planos ativos e expirados.', 20),
    ('changed', 'Padronização Canônica para "Teste Gratuito (7 dias)"', 'Uniformização em todas as telas, tutoriais e avisos da plataforma, garantindo clareza e transparência no período experimental para novos consultórios.', 30),
    ('changed', 'Fluxo Otimizado de Checkout Direto para Planos Profissionais Solo', 'A contratação de planos Solo agora direciona o profissional diretamente para o checkout seguro de sua clínica individual provisionada, sem etapas intermediárias desnecessárias.', 40),

    ('fixed', 'Impressão Isolada de Termos de Consentimento em Folha A4 (@media print)', 'Correção na camada de impressão que isola completamente o documento no padrão A4 em folha limpa, evitando elementos sobrepostos ou cortes em tabelas de identificação e linhas de assinatura.', 10),
    ('fixed', 'Barra de Seleção de Porte de Equipe em Telas Claras e Escuras', 'Substituição do controle seletor de planos por controle interativo com contraste perfeito em temas claro e escuro, facilitando a navegação táctil no smartphone e desktop.', 20),
    ('fixed', 'Resiliência e Persistência de Sessão e Clínica Ativa no PWA / Smartphone', 'Aprimoramento no armazenamento da clínica em uso e autenticação, garantindo que o profissional permaneça conectado na clínica correta ao reabrir o aplicativo PWA instalado no smartphone.', 30),
    ('fixed', 'Ergonomia dos Campos de Horário de Chegada e Início do Atendimento no Mobile', 'Ajuste no cabeçalho dos campos de data e horário do atendimento e presença, realocando o botão "Agora" para evitar estouro horizontal em aparelhos compactos (375px a 390px).', 40),
    ('fixed', 'Estabilidade no Registro Histórico e Conclusão de Atendimentos Clínicos', 'Blindagem na persistência de alterações de presenças e atendimentos no prontuário, garantindo salvamento fluido e contínuo mesmo com oscilações temporárias de conexão.', 50)
) as items(category, title, body, sort_order);
