with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'beta-26.09.17-01'
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
    'beta-26.09.17-01',
    2026091701,
    'Therapy-Flow Beta: Linha Completa de Atendimento, Cobrança Transparente & Gestão Clínica',
    'Marco inaugural da versão Beta da plataforma! Atingimos a maturidade da jornada completa de ponta a ponta: cadastro inteligente com busca por CEP, relatórios e laudos para impressão, fluxo de consentimento de menores, novos planos de assinatura com checkout transparente e cupons, controle granular de permissões de equipe e editor dinâmico de fichas clínicas.',
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
  select id from public.platform_releases where version = 'beta-26.09.17-01'
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
    ('added', 'Preenchimento Automático de Endereço via CEP', 'Ao digitar o CEP no cadastro de pacientes, os campos de logradouro, bairro, cidade e UF são preenchidos instantaneamente via integração em tempo real, agilizando a recepção e prevenindo erros de digitação.', 10),
    ('added', 'Cupons de Desconto Promocionais e Flexibilidade de Checkout', 'Suporte completo à aplicação de cupons percentuais e de valor fixo no checkout transparente de assinaturas e faturas da clínica.', 20),
    ('added', 'Controle Granular de Permissões de Equipe (RBAC)', 'Gerenciamento detalhado de funções e níveis de acesso personalizados para secretárias, estagiários, terapeutas e administradores da clínica.', 30),
    ('added', 'Termos de Responsabilidade e Consentimento de Menores (LGPD/CFM)', 'Fluxo completo de autorização para atendimento de pacientes menores de idade com assinatura presencial, link de consentimento online e impressão de comprovante para conformidade jurídica estrita.', 40),
    ('added', 'Editor Dinâmico de Fichas de Avaliação e Anamnese (DesignLab)', 'Novo motor de criação de formulários clínicos customizados com componentes arrastáveis, campos modulares e pré-visualização em tempo real.', 50),

    ('changed', 'Transição Oficial para a Fase Beta da Plataforma', 'Consolidação de toda a jornada principal de atendimento: cadastro, agendamento, prontuários, evoluções de sessões, pacotes e faturamento integrado.', 10),
    ('changed', 'Diretório de Pacientes com Busca e Filtros Otimizados', 'Aprimoramento na navegação e busca rápida por nome, CPF e status, com visualização moderna em cards adaptáveis para telas móveis e desktop.', 20),
    ('changed', 'Laudos e Estatísticas de Pacientes Formatados para Impressão', 'Layout institucional padronizado para impressão limpa de relatórios clínicos e gráficos de evolução do paciente.', 30),
    ('changed', 'Precificação Solo Otimizada e Consolidação do Período de Testes (Trial)', 'Ajuste no valor do plano individual e ativação simplificada de degustação gratuita com validação segura de cotas.', 40),

    ('fixed', 'Isolamento de Status de Usuário em Múltiplas Clínicas', 'Blindagem nas permissões para colaboradores que atuam em diferentes clínicas, garantindo total isolamento de dados e perfis operacionais.', 10),
    ('fixed', 'Reenvio de Convites e Resolução de Códigos Públicos', 'Tratamento de concorrência no aceite de convites de equipe e geração rápida de códigos públicos para novos profissionais.', 20),
    ('fixed', 'Blindagem de Segurança e Otimização de Consultas', 'Aprimoramento contínuo nos protocolos de segurança e isolamento de dados de prontuários e sessões, reduzindo o tempo de carregamento e assegurando sigilo profissional absoluto.', 30),
    ('fixed', 'Scroll Vertical e Responsividade em Modais no Mobile', 'Correção do comportamento de rolagem em modais de cadastro e relatórios em telas compactas (375px a 390px).', 40),

    ('removed', 'Descontinuação de Telas Legadas da Antiga Tesouraria', 'Remoção de seções obsoletas e redirecionamento para o módulo unificado de faturamento, faturas e planos.', 10)
) as items(category, title, body, sort_order);
