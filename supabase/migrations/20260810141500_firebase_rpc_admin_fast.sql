-- Portal SimonSports - leitura administrativa direta via Firebase JWT
-- Requer Third-Party Auth Firebase habilitado no projeto Supabase.

create or replace function public.pss_firebase_jwt_valido()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(auth.jwt()->>'iss','') = 'https://securetoken.google.com/boloes-loterias-especiais'
     and coalesce(auth.jwt()->>'aud','') = 'boloes-loterias-especiais'
     and coalesce(auth.jwt()->>'email','') <> '';
$$;

create or replace function public.pss_admin_atual()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.pss_firebase_jwt_valido()
     and exists (
       select 1
       from public.usuarios u
       where lower(coalesce(u.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
         and u.aprovado is true
         and upper(coalesce(u.status,'ATIVO')) not in ('INATIVO','BLOQUEADO','CANCELADO')
         and (upper(coalesce(u.perfil,'')) like '%ADMIN%' or upper(coalesce(u.perfil,'')) like '%MESTRE%')
     );
$$;

create or replace function public.pss_admin_usuarios_fast()
returns table (
  id uuid, nome text, email text, telefone text, status text, perfil text,
  aprovado boolean, firebase_uid text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
begin
  if not public.pss_admin_atual() then raise exception 'Acesso negado'; end if;
  return query
    select u.id,u.nome,u.email,u.telefone,u.status,u.perfil,u.aprovado,u.firebase_uid,u.created_at,u.updated_at
    from public.usuarios u
    order by lower(coalesce(u.nome,u.email,''));
end;
$$;

create or replace function public.pss_admin_pagamentos_fast()
returns table (
  id uuid, legacy_id text, usuario_id uuid, usuario_nome text, usuario_email text,
  bolao_id text, bolao_nome text, valor numeric, status text, forma_pagamento text,
  data_pagamento timestamptz, pagador text, recebedor text, observacao text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
begin
  if not public.pss_admin_atual() then raise exception 'Acesso negado'; end if;
  return query
    select p.id,p.legacy_id,p.usuario_id,u.nome,u.email,p.bolao_id,b.nome,p.valor,p.status,
           p.forma_pagamento,p.data_pagamento,p.pagador,p.recebedor,p.observacao,p.created_at,p.updated_at
    from public.pagamentos p
    left join public.usuarios u on u.id=p.usuario_id
    left join public.boloes b on b.id=p.bolao_id
    order by coalesce(p.data_pagamento,p.created_at) desc;
end;
$$;

create or replace function public.pss_admin_participantes_fast()
returns table (
  id uuid, bolao_id text, bolao_nome text, usuario_id uuid, usuario_nome text, usuario_email text,
  status text, inscrito boolean, cotas_confirmadas numeric, cotas_pendentes numeric,
  cotas_reservadas numeric, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
begin
  if not public.pss_admin_atual() then raise exception 'Acesso negado'; end if;
  return query
    select p.id,p.bolao_id,b.nome,p.usuario_id,u.nome,u.email,p.status,p.inscrito,
           p.cotas_confirmadas,p.cotas_pendentes,p.cotas_reservadas,p.created_at,p.updated_at
    from public.participacoes p
    join public.usuarios u on u.id=p.usuario_id
    join public.boloes b on b.id=p.bolao_id
    order by lower(coalesce(b.nome,'')), lower(coalesce(u.nome,u.email,''));
end;
$$;

create or replace function public.pss_admin_comprovantes_fast()
returns table (
  id uuid, pagamento_id uuid, usuario_id uuid, usuario_nome text, usuario_email text,
  nome_arquivo text, mime_type text, tamanho_bytes bigint, status text,
  legacy_drive_url text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
begin
  if not public.pss_admin_atual() then raise exception 'Acesso negado'; end if;
  return query
    select c.id,c.pagamento_id,c.usuario_id,u.nome,u.email,c.nome_arquivo,c.mime_type,
           c.tamanho_bytes,c.status,c.legacy_drive_url,c.created_at,c.updated_at
    from public.comprovantes c
    left join public.usuarios u on u.id=c.usuario_id
    order by c.created_at desc;
end;
$$;

revoke all on function public.pss_firebase_jwt_valido() from public;
revoke all on function public.pss_admin_atual() from public;
revoke all on function public.pss_admin_usuarios_fast() from public;
revoke all on function public.pss_admin_pagamentos_fast() from public;
revoke all on function public.pss_admin_participantes_fast() from public;
revoke all on function public.pss_admin_comprovantes_fast() from public;

grant execute on function public.pss_firebase_jwt_valido() to anon, authenticated;
grant execute on function public.pss_admin_atual() to anon, authenticated;
grant execute on function public.pss_admin_usuarios_fast() to anon, authenticated;
grant execute on function public.pss_admin_pagamentos_fast() to anon, authenticated;
grant execute on function public.pss_admin_participantes_fast() to anon, authenticated;
grant execute on function public.pss_admin_comprovantes_fast() to anon, authenticated;
