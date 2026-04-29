import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = 'C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateToStx() {
    console.log("Migrando dashboards a stx_dashboards...");
    const dashSnap = await db.collection('dashboards').get();
    
    for (const d of dashSnap.docs) {
        // Copiar doc principal
        await db.collection('stx_dashboards').doc(d.id).set(d.data());
        
        // Copiar subcolección items
        const itemsSnap = await d.ref.collection('items').get();
        if (!itemsSnap.empty) {
            const batch = db.batch();
            itemsSnap.forEach(item => {
                batch.set(db.collection('stx_dashboards').doc(d.id).collection('items').doc(item.id), item.data());
            });
            await batch.commit();
        }
    }
    console.log(`Migrados ${dashSnap.size} dashboards a stx_dashboards`);
    
    // También migrar weekly_data del 2026?
    // El usuario mencionó problemas con la semana 6.
    console.log("Migrando weekly_data de 2026 a stx_weekly_data...");
    const weeklySnap = await db.collection('weekly_data').where('year', '==', 2026).get();
    let count = 0;
    const batch = db.batch();
    
    for (const w of weeklySnap.docs) {
        batch.set(db.collection('stx_weekly_data').doc(w.id), w.data());
        count++;
        if (count % 400 === 0) {
            await batch.commit();
        }
    }
    if (count % 400 !== 0) await batch.commit();
    console.log(`Migrados ${count} documentos de weekly_data a stx_weekly_data`);
    
    process.exit(0);
}

migrateToStx().catch(err => {
    console.error(err);
    process.exit(1);
});
