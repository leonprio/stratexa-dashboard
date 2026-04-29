import admin from 'firebase-admin';
import { writeFileSync, readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    let output = {};
    for (const col of ['config', 'stx_config', 'vac_config']) {
        output[col] = {};
        const snapshot = await db.collection(col).get();
        snapshot.forEach(doc => {
            output[col][doc.id] = doc.data();
        });
    }
    writeFileSync('c:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP TABLERO\\test_out.json', JSON.stringify(output, null, 2));
    process.exit(0);
}
main();
