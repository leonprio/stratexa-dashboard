import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Copying Dashboard Subcollections...");
    const dashSnap = await db.collection('dashboards').get();
    let copied = 0;
    
    // Copy item subcollections
    for (const d of dashSnap.docs) {
        const itemsSnap = await d.ref.collection('items').get();
        if (itemsSnap.empty) continue;
        
        const tblBatch = db.batch();
        itemsSnap.forEach(item => {
            tblBatch.set(db.collection('tbl_dashboards').doc(d.id).collection('items').doc(item.id), item.data());
        });
        await tblBatch.commit();
        copied += itemsSnap.size;
    }
    console.log(`Copied ${copied} dashboard items to tbl_dashboards`);

    console.log("Adding default years to dash docs missing it.");
    // Some tabs may be lacking year=2026 at the top level doc.
    const tblSnap = await db.collection('tbl_dashboards').get();
    const batch = db.batch();
    for (const doc of tblSnap.docs) {
        let v = doc.data();
        if(!v.year && v.id) {
            // usually it has a year field as part of its data 
            // if not we attempt to guess or just set 2026
            let year = 2026;
            if(v.createdAt) { year = new Date(v.createdAt).getFullYear(); }
            console.log(`Setting year=${year} on dashboard ${doc.id}`);
            batch.set(doc.ref, { year }, { merge: true });
        }
    }
    await batch.commit();
    process.exit(0);
}
main();
