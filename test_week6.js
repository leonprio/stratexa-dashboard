import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const tblSnap = await db.collection('tbl_dashboards').get();
    let weeks = {};
    tblSnap.forEach(d => {
        let w = d.data().week;
        weeks[w] = (weeks[w] || 0) + 1;
    });
    console.log("tbl_dashboards weeks:", weeks);

    const stxSnap = await db.collection('stx_weekly_data').get();
    let stxWeeks = {};
    stxSnap.forEach(d => {
        let w = d.data().week;
        stxWeeks[w] = (stxWeeks[w] || 0) + 1;
    });
    console.log("stx_weekly_data weeks:", stxWeeks);

    const tblD = await db.collection('dashboards').get();
    let dWeeks = {};
    tblD.forEach(d => {
        let w = d.data().week;
        dWeeks[w] = (dWeeks[w] || 0) + 1;
    });
    console.log("dashboards weeks:", dWeeks);
    
    process.exit(0);
}
main();
