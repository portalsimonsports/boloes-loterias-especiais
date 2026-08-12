import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5'

const FIREBASE_PROJECT = 'boloes-loterias-especiais'
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT}`
const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })
}

function field(v: any): any {
  if (!v || typeof v !== 'object') return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return !!v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue || 0)
  if ('doubleValue' in v) return Number(v.doubleValue || 0)
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if (v.mapValue?.fields) return decodeFields(v.mapValue.fields)
  if (Array.isArray(v.arrayValue?.values)) return v.arrayValue.values.map(field)
  return null
}
function decodeFields(fields: Record<string, any> = {}) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = field(v)
  return out
}

async function verifyFirebase(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('FIREBASE_TOKEN_AUSENTE')
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT,
    algorithms: ['RS256'],
  })
  const email = String(payload.email || '').trim().toLowerCase()
  const sub = String(payload.sub || '').trim()
  if (!email || !sub) throw new Error('FIREBASE_TOKEN_SEM_IDENTIDADE')
  return { email, sub, token }
}

function adminValido(u: any) {
  const st = String(u?.status || '').trim().toUpperCase()
  const pf = String(u?.perfil || u?.role || '').trim().toUpperCase()
  const ativo = u?.ativo === true || ['TRUE','SIM','ATIVO','APROVADO'].includes(String(u?.ativo || '').trim().toUpperCase())
  const aprovado = st === 'APROVADO' || st === 'ATIVO'
  return ativo && aprovado && (pf.includes('ADMIN') || pf.includes('MESTRE'))
}

async function firebasePerfilAdmin(email: string, token: string) {
  const doc = encodeURIComponent(email.toLowerCase())
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/usuarios/${doc}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3500)
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    if (!r.ok) return null
    const j = await r.json()
    return decodeFields(j?.fields || {})
  } finally { clearTimeout(timer) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, erro: 'METODO_INVALIDO' }, 405)

  try {
    const ident = await verifyFirebase(req)
    const fb = await firebasePerfilAdmin(ident.email, ident.token)
    if (!fb || !adminValido(fb)) return json({ ok: false, erro: 'ADMIN_NAO_AUTORIZADO' }, 403)

    const url = Deno.env.get('SUPABASE_URL')!
    const secretMap = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const secret = secretMap.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secret) throw new Error('SUPABASE_SECRET_INDISPONIVEL')
    const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: me } = await sb.from('usuarios').select('id,firebase_uid').eq('email', ident.email).maybeSingle()
    if (me?.id) {
      const patch: any = { firebase_uid: ident.sub }
      if (fb.nome) patch.nome = String(fb.nome)
      if (fb.perfil) patch.perfil = String(fb.perfil).toUpperCase()
      patch.status = 'APROVADO'
      patch.aprovado = true
      await sb.from('usuarios').update(patch).eq('id', me.id)
    }

    const body = await req.json().catch(() => ({}))
    const screen = String(body?.screen || '').trim().toLowerCase()

    if (screen === 'usuarios') {
      const { data, error } = await sb.from('usuarios')
        .select('id,nome,nome_publico,email,telefone,status,perfil,aprovado,firebase_uid,created_at,updated_at')
        .order('nome', { ascending: true })
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    if (screen === 'solicitacoes') {
      const { data, error } = await sb.from('solicitacoes_cadastro').select('*').order('data_solicitacao', { ascending: false }).limit(500)
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    if (screen === 'base_loterias') {
      const { data, error } = await sb.from('base_loterias').select('*').order('nome', { ascending: true })
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    if (screen === 'participantes') {
      const { data, error } = await sb.from('participacoes')
        .select('id,bolao_id,usuario_id,status,inscrito,cotas_confirmadas,cotas_pendentes,cotas_reservadas,created_at,updated_at,usuarios(nome,email),boloes(nome)')
        .order('updated_at', { ascending: false }).limit(1000)
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    if (screen === 'pagamentos') {
      const { data, error } = await sb.from('pagamentos').select('*').order('created_at', { ascending: false }).limit(1000)
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    if (screen === 'dados_recebimento') {
      const { data, error } = await sb.from('dados_recebimento').select('*').order('loteria', { ascending: true })
      if (error) throw error
      return json({ ok: true, screen, rows: data || [] })
    }
    return json({ ok: false, erro: 'TELA_NAO_SUPORTADA' }, 400)
  } catch (e) {
    return json({ ok: false, erro: String((e as Error)?.message || e) }, 401)
  }
})
