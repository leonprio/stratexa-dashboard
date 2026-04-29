import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = 'C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function finalCheck() {
    const stxDash = await db.collection('stx_dashboards').limit(1).get();
    if (!stxDash.empty) {
        const d = stxDash.docs[0];
        const items = await d.ref.collection('items').limit(1).get();
        console.log(`stx_dashboards doc ${d.id} items count: ${items.size}`);
    } else {
        console.log("stx_dashboards is still empty!");
    }
    process.exit(0);
}

finalCheck();
