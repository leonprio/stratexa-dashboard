import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Checking Dashboards...");
    const dashSnap = await db.collection('dashboards').get();
    console.log("dashboards count:", dashSnap.size);
    let tblDashCount = 0;
    
    const batch = db.batch();
    dashSnap.forEach(d => {
        batch.set(db.collection('tbl_dashboards').doc(d.id), d.data());
        tblDashCount++;
    });
    
    if (tblDashCount > 0) {
        await batch.commit();
        console.log(`Copied ${tblDashCount} items to tbl_dashboards`);
    }

    // Now copy all users from 'users' to 'tbl_users', 'stx_users', 'vac_users', 'cpx_users' just in case.
    const usersSnap = await db.collection('users').get();
    console.log("users count:", usersSnap.size);
    const ubatch = db.batch();
    usersSnap.forEach(u => {
        ubatch.set(db.collection('tbl_users').doc(u.id), u.data());
        ubatch.set(db.collection('stx_users').doc(u.id), u.data());
        ubatch.set(db.collection('vac_users').doc(u.id), u.data());
        ubatch.set(db.collection('cpx_users').doc(u.id), u.data());
    });
    await ubatch.commit();
    console.log(`Copied ${usersSnap.size} users to all app-specific collections`);
    
    process.exit(0);
}
main();
