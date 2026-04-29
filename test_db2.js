import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Configs:");
    const c1 = await db.collection('config').doc('main').get();
    console.log("config:", c1.data());
    const c2 = await db.collection('stx_config').doc('main').get();
    console.log("stx_config:", c2.data());
    const c3 = await db.collection('vac_config').doc('main').get();
    console.log("vac_config:", c3.data());
    process.exit(0);
}
main();
