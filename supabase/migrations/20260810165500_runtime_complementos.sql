-- Complementos necessários para cortar o Apps Script do runtime.

create or replace function public.pss_admin_usuario_status(p_email text,p_status text,p_aprovado boolean default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid:=public.pss_usuario_id_atual();v_id uuid;v_status text:=upper(trim(coalesce(p_status,'')));begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;
 if v_status not in('ATIVO','APROVADO','INATIVO','RECUSADO','EXCLUSAO_SOLICITADA') then raise exception 'STATUS_USUARIO_INVALIDO';end if;
 update public.usuarios set status=v_status,aprovado=coalesce(p_aprovado,case when v_status in('ATIVO','APROVADO') then true when v_status in('INATIVO','RECUSADO') then false else aprovado end),updated_at=now() where lower(email)=lower(trim(p_email)) returning id into v_id;
 if v_id is null then raise exception 'USUARIO_NAO_LOCALIZADO';end if;
 insert into public.auditoria(usuario_id,entidade,entidade_id,acao,dados_depois,origem) values(v_admin,'USUARIO',v_id::text,'ALTERAR_STATUS',jsonb_build_object('email',lower(trim(p_email)),'status',v_status,'aprovado',p_aprovado),'SUPABASE');
 return jsonb_build_object('ok',true,'sucesso',true,'email',lower(trim(p_email)),'status',v_status);
end$$;

create or replace function public.pss_admin_excluir_solicitacao(p_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid:=public.pss_usuario_id_atual();v_id uuid;begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;
 delete from public.solicitacoes_cadastro where lower(email)=lower(trim(p_email)) returning id into v_id;
 if v_id is null then raise exception 'SOLICITACAO_NAO_LOCALIZADA';end if;
 insert into public.auditoria(usuario_id,entidade,entidade_id,acao,dados_depois,origem) values(v_admin,'SOLICITACAO_CADASTRO',v_id::text,'EXCLUIR',jsonb_build_object('email',lower(trim(p_email))),'SUPABASE');
 return jsonb_build_object('ok',true,'sucesso',true,'email',lower(trim(p_email)));
end$$;

create or replace function public.pss_admin_excluir_recebimento(p_id uuid default null,p_loteria text default null,p_tipo text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;
 if p_id is not null then delete from public.dados_recebimento where id=p_id returning id into v_id;
 else delete from public.dados_recebimento where lower(loteria)=lower(trim(p_loteria)) and (p_tipo is null or lower(tipo_recebimento)=lower(trim(p_tipo))) returning id into v_id;end if;
 if v_id is null then raise exception 'MEIO_RECEBIMENTO_NAO_LOCALIZADO';end if;
 return jsonb_build_object('ok',true,'sucesso',true,'id',v_id);
end$$;

create or replace function public.pss_solicitar_exclusao()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=public.pss_usuario_id_atual();begin
 if v_uid is null then raise exception 'USUARIO_NAO_LOCALIZADO';end if;
 update public.usuarios set status='EXCLUSAO_SOLICITADA',aprovado=false,updated_at=now() where id=v_uid;
 insert into public.auditoria(usuario_id,entidade,entidade_id,acao,dados_depois,origem) values(v_uid,'USUARIO',v_uid::text,'SOLICITAR_EXCLUSAO',jsonb_build_object('status','EXCLUSAO_SOLICITADA'),'SUPABASE');
 return jsonb_build_object('ok',true,'sucesso',true,'status','EXCLUSAO_SOLICITADA','msg','Solicitação de exclusão registrada.');
end$$;

create or replace function public.pss_resumo_inscritos()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=public.pss_usuario_aprovado();begin
 return jsonb_build_object(
  'total',coalesce((select count(*) from public.participacoes where inscrito and cotas_confirmadas>0),0),
  'boloes',coalesce((select jsonb_agg(x order by x->>'loteria') from(select jsonb_build_object('loteria',b.nome,'total',count(*),'cotas',sum(p.cotas_confirmadas)) x from public.participacoes p join public.boloes b on b.id=p.bolao_id where p.inscrito and p.cotas_confirmadas>0 group by b.id,b.nome)s),'[]'::jsonb)
 );
end$$;

create or replace function public.pss_admin_boloes()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'loteria',loteria,'status',status,'statusOriginal',status_original,'statusReal',status_real,'dataSorteio',data_sorteio,'inicioPagamento',inicio_pagamento,'fimPagamento',fim_pagamento,'inicioPalpite',inicio_palpite,'fimPalpite',fim_palpite,'valorCota',valor_cota,'totalCotas',total_cotas,'cotasAdquiridas',cotas_adquiridas,'cotasDisponiveis',coalesce(cotas_disponiveis,total_cotas-cotas_adquiridas),'qtdParcelas',qtd_parcelas,'premiacao',premiacao,'premioPorCota',premio_por_cota,'range',faixa_numeros,'qtdMin',qtd_min,'qtdMax',qtd_max,'qtdPalpite',qtd_palpite,'historico',historico,'exibirProbabilidade',exibir_probabilidade,'numerosSorteados',numeros_sorteados) order by data_sorteio nulls last,nome) from public.boloes where upper(coalesce(status,''))<>'EXCLUIDO'),'[]'::jsonb);
end$$;

create or replace function public.pss_admin_pagamento_detalhe(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;
 return coalesce((select jsonb_build_object('id',p.id,'email',u.email,'nome',u.nome,'loteria',b.nome,'valor',p.valor,'status',p.status,'pagador',p.pagador,'recebedor',p.recebedor,'chavePix',p.chave_pix,'idTransacao',p.id_transacao,'autenticacao',p.autenticacao,'validacao',p.validacao,'mesReferencia',p.mes_referencia,'tipoCota',p.tipo_cota,'fracaoCota',p.fracao_cota,'qtdCotas',p.qtd_cotas,'cotasEquivalentes',p.cotas_equivalentes,'valorEsperado',p.valor_esperado,'valorTransferido',p.valor_transferido,'nomeArquivo',p.nome_arquivo,'mimeType',p.mime_type,'arquivoUrl',p.arquivo_url,'processamentoStatus',p.processamento_status,'observacao',p.observacao,'data',coalesce(p.data_pagamento,p.created_at)) from public.pagamentos p left join public.usuarios u on u.id=p.usuario_id left join public.boloes b on b.id=p.bolao_id where p.id=p_id),'{}'::jsonb);
end$$;

revoke all on function public.pss_admin_usuario_status(text,text,boolean) from public;
revoke all on function public.pss_admin_excluir_solicitacao(text) from public;
revoke all on function public.pss_admin_excluir_recebimento(uuid,text,text) from public;
revoke all on function public.pss_solicitar_exclusao() from public;
revoke all on function public.pss_resumo_inscritos() from public;
revoke all on function public.pss_admin_boloes() from public;
revoke all on function public.pss_admin_pagamento_detalhe(uuid) from public;
grant execute on function public.pss_admin_usuario_status(text,text,boolean) to anon,authenticated;
grant execute on function public.pss_admin_excluir_solicitacao(text) to anon,authenticated;
grant execute on function public.pss_admin_excluir_recebimento(uuid,text,text) to anon,authenticated;
grant execute on function public.pss_solicitar_exclusao() to anon,authenticated;
grant execute on function public.pss_resumo_inscritos() to anon,authenticated;
grant execute on function public.pss_admin_boloes() to anon,authenticated;
grant execute on function public.pss_admin_pagamento_detalhe(uuid) to anon,authenticated;
