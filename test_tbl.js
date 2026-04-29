import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    const dSnap = await db.collection('tbl_dashboards').get();
    let years = {};
    dSnap.forEach(d => {
        let yr = d.data().year;
        years[yr] = (years[yr] || 0) + 1;
    });
    console.log("tbl_dashboards years:", years);
    
    // now to view one sample dashboard and its items
    if(dSnap.docs.length > 0) {
        console.log("Sample Dashboard:", dSnap.docs[0].id, "=>", Object.keys(dSnap.docs[0].data()));
        console.log("year:", dSnap.docs[0].data().year, typeof dSnap.docs[0].data().year);
        const sub = await dSnap.docs[0].ref.collection('items').get();
        console.log("Sample dashboard item count:", sub.size);
    }
    
    process.exit(0);
}
main();
