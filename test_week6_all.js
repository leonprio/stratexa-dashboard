import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const w6 = await db.collection('weekly_data').where('week', '==', 6).where('year', '==', 2026).get();
    w6.forEach(d => {
        let v = d.data();
        if (v.edoFza > 0 || v.vacantesRealesFS > 0) {
           console.log("weekly_data has data:", d.id, v.edoFza, v.vacantesRealesFS);
        }
    });

    const stxw6 = await db.collection('stx_weekly_data').where('week', '==', 6).where('year', '==', 2026).get();
    stxw6.forEach(d => {
        let v = d.data();
        if (v.edoFza > 0 || v.vacantesRealesFS > 0) {
           console.log("stx_weekly_data has data:", d.id, v.edoFza, v.vacantesRealesFS);
        }
    });

    const vacw6 = await db.collection('vac_weekly_data').where('week', '==', 6).where('year', '==', 2026).get();
    vacw6.forEach(d => {
        let v = d.data();
        if (v.edoFza > 0 || v.vacantesRealesFS > 0) {
           console.log("vac_weekly_data has data:", d.id, v.edoFza, v.vacantesRealesFS);
        }
    });

    process.exit(0);
}
main();
