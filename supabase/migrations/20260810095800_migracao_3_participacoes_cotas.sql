-- Migração 3/4: participações, cotas e parcelas
begin;
create temporary table mig_part(bolao_id text,email text,quantidade numeric) on commit drop;
insert into mig_part values
('ESP-1780183527018','advdanielporto@gmail.com',1),('ESP-1780183527018','ale1946@hotmail.com',1),('ESP-1780183527018','amsp.2007@hotmail.com',0.5),('ESP-1780183527018','debieepol@gmail.com',1),('ESP-1780183527018','edyeasp@gmail.com',1),('ESP-1780183527018','joseassr@gmail.com',1),('ESP-1780183527018','kikogavioes@gmail.com',1),('ESP-1780183527018','osniamaral2011@hotmail.com',3),('ESP-1780183527018','portalsimonsports@gmail.com',1),('ESP-1780183527018','reinaldo.ribeiro48@hotmail.com',1),('ESP-1780183527018','vitoralmeidaalmeida@hotmail.com',1),('ESP-1780183527018','wagnermingati@gmail.com',1),('ESP-1780183527018','wcms2016@gmail.com',1),('ESP-1780604610456','amsp.2007@hotmail.com',0.5),('ESP-1780604610456','portalsimonsports@gmail.com',1),('ESP-1783783762415','ale1946@hotmail.com',1),('ESP-1783783762415','aleaca.med@gmail.com',1),('ESP-1783783762415','amsp.2007@hotmail.com',1),('ESP-1783783762415','bia-concei@hotmail.com',1),('ESP-1783783762415','bmarquesteodoro@gmail.com',1),('ESP-1783783762415','claudio.terapeutaocupacional@gmail.com',1),('ESP-1783783762415','claytonsouza80@yahoo.com.br',1),('ESP-1783783762415','debieepol@gmail.com',1),('ESP-1783783762415','edyeasp@gmail.com',1),('ESP-1783783762415','jmakuko@gmail.com',1),('ESP-1783783762415','joseassr@gmail.com',1),('ESP-1783783762415','kikogavioes@gmail.com',1),('ESP-1783783762415','lopesjoaquim1978@gmail.com',2),('ESP-1783783762415','luiz197271@gmail.com',2),('ESP-1783783762415','marlisantos0120@gmail.com',1),('ESP-1783783762415','oscar.dos.santos.filho.semcadastro.1783993843058@provisorio.local',1),('ESP-1783783762415','osniamaral2011@hotmail.com',1),('ESP-1783783762415','portalsimonsports@gmail.com',1),('ESP-1783783762415','reinaldo.ribeiro48@hotmail.com',1),('ESP-1783783762415','renanuilian@hotmail.com',1),('ESP-1783783762415','rumdean@hotmail.com',1),('ESP-1783783762415','sandra.aparecida.chaves.costa.de.souza.semcadastro.1784051126358@provisorio.local',1),('ESP-1783783762415','santana2045@hotmail.com',1),('ESP-1783783762415','taniacristinachaves@yahoo.com.br',1),('ESP-1783783762415','vitoralmeidaalmeida@hotmail.com',1),('ESP-1783783762415','wagnermingati@gmail.com',1),('ESP-1783783762415','wcms2016@gmail.com',1);

insert into public.participacoes(bolao_id,usuario_id,status,inscrito,cotas_confirmadas,cotas_pendentes,cotas_reservadas,legacy_id,legacy_payload)
select s.bolao_id,u.id,'PAGO',s.quantidade>0,s.quantidade,0,0,'PART-'||md5(s.bolao_id||'|'||lower(s.email)),jsonb_build_object('fonte','DERIVADO_PAGAMENTOS','email_legacy',s.email)
from mig_part s join public.usuarios u on lower(u.email)=lower(s.email)
on conflict(bolao_id,usuario_id) do update set status='PAGO',inscrito=excluded.inscrito,cotas_confirmadas=excluded.cotas_confirmadas,cotas_pendentes=0,cotas_reservadas=0,legacy_payload=public.participacoes.legacy_payload||excluded.legacy_payload;

update public.pagamentos pg set participacao_id=p.id
from public.participacoes p
where pg.usuario_id=p.usuario_id and pg.bolao_id=p.bolao_id and pg.participacao_id is distinct from p.id;

insert into public.cotas(participacao_id,quantidade,fracao,valor_total,status,origem,legacy_id,legacy_payload)
select p.id,(pg.legacy_payload->>'quantidade_legacy')::numeric,pg.legacy_payload->>'fracao_legacy',pg.valor,'PAGO','MIGRACAO_PLANILHA','COTA-'||pg.legacy_id,jsonb_build_object('fonte','PAGAMENTOS')
from public.pagamentos pg join public.participacoes p on p.id=pg.participacao_id
where upper(pg.status)='PAGO' and coalesce((pg.legacy_payload->>'quantidade_legacy')::numeric,0)>0
and not exists(select 1 from public.cotas c where c.legacy_id='COTA-'||pg.legacy_id);

insert into public.parcelas(pagamento_id,numero,valor,status,pago_em,legacy_payload)
select pg.id,1,pg.valor,pg.status,case when upper(pg.status)='PAGO' then pg.data_pagamento else null end,jsonb_build_object('fonte','PAGAMENTOS','modelo','parcela_unica_legacy')
from public.pagamentos pg
where pg.legacy_id like 'PAG-%'
on conflict(pagamento_id,numero) do update set valor=excluded.valor,status=excluded.status,pago_em=excluded.pago_em;

commit;
