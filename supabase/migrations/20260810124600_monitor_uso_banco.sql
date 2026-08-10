-- Portal SimonSports - monitor de uso do banco Supabase
-- Retorna apenas métricas agregadas; não expõe dados de tabelas.

create or replace function public.pss_database_usage()
returns table (
  used_bytes bigint,
  used_mb numeric,
  limit_mb numeric,
  used_percent numeric,
  free_mb numeric,
  status text,
  level integer,
  message text
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  with m as (
    select
      pg_database_size(current_database())::bigint as bytes,
      500::numeric as limite_mb
  ), c as (
    select
      bytes,
      round((bytes / 1024.0 / 1024.0)::numeric, 2) as mb,
      limite_mb
    from m
  ), p as (
    select
      bytes,
      mb,
      limite_mb,
      round((mb / limite_mb * 100)::numeric, 2) as pct,
      greatest(round((limite_mb - mb)::numeric, 2), 0) as livre
    from c
  )
  select
    bytes,
    mb,
    limite_mb,
    pct,
    livre,
    case
      when pct >= 90 then 'CRITICO'
      when pct >= 80 then 'ALTO'
      when pct >= 70 then 'ATENCAO'
      when pct >= 50 then 'OBSERVAR'
      else 'NORMAL'
    end,
    case
      when pct >= 90 then 4
      when pct >= 80 then 3
      when pct >= 70 then 2
      when pct >= 50 then 1
      else 0
    end,
    case
      when pct >= 90 then 'Uso crítico: reduzir o banco ou avaliar mudança de plano imediatamente.'
      when pct >= 80 then 'Uso alto: iniciar limpeza e arquivamento antes de novas migrações pesadas.'
      when pct >= 70 then 'Atenção: revisar crescimento de tabelas e índices.'
      when pct >= 50 then 'Monitorar: banco já passou de metade do limite configurado.'
      else 'Uso normal: há margem confortável no limite configurado.'
    end
  from p;
$$;

revoke all on function public.pss_database_usage() from public;
grant execute on function public.pss_database_usage() to anon, authenticated;

comment on function public.pss_database_usage() is
'Monitor agregado do tamanho do banco para o painel administrativo do Portal SimonSports.';
