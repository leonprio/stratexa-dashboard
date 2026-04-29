import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Checking Users...");
    const vacUsersSnap = await db.collection('vac_users').get();
    console.log("vac_users count:", vacUsersSnap.size);
    let sample = [];
    vacUsersSnap.forEach(d => {
        if(sample.length < 5) sample.push(d.id);
    });
    console.log("Sample vac_users ids:", sample);
    
    // Check missing globalConfig in vac_config!
    const vacMetricsSnap = await db.collection('vac_config').doc('metrics').get();
    console.log("vac_config/metrics exists:", vacMetricsSnap.exists);

    const vacGlobalSnap = await db.collection('vac_config').doc('global').get();
    console.log("vac_config/global exists:", vacGlobalSnap.exists);

    process.exit(0);
}
main();
