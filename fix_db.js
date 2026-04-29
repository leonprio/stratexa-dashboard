import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cloneCollection(source, target, subcollections = []) {
    console.log(`Clonando ${source} a ${target}...`);
    try {
        const snapshot = await db.collection(source).get();
        let count = 0;
        for (const doc of snapshot.docs) {
            await db.collection(target).doc(doc.id).set(doc.data(), { merge: true });
            count++;

            for (const sub of subcollections) {
                const subSnap = await db.collection(source).doc(doc.id).collection(sub).get();
                for (const subDoc of subSnap.docs) {
                    await db.collection(target).doc(doc.id).collection(sub).doc(subDoc.id).set(subDoc.data(), { merge: true });
                }
            }
        }
        console.log(`✅ ${count} docs copiados a ${target}`);
    } catch(e) {
        console.log(`❌ Error copiando ${source} a ${target}:`, e.message);
    }
}

async function main() {
    try {
        // Tablero
        await cloneCollection('dashboards', 'tbl_dashboards', ['items']);
        await cloneCollection('users', 'tbl_users');
        await cloneCollection('systemSettings', 'tbl_systemSettings');
        await cloneCollection('managedClients', 'tbl_managedClients');

        // Vacantes
        await cloneCollection('stx_users', 'vac_users');
        await cloneCollection('stx_weekly_data', 'vac_weekly_data');
        await cloneCollection('stx_config', 'vac_config');
        await cloneCollection('stx_unes', 'vac_unes');
        await cloneCollection('users', 'vac_users'); 
        await cloneCollection('weekly_data', 'vac_weekly_data'); 
        await cloneCollection('config', 'vac_config'); 
        
        // Gobernanza
        await cloneCollection('users', 'cpx_users');
        await cloneCollection('work_plans', 'cpx_work_plans');
        
        console.log('Migración de datos completada.');
        process.exit(0);
    } catch(e) {
        console.error('Error general migrando:', e);
        process.exit(1);
    }
}
main();
