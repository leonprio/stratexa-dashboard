import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    try {
        const snapshot = await db.collection('users').get();
        let count = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            await db.collection('stx_users').doc(doc.id).set(data, { merge: true });
            await db.collection('vac_users').doc(doc.id).set(data, { merge: true });
            await db.collection('tbl_users').doc(doc.id).set(data, { merge: true });
            await db.collection('cpx_users').doc(doc.id).set(data, { merge: true });
            count++;
        }
        console.log(`✅ ${count} users copied everywhere.`);
        process.exit(0);
    } catch(e) { console.error('Error migrando:', e); process.exit(1); }
}
main();
