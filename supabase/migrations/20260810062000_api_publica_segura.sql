-- Portal SimonSports - API pública segura Supabase
-- Expõe apenas dados necessários ao frontend público.
-- Não concede SELECT direto nas tabelas e não expõe legacy_payload.

begin;

create or replace function public.pss_boloes_publicos()
returns table (
  id text,
  nome text,
  loteria text,
  status text,
  data_sorteio date,
  inicio_pagamento date,
  fim_pagamento date,
  inicio_palpite date,
  fim_palpite date,
  valor_cota numeric,
  total_cotas numeric,
  cotas_adquiridas numeric,
  cotas_disponiveis numeric,
  premiacao numeric,
  premio_por_cota numeric,
  faixa_numeros integer,
  qtd_min integer,
  qtd_max integer,
  qtd_palpite integer,
  historico boolean,
  numeros_sorteados text,
  resultado_sorteio text,
  atualizado_cotas_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.nome,
    b.loteria,
    b.status,
    b.data_sorteio,
    b.inicio_pagamento,
    b.fim_pagamento,
    b.inicio_palpite,
    b.fim_palpite,
    b.valor_cota,
    b.total_cotas,
    b.cotas_adquiridas,
    b.cotas_disponiveis,
    b.premiacao,
    b.premio_por_cota,
    b.faixa_numeros,
    b.qtd_min,
    b.qtd_max,
    b.qtd_palpite,
    b.historico,
    b.numeros_sorteados,
    b.resultado_sorteio,
    b.atualizado_cotas_em
  from public.boloes b
  order by coalesce(b.data_sorteio, date '2999-12-31'), b.nome;
$$;

create or replace function public.pss_resultados_publicos()
returns table (
  bolao_id text,
  loteria text,
  concurso text,
  data_sorteio date,
  numeros jsonb,
  numeros_texto text,
  premiacao jsonb,
  fonte text,
  fonte_versao text,
  publicado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.bolao_id,
    r.loteria,
    r.concurso,
    r.data_sorteio,
    r.numeros,
    r.numeros_texto,
    r.premiacao,
    r.fonte,
    r.fonte_versao,
    r.publicado_em
  from public.resultados r
  order by r.data_sorteio desc nulls last, r.created_at desc;
$$;

create or replace function public.pss_configuracoes_publicas()
returns table (
  chave text,
  valor jsonb,
  descricao text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.chave, c.valor, c.descricao, c.updated_at
  from public.configuracoes c
  where c.publico = true
  order by c.chave;
$$;

-- Bloqueia execução por padrão e abre somente os endpoints públicos selecionados.
revoke all on function public.pss_boloes_publicos() from public;
revoke all on function public.pss_resultados_publicos() from public;
revoke all on function public.pss_configuracoes_publicas() from public;

grant execute on function public.pss_boloes_publicos() to anon, authenticated;
grant execute on function public.pss_resultados_publicos() to anon, authenticated;
grant execute on function public.pss_configuracoes_publicas() to anon, authenticated;

comment on function public.pss_boloes_publicos() is 'Leitura pública sanitizada dos bolões; não expõe legacy_payload.';
comment on function public.pss_resultados_publicos() is 'Leitura pública sanitizada de resultados.';
comment on function public.pss_configuracoes_publicas() is 'Leitura somente das configurações marcadas como públicas.';

commit;
