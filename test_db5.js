import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const configSnap = await db.collection('config').get();
    configSnap.forEach(d => console.log(d.id, '->', Object.keys(d.data())));
    process.exit(0);
}
main();
