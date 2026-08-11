import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const raw = process.env.GOOGLE_SERVICE_JSON || '';
const projectId = process.env.FIREBASE_TARGET_PROJECT_ID || 'boloes-loterias-especiais';
if (!raw) throw new Error('GOOGLE_SERVICE_JSON_AUSENTE');
let serviceAccount;
try { serviceAccount = JSON.parse(raw); } catch { throw new Error('GOOGLE_SERVICE_JSON_INVALIDO'); }
if (!getApps().length) initializeApp({ credential: cert(serviceAccount), projectId });
const auth = getAuth();
let token;
let total=0, alterados=0, preservados=0;
do {
  const page = await auth.listUsers(1000, token);
  for (const user of page.users) {
    total++;
    const claims=user.customClaims||{};
    if (claims.role==='authenticated') { preservados++; continue; }
    await auth.setCustomUserClaims(user.uid,{...claims,role:'authenticated'});
    alterados++;
  }
  token=page.pageToken;
} while(token);
console.log(JSON.stringify({ok:true,projectId,credentialProjectId:serviceAccount.project_id||null,total,alterados,preservados}));
