import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("Starting Repair...");
    // 1. Repair global config for Vacantes and Activador
    await db.collection('vac_config').doc('global').set({ reportTitle: 'IPS ANÁLISIS ESTRATÉGICO DE VACANTES' }, { merge: true });
    await db.collection('stx_config').doc('global').set({ reportTitle: 'IPS ACTIVADOR DE RECURSOS' }, { merge: true });
    console.log("Global configs restored.");

    // 2. Sync Week 6 data from stx_weekly_data to vac_weekly_data and weekly_data
    const stxw6 = await db.collection('stx_weekly_data')
        .where('year', '==', 2026)
        .where('week', '==', 6)
        .get();
    
    if (!stxw6.empty) {
        const batch = db.batch();
        stxw6.forEach(d => {
            const data = d.data();
            batch.set(db.collection('vac_weekly_data').doc(d.id), data);
            batch.set(db.collection('weekly_data').doc(d.id), data);
        });
        await batch.commit();
        console.log(`Synced ${stxw6.size} documents for Week 6 from stx_ to vac_ and generic.`);
    }

    // 3. Make sure week 51 is not the default. The user says "Carga no inicializada SEMANA 51 - 2026"
    // So the syncEnabled must be TRUE and it should point to Week 6 in the past or whichever is current!
    // Wait, let's fix the vac_config metrics to point to Week 6!
    const vacMetrics = await db.collection('vac_config').doc('metrics').get();
    if(vacMetrics.exists) {
        const met = vacMetrics.data();
        if(met.globalPeriod) {
            met.globalPeriod.week = 6;
            met.globalPeriod.syncEnabled = true;
        } else {
            met.globalPeriod = { week: 6, year: 2026, syncEnabled: true };
        }
        await db.collection('vac_config').doc('metrics').set(met);
    }

    const stxMetrics = await db.collection('stx_config').doc('metrics').get();
    if(stxMetrics.exists) {
        const met = stxMetrics.data();
        if(met.globalPeriod) {
            met.globalPeriod.week = 6;
            met.globalPeriod.syncEnabled = true;
        } else {
            met.globalPeriod = { week: 6, year: 2026, syncEnabled: true };
        }
        await db.collection('stx_config').doc('metrics').set(met);
    }
    console.log("Synchronized globalPeriod to Week 6 for all configs.");
    
    process.exit(0);
}
main();
