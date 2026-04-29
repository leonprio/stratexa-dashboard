import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Restoring legacy config...");
    const stxMetrics = await db.collection('stx_config').doc('metrics').get();
    if (stxMetrics.exists) {
        await db.collection('config').doc('metrics').set(stxMetrics.data());
    }
    const stxGlobal = await db.collection('stx_config').doc('global').get();
    if (stxGlobal.exists) {
        await db.collection('config').doc('global').set(stxGlobal.data());
    } else {
        await db.collection('config').doc('global').set({ reportTitle: 'IPS ACTIVADOR DE RECURSOS' });
    }
    
    // Also stx_appConfig? Let's check what config keys exist
    console.log("Legacy config restored.");
    process.exit(0);
}
main();
