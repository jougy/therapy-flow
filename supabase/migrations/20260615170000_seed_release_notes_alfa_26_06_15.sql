with release_upsert as (
  insert into public.platform_releases (
    version,
    version_order,
    title,
    summary,
    published_at,
    is_active
  )
  values (
    'alfa-26.06.15-1',
    2026061501,
    'Espaço pessoal, pacientes e cadastros',
    'Melhorias no espaço pessoal, no cadastro de pacientes, nos alertas clínicos e na experiência em telas menores.',
    now(),
    true
  )
  on conflict (version)
  do update set
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
  select id from public.platform_releases where version = 'alfa-26.06.15-1'
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
    ('added', 'Painel de novidades no espaço pessoal', 'O espaço pessoal agora tem uma área dedicada para acompanhar novidades da plataforma por categoria.', 10),
    ('added', 'Navegação do espaço pessoal', 'O espaço pessoal ganhou atalhos para Clínicas, Estatísticas, Novidades e Configurações, com ajuste específico para telas menores.', 20),
    ('added', 'Estatísticas do espaço pessoal', 'Foram incluídos indicadores gerais de pacientes, atendimentos e grupos mais frequentes.', 30),
    ('added', 'Estatísticas completas da clínica', 'A clínica ganhou uma área de estatísticas completas para análises mais detalhadas.', 40),
    ('added', 'Alertas clínicos no paciente', 'A ficha do paciente agora destaca riscos importantes, alergias e risco de queda no cabeçalho.', 50),
    ('added', 'Checklist de riscos no cadastro completo', 'O cadastro completo passou a registrar riscos como queda, alergia, gestação, diabetes, convulsão e outros alertas clínicos.', 60),
    ('added', 'Papéis operacionais personalizáveis', 'Colaboradores e acessos agora permitem organizar permissões por função.', 70),

    ('changed', 'Rota do espaço pessoal', 'A rota principal do espaço pessoal foi ajustada para /espacopessoal.', 10),
    ('changed', 'Fluxo de pré-cadastro de paciente', 'Após o pré-cadastro, o fluxo segue para o cadastro completo do paciente.', 20),
    ('changed', 'Cadastro pendente mais evidente', 'A indicação de cadastro pendente ficou mais chamativa e agora leva diretamente para completar o cadastro.', 30),
    ('changed', 'Texto de ações do paciente', 'Alguns rótulos foram ajustados para deixar mais claro quando a ação mostra todos os dados ou abre o resumo clínico.', 40),
    ('changed', 'Criação de conta principal', 'O cadastro inicial passou a preservar melhor o nome informado para a clínica.', 50),

    ('fixed', 'Permissões do cadastro inicial', 'Foram corrigidas permissões relacionadas à criação da conta principal.', 10),
    ('fixed', 'Nome da clínica no cadastro inicial', 'Foi corrigido o caso em que a clínica podia aparecer com documento no lugar do nome informado.', 20),
    ('fixed', 'Idempotência no cadastro de pacientes', 'O cadastro de pacientes passou a verificar CPF e nome para reduzir duplicidades.', 30),
    ('fixed', 'Campos obrigatórios do pré-cadastro', 'O pré-cadastro de pacientes recebeu validações mais rígidas de preenchimento.', 40),
    ('fixed', 'Link de cadastro completo compartilhável', 'O fluxo de cadastro completo enviado ao paciente recebeu correções de acesso e validação.', 50),
    ('fixed', 'Editor de formulários no mobile', 'Foram corrigidas áreas do editor que apresentavam comportamento inconsistente em telas menores.', 60)
) as items(category, title, body, sort_order);
