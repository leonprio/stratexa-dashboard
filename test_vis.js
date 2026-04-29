import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const dSnap = await db.collection('tbl_dashboards').get();
    let hidden = 0;
    let archived = 0;
    let ok = 0;
    let year26 = 0;
    dSnap.forEach(d => {
        let v = d.data();
        if (v.year === 2026 || v.year === "2026") {
            year26++;
            if (v.visible === false) hidden++;
            else if (v.status === 'archived') archived++;
            else ok++;
        }
    });
    console.log(`2026 Dashboards total: ${year26}, hidden: ${hidden}, archived: ${archived}, ok: ${ok}`);
    process.exit(0);
}
main();
