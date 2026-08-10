-- Preserva o comportamento atual: comprovante pode ser enviado sem reserva prévia.
-- Cotas só entram como confirmadas quando o administrador confirma o pagamento.

create or replace function public.pss_registrar_comprovante(p_dados jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=public.pss_usuario_aprovado();v_sub text:=public.pss_claim_sub();b public.boloes%rowtype;p public.participacoes%rowtype;a public.aquisicoes_cotas%rowtype;
 v_loteria text:=trim(coalesce(p_dados->>'loteria',''));v_aqid uuid;v_pag uuid;v_comp uuid;v_hash text:=nullif(trim(p_dados->>'hash'),'');
 v_path text:=trim(coalesce(p_dados->>'storagePath',''));v_mime text:=lower(coalesce(p_dados->>'mimeType',''));v_size bigint:=coalesce(nullif(p_dados->>'tamanhoBytes','')::bigint,0);
 v_qtd numeric:=coalesce(nullif(p_dados->>'qtdCotas','')::numeric,1);v_fracao_txt text:=trim(coalesce(p_dados->>'fracaoCota','1'));v_frac numeric;v_eq numeric;v_valor numeric;
begin
 if v_path='' or position(v_sub||'/' in v_path)<>1 then raise exception 'CAMINHO_STORAGE_INVALIDO';end if;
 if v_mime not in('image/jpeg','image/png','application/pdf','image/webp') then raise exception 'FORMATO_COMPROVANTE_NAO_PERMITIDO';end if;
 if v_size<=0 or v_size>15728640 then raise exception 'TAMANHO_COMPROVANTE_INVALIDO';end if;
 if v_hash is not null and exists(select 1 from public.comprovantes where hash_arquivo=v_hash) then raise exception 'COMPROVANTE_DUPLICADO';end if;
 if v_qtd<=0 then raise exception 'QUANTIDADE_COTAS_INVALIDA';end if;
 v_frac:=case v_fracao_txt when '1' then 1 when '1/2' then .5 when '1/3' then 1.0/3 when '1/4' then .25 when '1/5' then .2 else null end;
 if v_frac is null then raise exception 'FRACAO_COTA_NAO_PERMITIDA';end if;v_eq:=round(v_qtd*v_frac,6);
 if nullif(p_dados->>'aquisicaoId','') is not null then
   v_aqid:=(p_dados->>'aquisicaoId')::uuid;select * into a from public.aquisicoes_cotas where id=v_aqid and usuario_id=v_uid for update;
   if a.id is null then raise exception 'AQUISICAO_NAO_LOCALIZADA';end if;select * into b from public.boloes where id=a.bolao_id;select * into p from public.participacoes where id=a.participacao_id;
   v_qtd:=a.qtd_cotas;v_frac:=a.fracao_cota;v_eq:=a.cotas_equivalentes;v_valor:=a.valor_pagamento_agora;
 else
   select * into b from public.boloes where id=v_loteria or lower(nome)=lower(v_loteria) or lower(loteria)=lower(v_loteria) limit 1;
   if b.id is null then raise exception 'BOLAO_NAO_LOCALIZADO';end if;
   if upper(coalesce(b.status,'')) not in('ATIVO','ABERTO') then raise exception 'BOLAO_NAO_ATIVO';end if;
   if current_date<coalesce(b.inicio_pagamento,current_date) or current_date>coalesce(b.fim_pagamento,current_date) then raise exception 'PRAZO_PAGAMENTO_FECHADO';end if;
   if v_eq>coalesce(b.cotas_disponiveis,b.total_cotas-b.cotas_adquiridas,0) then raise exception 'COTAS_INSUFICIENTES';end if;
   insert into public.participacoes(bolao_id,usuario_id,status,inscrito,cotas_pendentes) values(b.id,v_uid,'PENDENTE',false,v_eq)
   on conflict(bolao_id,usuario_id) do update set cotas_pendentes=public.participacoes.cotas_pendentes+v_eq,status=case when public.participacoes.inscrito then public.participacoes.status else 'PENDENTE' end,updated_at=now() returning * into p;
   v_valor:=coalesce(nullif(p_dados->>'valorEsperado','')::numeric,round(coalesce(b.valor_cota,0)*v_eq,2));
 end if;
 insert into public.pagamentos(usuario_id,bolao_id,participacao_id,aquisicao_id,valor,status,forma_pagamento,hash_comprovante,observacao,nome_arquivo,mime_type,arquivo_url,processamento_status,tipo_cota,fracao_cota,qtd_cotas,cotas_equivalentes,valor_esperado,mes_referencia)
 values(v_uid,b.id,p.id,v_aqid,coalesce(v_valor,0),'PENDENTE',coalesce(p_dados->>'formaPagamento','PIX'),v_hash,nullif(p_dados->>'obs',''),p_dados->>'nomeArquivo',v_mime,v_path,'AGUARDANDO_VALIDACAO',case when v_frac=1 then 'INTEGRAL' else 'FRACIONADA' end,v_frac,v_qtd,v_eq,coalesce(v_valor,0),nullif(p_dados->>'mesReferencia','')) returning id into v_pag;
 insert into public.comprovantes(pagamento_id,usuario_id,nome_arquivo,storage_bucket,storage_path,mime_type,tamanho_bytes,hash_arquivo,status,enviado_por)
 values(v_pag,v_uid,p_dados->>'nomeArquivo','comprovantes',v_path,v_mime,v_size,v_hash,'RECEBIDO',v_uid) returning id into v_comp;
 if v_aqid is not null then update public.aquisicoes_cotas set status='COMPROVANTE_ENVIADO',pagamento_id=v_pag,updated_at=now() where id=v_aqid;end if;
 insert into public.auditoria(usuario_id,entidade,entidade_id,acao,dados_depois,origem) values(v_uid,'COMPROVANTE',v_comp::text,'ENVIAR',jsonb_build_object('pagamento',v_pag,'bolao',b.id,'qtdCotas',v_qtd,'fracao',v_fracao_txt,'equivalente',v_eq,'hash',v_hash),'SUPABASE');
 return jsonb_build_object('ok',true,'sucesso',true,'pagamentoId',v_pag,'comprovanteId',v_comp,'status','PENDENTE','msg','Comprovante enviado. Aguardando validação administrativa.');
end$$;

create or replace function public.pss_admin_pagamento_status(p_id uuid,p_status text,p_obs text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin uuid:=public.pss_usuario_id_atual();p public.pagamentos%rowtype;a public.aquisicoes_cotas%rowtype;v_old text;v_eq numeric;begin
 if not public.pss_is_admin() then raise exception 'ACESSO_ADMIN_NEGADO';end if;select * into p from public.pagamentos where id=p_id for update;if p.id is null then raise exception 'PAGAMENTO_NAO_LOCALIZADO';end if;
 v_old:=upper(coalesce(p.status,''));update public.pagamentos set status=upper(trim(p_status)),observacao=coalesce(nullif(trim(p_obs),''),observacao),processamento_status=case when upper(trim(p_status)) in('PAGO','CONFIRMADO') then 'VALIDADO' when upper(trim(p_status)) in('RECUSADO','CANCELADO') then 'RECUSADO' else processamento_status end,updated_at=now() where id=p.id returning * into p;
 if upper(p.status) in('PAGO','CONFIRMADO') and v_old not in('PAGO','CONFIRMADO') then
   v_eq:=coalesce(p.cotas_equivalentes,p.qtd_cotas*coalesce(p.fracao_cota,1),0);if v_eq<=0 then raise exception 'COTAS_PAGAMENTO_INVALIDAS';end if;
   update public.participacoes set cotas_pendentes=greatest(cotas_pendentes-v_eq,0),cotas_reservadas=case when p.aquisicao_id is not null then greatest(cotas_reservadas-v_eq,0) else cotas_reservadas end,cotas_confirmadas=cotas_confirmadas+v_eq,inscrito=true,status='PAGO/CONFIRMADO',updated_at=now() where id=p.participacao_id;
   update public.boloes set cotas_adquiridas=coalesce(cotas_adquiridas,0)+v_eq,cotas_disponiveis=greatest(coalesce(cotas_disponiveis,total_cotas-cotas_adquiridas)-v_eq,0),atualizado_cotas_em=now(),updated_at=now() where id=p.bolao_id;
   if p.aquisicao_id is not null then update public.aquisicoes_cotas set status='CONFIRMADO',data_confirmacao=now(),updated_at=now() where id=p.aquisicao_id;update public.cotas set status='CONFIRMADO',updated_at=now() where legacy_id=p.aquisicao_id::text;end if;
 elsif upper(p.status) in('RECUSADO','CANCELADO') and v_old not in('RECUSADO','CANCELADO','PAGO','CONFIRMADO') then
   v_eq:=coalesce(p.cotas_equivalentes,p.qtd_cotas*coalesce(p.fracao_cota,1),0);update public.participacoes set cotas_pendentes=greatest(cotas_pendentes-v_eq,0),updated_at=now() where id=p.participacao_id;
 end if;
 insert into public.auditoria(usuario_id,entidade,entidade_id,acao,dados_antes,dados_depois,origem) values(v_admin,'PAGAMENTO',p.id::text,'ALTERAR_STATUS',jsonb_build_object('status',v_old),jsonb_build_object('status',p.status,'obs',p_obs),'SUPABASE');
 return jsonb_build_object('ok',true,'sucesso',true,'id',p.id,'status',p.status);
end$$;

revoke all on function public.pss_registrar_comprovante(jsonb) from public;grant execute on function public.pss_registrar_comprovante(jsonb) to anon,authenticated;
revoke all on function public.pss_admin_pagamento_status(uuid,text,text) from public;grant execute on function public.pss_admin_pagamento_status(uuid,text,text) to anon,authenticated;
