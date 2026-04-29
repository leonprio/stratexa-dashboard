import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const w6 = await db.collection('vac_weekly_data').where('week', '==', 6).where('year', '==', 2026).get();
    console.log("vac_weekly_data week 6 count:", w6.size);
    if (!w6.empty) {
        console.log("Sample:", w6.docs[0].id, "=>", w6.docs[0].data());
    }
    const stxw6 = await db.collection('stx_weekly_data').where('week', '==', 6).where('year', '==', 2026).get();
    console.log("stx_weekly_data week 6 count:", stxw6.size);
    if (!stxw6.empty) {
        console.log("Sample:", stxw6.docs[0].id, "=>", stxw6.docs[0].data());
    }
    process.exit(0);
}
main();
