import admin from 'firebase-admin';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurado.');

let serviceAccount;
try { serviceAccount = JSON.parse(raw); }
catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválido.'); }

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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

console.log(JSON.stringify({ ok: true, total, alterados, preservados }));
