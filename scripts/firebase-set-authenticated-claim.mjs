import admin from 'firebase-admin';

// V2: valida integração Firebase -> Supabase sem alterar a lógica de autenticação do site.
const raw = process.env.GOOGLE_SERVICE_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
const targetProjectId = process.env.FIREBASE_TARGET_PROJECT_ID || 'boloes-loterias-especiais';

if (!raw) throw new Error('GOOGLE_SERVICE_JSON não configurado.');

let serviceAccount;
try { serviceAccount = JSON.parse(raw); }
catch { throw new Error('GOOGLE_SERVICE_JSON inválido.'); }

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: targetProjectId
  });
}

const auth = admin.auth();
let nextPageToken;
let total = 0;
let alterados = 0;
let preservados = 0;

for (;;) {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    total++;
    const claims = user.customClaims || {};
    if (claims.role === 'authenticated') {
      preservados++;
      continue;
    }
    await auth.setCustomUserClaims(user.uid, { ...claims, role: 'authenticated' });
    alterados++;
  }
  nextPageToken = page.pageToken;
  if (!nextPageToken) break;
}

console.log(JSON.stringify({
  ok: true,
  targetProjectId,
  credentialProjectId: serviceAccount.project_id || null,
  total,
  alterados,
  preservados
}));
