-- Migration: Seed Release Notes beta-26.10.24-1
-- Descrição: Registro oficial do lançamento beta-26.10.24-1 no painel de novidades (sem dados internos de backoffice)

with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'beta-26.10.24-1'
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
    'beta-26.10.24-1',
    2026102401,
    'Therapy-Flow Beta: Corretor Ortográfico Clínico, Anotações Visuais em Imagens, Agenda Multi-Turno & Notificações Acústicas',
    'Grande atualização da plataforma trazendo o novo motor de Correção Ortográfica Clínica offline (Typo.js/Web Worker) com dicionário federado e termos de saúde; estúdio de anotações e demarcações clínicas em fotos de evolução com régua de dor e severidade; painel multi-turno na Agenda semanal (Madrugada, Manhã, Tarde e Noite) com alarmes sonoros configuráveis; módulo de convites idempotentes com papéis dinâmicos e suporte a convênio de saúde; e persistência otimizada com arquitetura modular ultra-rápida.',
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
  select id from public.platform_releases where version = 'beta-26.10.24-1'
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
    ('added', 'Engine de Corretor Ortográfico Clínico em Tempo Real (Typo.js + IndexedDB)', 'Correção ortográfica inteligente integrada aos campos de conduta, evolução e anamnese. Processamento 100% no navegador via Web Worker sem lentidão na digitação, com suporte a termos médicos/fisioterápicos e persistência de dicionário offline.', 10),
    ('added', 'Estúdio de Demarcação e Anotações Clínicas em Imagens de Evolução', 'Novo editor vetorial para fotos de exames e posturas corporais: adicione setas, linhas de tração, marca-texto, círculos e pins de dor com slider gradiente de severidade (do verde ao roxo) e notas contextuais detalhadas.', 20),
    ('added', 'Filtros Multi-Turno na Agenda Semanal (Madrugada, Manhã, Tarde e Noite)', 'Navegação ágil e visual nos cards de dias da semana na Agenda. Botões interativos para filtrar múltiplos turnos simultaneamente com totalizadores de horários e limpeza em um toque.', 30),
    ('added', 'Central de Notificações com Toques Acústicos e Modo Alarme Clínico', 'Configuração pessoal de toques com biblioteca de sons sintetizados via Web Audio API (Suave, Chime, Pulso, Alarme Clínico e Sirene). Inclui prévia sonora instantânea e alarmes contínuos com parada automática em aba cruzada via BroadcastChannel.', 40),
    ('added', 'Dock Dupla de Acesso Rápido e Seleção Long-Press no Mobile', 'Nova barra ergonômica inferior no smartphone com gestos de toque longo (long-press com vibração tátil haptic) para menu rápido de ações em pacientes e navegação fluida em telas compactas (375px/390px).', 50),
    ('added', 'Módulo Universal de Convênios de Saúde e Planos de Atendimento', 'Suporte completo à associação de convênios médicos nos cadastros de pacientes e agendamentos, com controle transparente de guias, autorizações e modalidades de faturamento.', 60),

    ('changed', 'Fluxo de Aceite Idempotente e Branding em Convites de Colaboradores', 'Página pública de convite (/convite) remodelada com suporte dinâmico a cargos e permissões personalizadas, detecção automática do usuário conectado, validação de e-mail e exibição clara da clínica anfitriã.', 10),
    ('changed', 'Visualização Mensal da Agenda com Painel Lateral Contextual e Fuso Horário', 'Grade do mês compactada com painel lateral dinâmico de detalhes do dia selecionado, suporte nativo ao fuso horário de origem e badges com cores específicas por tipo de evento.', 20),
    ('changed', 'Aprimoramento Visual nos Cards de Atendimento e Abreviatura Ergonômica', 'Exibição elegante e compacta dos nomes dos profissionais responsáveis nos atendimentos históricos para evitar estouro de texto, além de botões diretos de evolução rápida e vínculo a grupos de tratamento.', 30),
    ('changed', 'Compatibilidade Expandida para Contas e Assinaturas Cortesia Parceira', 'Regras de verificação de quotas de planos atualizadas para reconhecer assinaturas de parceria institucional e cortesia sem emitir alertas indevidos de bloqueio ou expiração.', 40),

    ('fixed', 'Desmonolitização de Componentes e Otimização Extrema de Carregamento', 'Refatoração profunda da arquitetura do frontend dividindo páginas pesadas em submódulos indexados (Formulários, Agenda, Detalhe do Paciente e Detalhe da Sessão), reduzindo o bundle inicial e acelerando a abertura das telas.', 10),
    ('fixed', 'Integridade Transacional e Blindagem de Políticas RLS no Prontuário', 'Ajuste na camada de persistência de histórico de sessões e integridade referencial clínica-paciente-sessão, prevenindo interrupções ou descompassos em conexões instáveis.', 20),
    ('fixed', 'Prevenção de Quebras de Layout e Bloqueio de Overflow em Viewports Móveis', 'Remoção de contenções fixas e ajustes em modais de atendimento com vaul/bottom sheets, garantindo rolagem vertical suave e touch targets mínimos de 44x44px em iPhones e Androids.', 30),
    ('fixed', 'Resiliência na Autenticação em 2 Etapas (2FA) e Desbloqueio de Sessões', 'Tratamento aprimorado de fluxos de login com verificação rápida, contingência em caso de atraso de mensagens e prevenção de sessões duplicadas no aplicativo.', 40)
) as items(category, title, body, sort_order);
