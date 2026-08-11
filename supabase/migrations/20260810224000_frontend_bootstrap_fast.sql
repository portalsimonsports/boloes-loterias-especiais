-- Portal SimonSports — bootstrap rápido do frontend
-- Não altera layout nem regras. Consolida leituras em uma única chamada Supabase por sessão.

create or replace function public.pss_frontend_bootstrap_fast()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=public.pss_usuario_aprovado();
  v_admin boolean:=public.pss_is_admin();
  v_public_cfg jsonb:='{}'::jsonb;
  v_resumo jsonb:='{}'::jsonb;
begin
  select coalesce(jsonb_object_agg(chave,valor),'{}'::jsonb)
    into v_public_cfg
    from public.configuracoes
   where coalesce(publico,false)=true;

  select jsonb_build_object(
    'totalInscritos',coalesce(sum(case when coalesce(inscrito,false) then 1 else 0 end),0),
    'porBolao',coalesce(jsonb_agg(jsonb_build_object(
      'bolaoId',b.id,
      'bolao',b.nome,
      'loteria',b.loteria,
      'inscritos',coalesce(x.inscritos,0)
    ) order by b.data_sorteio nulls last,b.nome),'[]'::jsonb)
  )
  into v_resumo
  from public.boloes b
  left join lateral (
    select count(*) filter(where coalesce(p.inscrito,false)) inscritos
      from public.participacoes p
     where p.bolao_id=b.id
  ) x on true
  where upper(coalesce(b.status,''))<>'EXCLUIDO';

  return jsonb_build_object(
    'ok',true,
    'generatedAt',now(),
    'me',public.pss_me(),
    'dashboard',public.pss_dashboard(),
    'boloes',public.pss_boloes_usuario(),
    'regulamento',public.pss_regulamento_atual(),
    'dadosRecebimento',public.pss_dados_recebimento(null),
    'historicoComprovantes',public.pss_historico_comprovantes(),
    'configPublica',v_public_cfg,
    'resumoInscritos',v_resumo,
    'admin',case when v_admin then jsonb_build_object(
      'usuarios',coalesce((select jsonb_agg(to_jsonb(u) order by u.nome,u.email) from public.usuarios u),'[]'::jsonb),
      'solicitacoes',coalesce((select jsonb_agg(to_jsonb(s) order by s.data_solicitacao desc) from public.solicitacoes_cadastro s),'[]'::jsonb),
      'pagamentos',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.pagamentos p),'[]'::jsonb),
      'participantes',coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id,'bolao_id',p.bolao_id,'bolao_nome',b.nome,'usuario_id',p.usuario_id,
        'usuario_nome',u.nome,'usuario_email',u.email,'status',p.status,'inscrito',p.inscrito,
        'cotas_confirmadas',p.cotas_confirmadas,'cotas_pendentes',p.cotas_pendentes,
        'cotas_reservadas',p.cotas_reservadas,'created_at',p.created_at,'updated_at',p.updated_at
      ) order by b.nome,u.nome)
      from public.participacoes p join public.boloes b on b.id=p.bolao_id join public.usuarios u on u.id=p.usuario_id),'[]'::jsonb),
      'baseLoterias',coalesce((select jsonb_agg(to_jsonb(bl) order by bl.nome) from public.base_loterias bl),'[]'::jsonb),
      'dadosRecebimento',coalesce((select jsonb_agg(to_jsonb(dr) order by dr.loteria) from public.dados_recebimento dr),'[]'::jsonb),
      'configuracoes',coalesce((select jsonb_agg(to_jsonb(c) order by c.chave) from public.configuracoes c),'[]'::jsonb),
      'boloes',coalesce((select jsonb_agg(to_jsonb(b) order by b.data_sorteio nulls last,b.nome) from public.boloes b where upper(coalesce(b.status,''))<>'EXCLUIDO'),'[]'::jsonb)
    ) else null end
  );
end$$;

revoke all on function public.pss_frontend_bootstrap_fast() from public,anon;
grant execute on function public.pss_frontend_bootstrap_fast() to authenticated;

comment on function public.pss_frontend_bootstrap_fast() is 'Bootstrap de leitura para navegação rápida; mantém renderizadores e regras existentes.';
