-- Portal SimonSports - Bolões Loterias Especiais
-- Estrutura inicial PostgreSQL/Supabase para migração paralela.
-- Não remove nem altera o backend atual em Google Planilhas/Apps Script.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text,
  email text,
  telefone text,
  cpf text,
  rg text,
  status text not null default 'ATIVO',
  perfil text not null default 'PARTICIPANTE',
  aprovado boolean not null default false,
  legacy_id text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists usuarios_email_lower_uq
  on public.usuarios (lower(email)) where email is not null and email <> '';
create index if not exists usuarios_status_idx on public.usuarios(status);
create index if not exists usuarios_firebase_uid_idx on public.usuarios(firebase_uid);

create table if not exists public.boloes (
  id text primary key,
  nome text not null,
  loteria text,
  status text not null default 'INATIVO',
  status_original text,
  status_real text,
  data_sorteio date,
  inicio_pagamento date,
  fim_pagamento date,
  inicio_palpite date,
  fim_palpite date,
  valor_cota numeric(14,2),
  total_cotas numeric(12,4),
  cotas_adquiridas numeric(12,4) not null default 0,
  cotas_disponiveis numeric(12,4),
  qtd_parcelas integer,
  premiacao numeric(16,2) not null default 0,
  premio_por_cota numeric(16,4) not null default 0,
  recebedor text,
  faixa_numeros integer,
  qtd_min integer,
  qtd_max integer,
  qtd_palpite integer,
  historico boolean not null default false,
  exibir_probabilidade boolean not null default true,
  numeros_sorteados text,
  resultado_sorteio text,
  criterio_cotas_adquiridas text,
  atualizado_cotas_em timestamptz,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boloes_status_idx on public.boloes(status);
create index if not exists boloes_data_sorteio_idx on public.boloes(data_sorteio);
create index if not exists boloes_historico_idx on public.boloes(historico);

create table if not exists public.participacoes (
  id uuid primary key default gen_random_uuid(),
  bolao_id text not null references public.boloes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  status text not null default 'PENDENTE',
  inscrito boolean not null default false,
  cotas_confirmadas numeric(12,4) not null default 0,
  cotas_pendentes numeric(12,4) not null default 0,
  cotas_reservadas numeric(12,4) not null default 0,
  legacy_id text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bolao_id, usuario_id)
);

create index if not exists participacoes_usuario_idx on public.participacoes(usuario_id);
create index if not exists participacoes_bolao_idx on public.participacoes(bolao_id);
create index if not exists participacoes_status_idx on public.participacoes(status);

create table if not exists public.cotas (
  id uuid primary key default gen_random_uuid(),
  participacao_id uuid not null references public.participacoes(id) on delete cascade,
  quantidade numeric(12,4) not null,
  fracao text,
  valor_unitario numeric(14,2),
  valor_total numeric(14,2),
  status text not null default 'PENDENTE',
  origem text,
  legacy_id text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cotas_participacao_idx on public.cotas(participacao_id);
create index if not exists cotas_status_idx on public.cotas(status);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  usuario_id uuid references public.usuarios(id) on delete set null,
  bolao_id text references public.boloes(id) on delete set null,
  participacao_id uuid references public.participacoes(id) on delete set null,
  valor numeric(14,2) not null default 0,
  status text not null default 'PENDENTE',
  forma_pagamento text,
  data_pagamento timestamptz,
  pagador text,
  recebedor text,
  chave_pix text,
  identificador_pix text,
  hash_comprovante text,
  observacao text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pagamentos_usuario_idx on public.pagamentos(usuario_id);
create index if not exists pagamentos_bolao_idx on public.pagamentos(bolao_id);
create index if not exists pagamentos_participacao_idx on public.pagamentos(participacao_id);
create index if not exists pagamentos_status_idx on public.pagamentos(status);
create index if not exists pagamentos_data_idx on public.pagamentos(data_pagamento desc);
create unique index if not exists pagamentos_hash_comprovante_uq
  on public.pagamentos(hash_comprovante) where hash_comprovante is not null and hash_comprovante <> '';

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  numero integer not null,
  vencimento date,
  valor numeric(14,2) not null default 0,
  status text not null default 'PENDENTE',
  pago_em timestamptz,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pagamento_id, numero)
);

create index if not exists parcelas_pagamento_idx on public.parcelas(pagamento_id);
create index if not exists parcelas_vencimento_idx on public.parcelas(vencimento);
create index if not exists parcelas_status_idx on public.parcelas(status);

create table if not exists public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  nome_arquivo text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  tamanho_bytes bigint,
  hash_arquivo text,
  ocr_texto text,
  ocr_dados jsonb not null default '{}'::jsonb,
  status text not null default 'RECEBIDO',
  enviado_por uuid references public.usuarios(id) on delete set null,
  legacy_drive_url text,
  legacy_id text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comprovantes_pagamento_idx on public.comprovantes(pagamento_id);
create index if not exists comprovantes_usuario_idx on public.comprovantes(usuario_id);
create unique index if not exists comprovantes_hash_arquivo_uq
  on public.comprovantes(hash_arquivo) where hash_arquivo is not null and hash_arquivo <> '';

create table if not exists public.palpites (
  id uuid primary key default gen_random_uuid(),
  bolao_id text not null references public.boloes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  numeros jsonb not null default '[]'::jsonb,
  texto_original text,
  status text not null default 'ATIVO',
  enviado_em timestamptz not null default now(),
  fechado_em timestamptz,
  legacy_id text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists palpites_bolao_idx on public.palpites(bolao_id);
create index if not exists palpites_usuario_idx on public.palpites(usuario_id);
create index if not exists palpites_bolao_usuario_idx on public.palpites(bolao_id, usuario_id);

create table if not exists public.resultados (
  id uuid primary key default gen_random_uuid(),
  bolao_id text references public.boloes(id) on delete set null,
  loteria text,
  concurso text,
  data_sorteio date,
  numeros jsonb not null default '[]'::jsonb,
  numeros_texto text,
  premiacao jsonb not null default '{}'::jsonb,
  fonte text,
  fonte_versao text,
  publicado_em timestamptz,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resultados_bolao_idx on public.resultados(bolao_id);
create index if not exists resultados_loteria_concurso_idx on public.resultados(loteria, concurso);
create index if not exists resultados_data_idx on public.resultados(data_sorteio desc);

create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  publico boolean not null default false,
  descricao text,
  updated_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists configuracoes_publico_idx on public.configuracoes(publico);

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.usuarios(id) on delete set null,
  entidade text not null,
  entidade_id text,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  origem text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_entidade_idx on public.auditoria(entidade, entidade_id);
create index if not exists auditoria_usuario_idx on public.auditoria(usuario_id);
create index if not exists auditoria_created_at_idx on public.auditoria(created_at desc);

-- updated_at automático
create trigger usuarios_set_updated_at before update on public.usuarios
for each row execute function public.set_updated_at();
create trigger boloes_set_updated_at before update on public.boloes
for each row execute function public.set_updated_at();
create trigger participacoes_set_updated_at before update on public.participacoes
for each row execute function public.set_updated_at();
create trigger cotas_set_updated_at before update on public.cotas
for each row execute function public.set_updated_at();
create trigger pagamentos_set_updated_at before update on public.pagamentos
for each row execute function public.set_updated_at();
create trigger parcelas_set_updated_at before update on public.parcelas
for each row execute function public.set_updated_at();
create trigger comprovantes_set_updated_at before update on public.comprovantes
for each row execute function public.set_updated_at();
create trigger palpites_set_updated_at before update on public.palpites
for each row execute function public.set_updated_at();
create trigger resultados_set_updated_at before update on public.resultados
for each row execute function public.set_updated_at();
create trigger configuracoes_set_updated_at before update on public.configuracoes
for each row execute function public.set_updated_at();

-- RLS: começa fechado. Políticas serão abertas por função/tela durante a migração.
alter table public.usuarios enable row level security;
alter table public.boloes enable row level security;
alter table public.participacoes enable row level security;
alter table public.cotas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.parcelas enable row level security;
alter table public.comprovantes enable row level security;
alter table public.palpites enable row level security;
alter table public.resultados enable row level security;
alter table public.configuracoes enable row level security;
alter table public.auditoria enable row level security;

comment on table public.usuarios is 'Usuários migrados do sistema atual; suporta Firebase UID durante transição e Supabase Auth futuramente.';
comment on table public.boloes is 'Cadastro principal de bolões/loterias especiais.';
comment on table public.participacoes is 'Vínculo único entre usuário e bolão.';
comment on table public.cotas is 'Movimentos/aquisições de cotas, incluindo frações.';
comment on table public.pagamentos is 'Pagamentos e metadados PIX/comprovantes.';
comment on table public.comprovantes is 'Metadados de comprovantes; arquivo físico ficará no Supabase Storage.';
comment on table public.auditoria is 'Trilha de auditoria do sistema.';
