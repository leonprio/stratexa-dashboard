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

async function auditActivador() {
    console.log("--- AUDITORÍA PROFUNDA ACTIVADOR ---");

    // 1. Usuarios en stx_users
    const stxUsers = await db.collection('stx_users').get();
    console.log(`Usuarios en stx_users: ${stxUsers.size}`);
    stxUsers.docs.forEach(doc => {
        console.log(` - UID: ${doc.id}, Email: ${doc.data().email}, Role: ${doc.data().role}`);
    });

    // 2. Configuración en stx_config
    const stxConfig = await db.collection('stx_config').doc('global').get();
    console.log("stx_config/global:", stxConfig.exists ? stxConfig.data() : "NO EXISTE");

    // 3. Revisar si hay dashboards en stx_dashboards o dashboards
    const stxDash = await db.collection('stx_dashboards').get();
    console.log(`stx_dashboards count: ${stxDash.size}`);
    
    const genDash = await db.collection('dashboards').get();
    console.log(`dashboards (genérico) count: ${genDash.size}`);

    // 4. Revisar weekly_data
    const stxWeekly = await db.collection('stx_weekly_data').limit(5).get();
    console.log(`stx_weekly_data samples: ${stxWeekly.size}`);
    
    process.exit(0);
}

auditActivador().catch(err => {
    console.error(err);
    process.exit(1);
});
